import { canonicalizeJson } from './canonical-json.ts';
import { deepFreeze, fail, ok, snapshot, timestamp, type DomainResult } from './domain-validation.ts';
import { calculateDeleteAfter, RETENTION_CONTRACT_VERSION, validateRightsSchedule, type IntelligenceRecordType, type RightsSchedule } from './intelligence-rights.ts';
import type { JsonValue } from './untrusted-json.ts';

export const INTELLIGENCE_RECORD_SCHEMA_VERSION = 'mk-intelligence-record-jcs/1';
export const INTELLIGENCE_RECORD_CONTRACT_VERSION = 'authenticated-intelligence-record/1';
export const HMAC_ALGORITHM = 'HMAC-SHA-256';
export const HMAC_DOMAIN_SEPARATOR = 'MKALMA\0INTELLIGENCE_RECORD\0HMAC_SHA256\0v1\0';
export const RECORD_LIMITS = Object.freeze({ maxPayloadBytes: 49_152, maxParentRefs: 16, maxRecordIdLength: 128, maxVersionIdLength: 64, maxReferenceLength: 256, maxAuditMetadataBytes: 2_048, maxQuarantineMetadataBytes: 2_048 } as const);
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const HEX = /^[0-9a-f]+$/;

export type KeyStatus = 'active' | 'verify-only' | 'revoked' | 'unavailable';
export interface VerificationKey { readonly environmentId: string; readonly keyId: string; readonly algorithm: typeof HMAC_ALGORITHM; readonly status: KeyStatus; readonly activatesAt: string; readonly verifyUntil?: string; readonly cryptoKey: CryptoKey }
export interface SigningKey extends VerificationKey { readonly status: 'active' }
export interface IntelligenceVerificationKeyProvider { getVerificationKey(environmentId: string, keyId: string, at: string): Promise<VerificationKey | undefined> }
export interface IntelligenceSigningKeyProvider { getActiveSigningKey(environmentId: string, at: string): Promise<SigningKey | undefined> }

export interface IntelligenceRecordHeader {
  readonly recordType: IntelligenceRecordType; readonly recordId: string; readonly schemaVersion: typeof INTELLIGENCE_RECORD_SCHEMA_VERSION;
  readonly contractVersion: typeof INTELLIGENCE_RECORD_CONTRACT_VERSION; readonly environmentId: string; readonly streamId: string;
  readonly parentRefs: readonly string[]; readonly correctsRecordId?: string; readonly issuedAt: string; readonly validatedAt: string;
  readonly issuer: string; readonly keyId: string; readonly rightsScheduleId: string; readonly retentionPolicyVersion: typeof RETENTION_CONTRACT_VERSION;
  readonly providerDisposition: 'not_provider_derived'; readonly deleteAfter?: string; readonly indefiniteBasis?: 'project_owned_synthetic_fixture';
  readonly legalHold: false; readonly replayMode: 'full_payload_retained';
}
export interface AuthenticatedIntelligenceRecord extends IntelligenceRecordHeader { readonly payload: JsonValue; readonly contentHash: string; readonly authenticationTag: string }
export interface IssueRecordInput extends Omit<IntelligenceRecordHeader, 'schemaVersion' | 'contractVersion' | 'keyId' | 'rightsScheduleId' | 'retentionPolicyVersion' | 'providerDisposition' | 'deleteAfter' | 'indefiniteBasis' | 'legalHold' | 'replayMode'> { readonly payload: unknown; readonly rightsSchedule: unknown }

const encoder = new TextEncoder();
function exactBuffer(bytes: Uint8Array): ArrayBuffer { const copy = new Uint8Array(bytes.byteLength); copy.set(bytes); return copy.buffer; }
function hex(bytes: ArrayBuffer | Uint8Array): string { return [...new Uint8Array(bytes instanceof Uint8Array ? exactBuffer(bytes) : bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join(''); }
function frame(header: Uint8Array, payload: Uint8Array): Uint8Array {
  const domain = encoder.encode(HMAC_DOMAIN_SEPARATOR); const output = new Uint8Array(domain.length + 8 + header.length + payload.length); output.set(domain);
  const view = new DataView(output.buffer); view.setUint32(domain.length, header.length, false); output.set(header, domain.length + 4); view.setUint32(domain.length + 4 + header.length, payload.length, false); output.set(payload, domain.length + 8 + header.length); return output;
}
export function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean { let different = left.length ^ right.length; const length = Math.max(left.length, right.length); for (let index = 0; index < length; index += 1) different |= (left[index % (left.length || 1)] ?? 0) ^ (right[index % (right.length || 1)] ?? 0); return different === 0; }
function headerOf(record: AuthenticatedIntelligenceRecord | IntelligenceRecordHeader): IntelligenceRecordHeader { const { recordType, recordId, schemaVersion, contractVersion, environmentId, streamId, parentRefs, issuedAt, validatedAt, issuer, keyId, rightsScheduleId, retentionPolicyVersion, providerDisposition, legalHold, replayMode } = record; return { recordType, recordId, schemaVersion, contractVersion, environmentId, streamId, parentRefs, ...(record.correctsRecordId ? { correctsRecordId: record.correctsRecordId } : {}), issuedAt, validatedAt, issuer, keyId, rightsScheduleId, retentionPolicyVersion, providerDisposition, ...(record.deleteAfter ? { deleteAfter: record.deleteAfter } : {}), ...(record.indefiniteBasis ? { indefiniteBasis: record.indefiniteBasis } : {}), legalHold, replayMode }; }
function parseId(value: unknown, path: string, max: number = RECORD_LIMITS.maxRecordIdLength): DomainResult<string> { return typeof value === 'string' && value.length > 0 && value.length <= max && ID.test(value) ? ok(value) : fail('invalid_record', 'Invalid bounded identifier.', path); }

export function validateRecordHeader(input: unknown): DomainResult<IntelligenceRecordHeader> {
  const safe = snapshot(input); if (!safe.ok) return fail('malformed_envelope', safe.error.message, safe.error.path);
  if (typeof safe.value !== 'object' || safe.value === null || Array.isArray(safe.value)) return fail('malformed_envelope', 'Header must be an object.', '$');
  const value = safe.value as Record<string, unknown>; const allowed = new Set(['recordType','recordId','schemaVersion','contractVersion','environmentId','streamId','parentRefs','correctsRecordId','issuedAt','validatedAt','issuer','keyId','rightsScheduleId','retentionPolicyVersion','providerDisposition','deleteAfter','indefiniteBasis','legalHold','replayMode']);
  for (const key of Object.keys(value)) if (!allowed.has(key)) return fail('unknown_field', 'Unknown authenticated header field.', `$.${key}`);
  if (value.recordType !== 'market_observation' && value.recordType !== 'canonical_result_observation') return fail('unsupported_record_type', 'Record type is unsupported.', '$.recordType');
  for (const [field, max] of [['recordId',128],['environmentId',128],['streamId',128],['issuer',128],['keyId',64],['rightsScheduleId',128]] as const) { const parsed = parseId(value[field], `$.${field}`, max); if (!parsed.ok) return parsed; }
  if (value.schemaVersion !== INTELLIGENCE_RECORD_SCHEMA_VERSION || value.contractVersion !== INTELLIGENCE_RECORD_CONTRACT_VERSION || value.retentionPolicyVersion !== RETENTION_CONTRACT_VERSION) return fail('unsupported_version', 'Envelope version is unsupported.', '$');
  if (!Array.isArray(value.parentRefs) || value.parentRefs.length > RECORD_LIMITS.maxParentRefs) return fail('parent_limit_exceeded', 'Parent reference limit exceeded.', '$.parentRefs');
  const parentRefs: string[] = []; for (let index = 0; index < value.parentRefs.length; index += 1) { const parsed = parseId(value.parentRefs[index], `$.parentRefs[${index}]`); if (!parsed.ok) return parsed; if (index && parentRefs[index - 1] >= parsed.value) return fail('invalid_parent_order', 'Parent references must be unique and canonically ordered.', `$.parentRefs[${index}]`); parentRefs.push(parsed.value); }
  const issued = timestamp(value.issuedAt as never, '$.issuedAt'); if (!issued.ok) return issued; const validated = timestamp(value.validatedAt as never, '$.validatedAt'); if (!validated.ok) return validated; if (validated.value.milliseconds < issued.value.milliseconds) return fail('invalid_time_order', 'validatedAt cannot precede issuedAt.', '$.validatedAt');
  if (value.providerDisposition !== 'not_provider_derived' || value.legalHold !== false || value.replayMode !== 'full_payload_retained') return fail('contradictory_fields', 'Provider, legal-hold or replay disposition is not approved.', '$');
  if ((value.deleteAfter === undefined) === (value.indefiniteBasis === undefined)) return fail('contradictory_fields', 'Exactly one retention endpoint or indefinite basis is required.', '$');
  if (value.deleteAfter !== undefined) { const deletion = timestamp(value.deleteAfter as never, '$.deleteAfter'); if (!deletion.ok) return deletion; if (deletion.value.milliseconds <= issued.value.milliseconds) return fail('invalid_retention', 'deleteAfter must follow issuedAt.', '$.deleteAfter'); }
  if (value.indefiniteBasis !== undefined && value.indefiniteBasis !== 'project_owned_synthetic_fixture') return fail('invalid_retention', 'Indefinite basis is unsupported.', '$.indefiniteBasis');
  if (value.correctsRecordId !== undefined) { const correction = parseId(value.correctsRecordId, '$.correctsRecordId'); if (!correction.ok) return correction; if (!parentRefs.includes(correction.value)) return fail('correction_parent_required', 'Correction target must also be a parent.', '$.correctsRecordId'); }
  return ok(deepFreeze({ ...value, parentRefs } as unknown as IntelligenceRecordHeader));
}

export async function issueAuthenticatedRecord(input: IssueRecordInput, keys: IntelligenceSigningKeyProvider): Promise<DomainResult<AuthenticatedIntelligenceRecord>> {
  const rights = validateRightsSchedule(input.rightsSchedule); if (!rights.ok) return rights;
  if (!rights.value.permittedRecordTypes.includes(input.recordType)) return fail('record_type_not_permitted', 'Rights schedule does not permit this record type.', '$.recordType');
  const key = await keys.getActiveSigningKey(input.environmentId, input.issuedAt); if (!key || key.status !== 'active' || key.environmentId !== input.environmentId || key.algorithm !== HMAC_ALGORITHM) return fail('signing_key_unavailable', 'No permitted active signing key is available.', '$.keyId');
  const deleteAfter = calculateDeleteAfter(rights.value, input.issuedAt);
  const header = { ...input, payload: undefined, rightsSchedule: undefined, schemaVersion: INTELLIGENCE_RECORD_SCHEMA_VERSION, contractVersion: INTELLIGENCE_RECORD_CONTRACT_VERSION, keyId: key.keyId, rightsScheduleId: rights.value.scheduleId, retentionPolicyVersion: RETENTION_CONTRACT_VERSION, providerDisposition: 'not_provider_derived' as const, ...(deleteAfter ? { deleteAfter } : { indefiniteBasis: rights.value.indefiniteBasis }), legalHold: false as const, replayMode: 'full_payload_retained' as const };
  delete (header as { payload?: unknown }).payload; delete (header as { rightsSchedule?: unknown }).rightsSchedule;
  const parsed = validateRecordHeader(header); if (!parsed.ok) return parsed;
  let payloadBytes: Uint8Array; try { payloadBytes = canonicalizeJson(input.payload, RECORD_LIMITS.maxPayloadBytes); } catch (error) { return fail(error instanceof Error && 'code' in error ? String(error.code) : 'invalid_payload', 'Payload is not bounded canonical JSON.', '$.payload'); }
  const contentHash = `sha256:${hex(await crypto.subtle.digest('SHA-256', exactBuffer(payloadBytes)))}`;
  const mac = await crypto.subtle.sign('HMAC', key.cryptoKey, exactBuffer(frame(canonicalizeJson(parsed.value), payloadBytes)));
  return ok(deepFreeze({ ...parsed.value, payload: JSON.parse(new TextDecoder().decode(payloadBytes)) as JsonValue, contentHash, authenticationTag: `hmac-sha256:${hex(mac)}` }));
}

export async function verifyAuthenticatedRecord(input: unknown, expectedEnvironment: string, keys: IntelligenceVerificationKeyProvider): Promise<DomainResult<AuthenticatedIntelligenceRecord>> {
  const safe = snapshot(input); if (!safe.ok) return fail('malformed_envelope', safe.error.message, safe.error.path);
  if (typeof safe.value !== 'object' || safe.value === null || Array.isArray(safe.value)) return fail('malformed_envelope', 'Envelope must be an object.', '$');
  const value = safe.value as Record<string, unknown>; const allowed = new Set([...Object.keys(headerOf(value as unknown as AuthenticatedIntelligenceRecord)), 'payload','contentHash','authenticationTag']);
  for (const key of Object.keys(value)) if (!allowed.has(key)) return fail('unknown_field', 'Unknown envelope field.', `$.${key}`);
  if (!Object.hasOwn(value, 'payload') || typeof value.contentHash !== 'string' || typeof value.authenticationTag !== 'string') return fail('malformed_envelope', 'Payload, hash and authentication tag are required.', '$');
  const header = validateRecordHeader(headerOf(value as unknown as AuthenticatedIntelligenceRecord)); if (!header.ok) return header; if (header.value.environmentId !== expectedEnvironment) return fail('wrong_environment', 'Record environment does not match reader environment.', '$.environmentId');
  let payloadBytes: Uint8Array; try { payloadBytes = canonicalizeJson(value.payload, RECORD_LIMITS.maxPayloadBytes); } catch { return fail('malformed_envelope', 'Payload is not bounded canonical JSON.', '$.payload'); }
  const actualHash = `sha256:${hex(await crypto.subtle.digest('SHA-256', exactBuffer(payloadBytes)))}`; if (!constantTimeEqual(encoder.encode(actualHash), encoder.encode(value.contentHash))) return fail('hash_mismatch', 'Content hash verification failed.', '$.contentHash');
  const key = await keys.getVerificationKey(expectedEnvironment, header.value.keyId, header.value.issuedAt); if (!key) return fail('unknown_key', 'Verification key is unavailable.', '$.keyId'); if (key.environmentId !== expectedEnvironment) return fail('wrong_environment', 'Key belongs to another environment.', '$.keyId'); if (key.status === 'revoked' || key.status === 'unavailable') return fail('revoked_key', 'Verification key is not permitted.', '$.keyId');
  if (Date.parse(header.value.issuedAt) < Date.parse(key.activatesAt) || (key.verifyUntil && Date.parse(header.value.issuedAt) >= Date.parse(key.verifyUntil))) return fail('key_period_invalid', 'Record falls outside the key verification period.', '$.issuedAt');
  if (!value.authenticationTag.startsWith('hmac-sha256:') || value.authenticationTag.length !== 76 || !HEX.test(value.authenticationTag.slice(12))) return fail('malformed_envelope', 'Authentication tag encoding is invalid.', '$.authenticationTag');
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key.cryptoKey, exactBuffer(frame(canonicalizeJson(header.value), payloadBytes)))); const supplied = Uint8Array.from(value.authenticationTag.slice(12).match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
  if (!constantTimeEqual(expected, supplied)) return fail('mac_mismatch', 'Authentication verification failed.', '$.authenticationTag');
  return ok(deepFreeze({ ...header.value, payload: JSON.parse(new TextDecoder().decode(payloadBytes)) as JsonValue, contentHash: actualHash, authenticationTag: value.authenticationTag }));
}

export type { RightsSchedule };
