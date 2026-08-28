import { inspectJsonCompatibleInput, isCredentialFieldName, type JsonRecord, type JsonValue } from './untrusted-json.ts';

export const DOMAIN_ID_MAX = 128;
export const DOMAIN_REF_MAX = 256;
export const DOMAIN_REASON_MAX = 512;
export const DOMAIN_VERSION_MAX = 128;
export const DOMAIN_TIMESTAMP_MAX = 24;
export const DOMAIN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
export const DOMAIN_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/;
export const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const UTC_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/;

export interface DomainError {
  readonly code: string;
  readonly message: string;
  readonly path: string;
  readonly inputIndex?: number;
  readonly entityRef?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type DomainResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: DomainError }>;

export function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}

export function ok<T>(value: T): DomainResult<T> { return Object.freeze({ ok: true, value: deepFreeze(value) }); }
export function fail<T>(code: string, message: string, path: string, detail: Partial<DomainError> = {}): DomainResult<T> {
  return Object.freeze({ ok: false, error: deepFreeze({ code, message, path, ...detail }) });
}

export function snapshot(input: unknown): DomainResult<JsonValue> {
  const inspected = inspectJsonCompatibleInput(input);
  return inspected.ok ? ok(inspected.value.data) : inspected;
}
export function isRecord(value: JsonValue | undefined): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function record(value: JsonValue | undefined, path: string): DomainResult<JsonRecord> {
  return isRecord(value) ? ok(value) : fail('invalid_input', 'Value must be a non-null JSON object.', path);
}
export function shape(value: JsonRecord, allowed: readonly string[], path: string): DomainResult<JsonRecord> {
  const set = new Set(allowed);
  for (const key of Object.keys(value)) if (!set.has(key)) {
    const credential = isCredentialFieldName(key);
    return fail(credential ? 'credential_field' : 'unknown_field', credential
      ? 'Credential-bearing fields are forbidden at this boundary.' : 'Unknown field is not allowed by this contract.', `${path}.${key}`);
  }
  return ok(value);
}
export function identifier(value: JsonValue | undefined, path: string): DomainResult<string> {
  return typeof value === 'string' && value.length > 0 && value.length <= DOMAIN_ID_MAX && DOMAIN_ID_PATTERN.test(value)
    ? ok(value) : fail('invalid_identifier', `Identifier must be 1-${DOMAIN_ID_MAX} canonical characters.`, path);
}
export function reference(value: JsonValue | undefined, path: string, max = DOMAIN_REF_MAX): DomainResult<string> {
  return typeof value === 'string' && value.length > 0 && value.length <= max && DOMAIN_REF_PATTERN.test(value)
    ? ok(value) : fail('invalid_reference', `Reference must be 1-${max} opaque reference characters.`, path);
}
export function boundedText(value: JsonValue | undefined, path: string, max: number): DomainResult<string> {
  return typeof value === 'string' && value.length > 0 && value.length <= max
    ? ok(value) : fail('invalid_input', `Text must contain 1-${max} characters.`, path);
}
export function timestamp(value: JsonValue | undefined, path: string): DomainResult<{ canonical: string; milliseconds: number }> {
  if (typeof value !== 'string' || value.length > DOMAIN_TIMESTAMP_MAX || !UTC_PATTERN.test(value))
    return fail('invalid_timestamp', 'Timestamp must be canonical UTC ISO-8601 with milliseconds.', path);
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value
    ? ok({ canonical: value, milliseconds }) : fail('invalid_timestamp', 'Timestamp is not a valid canonical UTC instant.', path);
}
export function stringArray(value: JsonValue | undefined, path: string, max: number, validator = reference): DomainResult<readonly string[]> {
  if (!Array.isArray(value)) return fail('invalid_input', 'Value must be an array.', path);
  if (value.length === 0 || value.length > max) return fail('limit_exceeded', `Array must contain 1-${max} entries.`, path, { metadata: { limit: max, actual: value.length } });
  const output: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const parsed = validator(value[index], `${path}[${index}]`);
    if (!parsed.ok) return { ok: false, error: deepFreeze({ ...parsed.error, inputIndex: index }) };
    if (seen.has(parsed.value)) return fail('duplicate_reference', 'Duplicate references are not allowed.', `${path}[${index}]`, { inputIndex: index, entityRef: parsed.value });
    seen.add(parsed.value); output.push(parsed.value);
  }
  return ok(output);
}
