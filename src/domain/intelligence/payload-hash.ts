import type { JsonValue } from './untrusted-json.ts';
import { SHA256_PATTERN, fail, ok, record, shape, snapshot, type DomainResult } from './domain-validation.ts';

export const PAYLOAD_HASH_POLICY = Object.freeze({ id: 'retained-payload-sha256', version: '1', algorithm: 'SHA-256',
  stringEncoding: 'UTF-8', maxPayloadBytes: 1_048_576 } as const);

export interface PayloadHashVerification {
  readonly contractVersion: 'payload-hash-verification-v1';
  readonly status: 'verified' | 'mismatch' | 'not_verifiable';
  readonly reason: string;
  readonly expectedHash: string;
  readonly actualHash?: string;
  readonly payloadByteLength?: number;
  readonly payloadKind?: 'bytes' | 'utf8_string';
  readonly replayMode: 'full_payload_retained' | 'hash_and_retrievable_locator' | 'hash_only_verification' | 'not_fully_replayable';
  readonly policy: typeof PAYLOAD_HASH_POLICY;
}

interface RetentionInput { readonly payloadHash: string; readonly replayMode: PayloadHashVerification['replayMode'] }

function retention(value: JsonValue): DomainResult<RetentionInput> {
  const parsed = record(value, '$'); if (!parsed.ok) return parsed;
  const exact = shape(parsed.value, ['payloadHash', 'replayMode'], '$'); if (!exact.ok) return exact;
  if (typeof parsed.value.payloadHash !== 'string' || !SHA256_PATTERN.test(parsed.value.payloadHash))
    return fail('invalid_hash', 'Expected hash must be canonical lowercase sha256:<64 hex>.', '$.payloadHash');
  const modes = ['full_payload_retained', 'hash_and_retrievable_locator', 'hash_only_verification', 'not_fully_replayable'] as const;
  if (typeof parsed.value.replayMode !== 'string' || !modes.includes(parsed.value.replayMode as typeof modes[number]))
    return fail('invalid_replay_contract', 'Replay mode is unsupported.', '$.replayMode');
  return ok({ payloadHash: parsed.value.payloadHash, replayMode: parsed.value.replayMode as typeof modes[number] });
}

function hashBytes(hash: string): Uint8Array {
  const output = new Uint8Array(32); const hex = hash.slice(7);
  for (let index = 0; index < output.length; index += 1) output[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return output;
}
function constantTimeEqual(first: Uint8Array, second: Uint8Array): boolean {
  let different = first.length ^ second.length;
  const maximum = Math.max(first.length, second.length);
  for (let index = 0; index < maximum; index += 1) different |= (first[index % first.length] ?? 0) ^ (second[index % second.length] ?? 0);
  return different === 0;
}
function toCanonicalHash(bytes: Uint8Array): string {
  let hex = ''; for (const byte of bytes) hex += byte.toString(16).padStart(2, '0'); return `sha256:${hex}`;
}

function notVerifiable(input: RetentionInput): DomainResult<PayloadHashVerification> {
  return ok({ contractVersion: 'payload-hash-verification-v1', status: 'not_verifiable', reason: 'retained_payload_bytes_not_supplied',
    expectedHash: input.payloadHash, replayMode: input.replayMode, policy: PAYLOAD_HASH_POLICY });
}

export async function verifyPayloadHash(retentionInput: unknown, payload?: string | Uint8Array): Promise<DomainResult<PayloadHashVerification>> {
  const safe = snapshot(retentionInput); if (!safe.ok) return safe;
  const parsed = retention(safe.value); if (!parsed.ok) return parsed;
  if (payload === undefined) return notVerifiable(parsed.value);
  let bytes: Uint8Array; let payloadKind: 'bytes' | 'utf8_string'; let length: number;
  if (typeof payload === 'string') {
    payloadKind = 'utf8_string';
    if (payload.length > PAYLOAD_HASH_POLICY.maxPayloadBytes) return fail('payload_too_large', 'Payload exceeds the maximum size before UTF-8 encoding or hashing.', '$payload',
      { metadata: { limit: PAYLOAD_HASH_POLICY.maxPayloadBytes, actual: payload.length, unit: 'utf16_code_units_lower_bound' } });
    try { length = new TextEncoder().encode(payload).byteLength; } catch { return fail('invalid_payload', 'String payload could not be encoded as UTF-8.', '$payload'); }
    if (length > PAYLOAD_HASH_POLICY.maxPayloadBytes) return fail('payload_too_large', 'Payload exceeds the maximum size before hashing.', '$payload',
      { metadata: { limit: PAYLOAD_HASH_POLICY.maxPayloadBytes, actual: length } });
    bytes = new TextEncoder().encode(payload);
  } else {
    payloadKind = 'bytes';
    try {
      if (!(payload instanceof Uint8Array)) return fail('invalid_payload', 'Payload must be a string or actual Uint8Array-compatible byte view.', '$payload');
      const prototype = Object.getPrototypeOf(payload);
      const bufferPrototype = typeof Buffer !== 'undefined' ? Buffer.prototype : undefined;
      if (prototype !== Uint8Array.prototype && prototype !== bufferPrototype)
        return fail('invalid_payload', 'Payload byte view must use a supported Uint8Array prototype.', '$payload');
      length = payload.byteLength;
      if (!Number.isSafeInteger(length) || length < 0) return fail('invalid_payload', 'Payload byte length is invalid.', '$payload');
      if (length > PAYLOAD_HASH_POLICY.maxPayloadBytes) return fail('payload_too_large', 'Payload exceeds the maximum size before copying or hashing.', '$payload',
        { metadata: { limit: PAYLOAD_HASH_POLICY.maxPayloadBytes, actual: length } });
      bytes = new Uint8Array(payload.buffer, payload.byteOffset, length).slice();
    } catch { return fail('invalid_payload', 'Payload byte view is detached, invalid or hostile.', '$payload'); }
  }
  try {
    const digestInput = new Uint8Array(bytes.byteLength); digestInput.set(bytes);
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', digestInput.buffer));
    const actualHash = toCanonicalHash(digest); const matches = constantTimeEqual(hashBytes(parsed.value.payloadHash), digest);
    return ok({ contractVersion: 'payload-hash-verification-v1', status: matches ? 'verified' : 'mismatch',
      reason: matches ? 'sha256_matches_retained_payload_bytes' : 'sha256_mismatch', expectedHash: parsed.value.payloadHash,
      actualHash, payloadByteLength: length, payloadKind, replayMode: parsed.value.replayMode, policy: PAYLOAD_HASH_POLICY });
  } catch { return fail('hash_unavailable', 'Platform SHA-256 could not hash the validated payload.', '$payload'); }
}
