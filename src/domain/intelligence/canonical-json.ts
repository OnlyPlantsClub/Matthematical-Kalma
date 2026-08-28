import { inspectJsonCompatibleInput, type JsonValue } from './untrusted-json.ts';

export const CANONICAL_JSON_CONTRACT_VERSION = 'rfc8785-jcs/1';
export const CANONICAL_JSON_LIMITS = Object.freeze({
  version: 'canonical-json-limits/1',
  maxUtf8Bytes: 65_536,
} as const);

export type CanonicalizationErrorCode = 'invalid_canonical_input' | 'canonical_size_exceeded';
export class CanonicalizationError extends Error {
  readonly code: CanonicalizationErrorCode;
  readonly path: string;
  constructor(code: CanonicalizationErrorCode, message: string, path = '$') {
    super(message); this.name = 'CanonicalizationError'; this.code = code; this.path = path;
  }
}

const encoder = new TextEncoder();

function rejectUnpairedSurrogates(value: string, path: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new CanonicalizationError('invalid_canonical_input', 'I-JSON strings must not contain lone surrogates.', path);
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) throw new CanonicalizationError('invalid_canonical_input', 'I-JSON strings must not contain lone surrogates.', path);
  }
}

function serialize(value: JsonValue, path: string): string {
  if (value === null || typeof value === 'boolean') return String(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new CanonicalizationError('invalid_canonical_input', 'Numbers must be finite.', path);
    return JSON.stringify(value);
  }
  if (typeof value === 'string') { rejectUnpairedSurrogates(value, path); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map((item, index) => serialize(item, `${path}[${index}]`)).join(',')}]`;
  const record = value as Readonly<Record<string, JsonValue>>;
  const keys = Object.keys(record).sort();
  for (const key of keys) rejectUnpairedSurrogates(key, `${path}.${key}`);
  return `{${keys.map((key) => `${JSON.stringify(key)}:${serialize(record[key], `${path}.${key}`)}`).join(',')}}`;
}

/** RFC 8785 JCS over bounded, inspected I-JSON-compatible input. */
export function canonicalizeJson(input: unknown, maxUtf8Bytes: number = CANONICAL_JSON_LIMITS.maxUtf8Bytes): Uint8Array {
  if (!Number.isSafeInteger(maxUtf8Bytes) || maxUtf8Bytes < 0 || maxUtf8Bytes > CANONICAL_JSON_LIMITS.maxUtf8Bytes) {
    throw new CanonicalizationError('canonical_size_exceeded', 'Canonical byte limit is outside the approved bound.');
  }
  const inspected = inspectJsonCompatibleInput(input);
  if (!inspected.ok) throw new CanonicalizationError('invalid_canonical_input', inspected.error.message, inspected.error.path);
  // UTF-8 may use at most three bytes per UTF-16 code unit for valid JSON source.
  if (inspected.value.usage.cumulativeStringCodeUnits * 3 > maxUtf8Bytes
    && inspected.value.usage.cumulativeStringCodeUnits > maxUtf8Bytes) {
    throw new CanonicalizationError('canonical_size_exceeded', 'Input cannot fit within the canonical byte limit.');
  }
  let serialized: string;
  try { serialized = serialize(inspected.value.data, '$'); }
  catch (error) { if (error instanceof CanonicalizationError) throw error; throw new CanonicalizationError('invalid_canonical_input', 'Input could not be canonicalized.'); }
  const bytes = encoder.encode(serialized);
  if (bytes.byteLength > maxUtf8Bytes) throw new CanonicalizationError('canonical_size_exceeded', 'Canonical JSON exceeds the byte limit.');
  return bytes;
}

export function canonicalJsonText(input: unknown, maxUtf8Bytes?: number): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(canonicalizeJson(input, maxUtf8Bytes));
}
