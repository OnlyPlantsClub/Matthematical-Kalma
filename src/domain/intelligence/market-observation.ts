import {
  MAX_MARKET_OUTCOMES, MAX_OBSERVATION_REF_LENGTH, MAX_OUTCOME_ID_LENGTH,
  type MarketPriceInput, validateDecimalOdds,
} from './odds.ts';

export const MAX_CANONICAL_ID_LENGTH = 128;
export const MAX_SOURCE_REFERENCE_LENGTH = 256;
export const MAX_SOURCE_VERSION_LENGTH = 128;
export const MAX_REPLAY_LIMITATION_LENGTH = 512;
export const MAX_TIMESTAMP_LENGTH = 24;
export const SOURCE_ENVELOPE_CONTRACT_VERSION = 'source-envelope-v1';

export const BASELINE_FRESHNESS_POLICY = Object.freeze({
  id: 'baseline-pre-match', version: '1', maxAgeMilliseconds: 60_000,
} as const);

export type ObservationErrorCode =
  | 'invalid_input' | 'unknown_field' | 'credential_field' | 'invalid_identifier' | 'invalid_reference'
  | 'invalid_provenance' | 'invalid_replay_contract' | 'invalid_timestamp' | 'invalid_time_order'
  | 'future_observation' | 'post_start' | 'unsupported_policy' | 'invalid_market' | 'incomplete_market'
  | 'stale_observation' | 'suspended_market' | 'suspended_outcome' | 'invalid_outcome'
  | 'duplicate_outcome' | 'identity_conflict' | 'invalid_price' | 'market_limit_exceeded' | 'unavailable_price';

export interface ObservationError {
  readonly code: ObservationErrorCode;
  readonly message: string;
  readonly path: string;
  readonly inputIndex?: number;
  readonly outcomeId?: string;
  readonly metadata?: Readonly<{ inputIndex?: number; outcomeId?: string }>;
}

export type ObservationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: Readonly<ObservationError> }>;

export interface SourceRetention {
  readonly replayMode: 'full_payload_retained' | 'hash_and_retrievable_locator' | 'hash_only_verification' | 'not_fully_replayable';
  readonly payloadHash: string;
  readonly payloadLocator?: string;
  readonly limitationReason?: string;
}

export interface SourceEnvelope {
  readonly contractVersion: typeof SOURCE_ENVELOPE_CONTRACT_VERSION;
  readonly sourceId: string;
  readonly providerRef: string;
  readonly sourceSchemaVersion: string;
  readonly termsRef: string;
  readonly adapter: Readonly<{ id: string; version: string }>;
  readonly retrievalMethod: 'licensed_api' | 'file_import' | 'manual';
  readonly observedAt: string;
  readonly effectiveAt: string;
  readonly receivedAt: string;
  readonly retention: SourceRetention;
}

export interface FreshnessClassification {
  readonly classification: 'current' | 'stale';
  readonly reason: 'within_maximum_age' | 'maximum_age_exceeded';
  readonly policy: typeof BASELINE_FRESHNESS_POLICY;
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly eventStartAt: string;
  readonly asOf: string;
  readonly ageMilliseconds: number;
  readonly ingestionDelayMilliseconds: number;
  readonly millisecondsUntilStart: number;
}

export interface NormalizedMarketOutcome {
  readonly outcomeId: string;
  readonly decimalOdds?: string;
  readonly decimalOddsMicros?: string;
  readonly availability: 'active' | 'suspended' | 'unavailable';
  readonly observationRef: string;
  readonly sourceSequence?: string;
  readonly freshness: FreshnessClassification;
}

export interface NormalizedMarketSnapshot {
  readonly contractVersion: 'market-observation-v1';
  readonly sourceEnvelope: SourceEnvelope;
  readonly sportId: string;
  readonly competitionId: string;
  readonly eventId: string;
  readonly marketId: string;
  readonly eventStartAt: string;
  readonly observedAt: string;
  readonly effectiveAt: string;
  readonly receivedAt: string;
  readonly asOf: string;
  readonly completeness: 'complete' | 'incomplete';
  readonly marketAvailability: 'active' | 'suspended' | 'unavailable';
  readonly freshnessPolicy: typeof BASELINE_FRESHNESS_POLICY;
  readonly outcomes: readonly NormalizedMarketOutcome[];
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonRecord | JsonValue[];
type JsonRecord = { [key: string]: JsonValue };

const CANONICAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const UTC_MILLISECOND_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/;
const CREDENTIAL_FIELD_NAMES = new Set([
  'apikey', 'apikeys', 'accesstoken', 'accesstokens', 'refreshtoken', 'refreshtokens', 'clientsecret',
  'clientsecrets', 'password', 'passwords', 'credential', 'credentials', 'authorization', 'authorizationfield',
  'authorizationfields', 'authorizationheader', 'authorizationheaders', 'bearer', 'bearertoken', 'bearertokens',
  'bearervalue', 'bearervalues', 'cookie', 'cookies', 'setcookie',
]);
const MAX_UNTRUSTED_DEPTH = 8;
const MAX_UNTRUSTED_KEYS = 64;
const MAX_UNTRUSTED_ARRAY_LENGTH = MAX_MARKET_OUTCOMES + 1;
const MAX_UNTRUSTED_STRING_LENGTH = 1_024;

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}

function success<T>(value: T): ObservationResult<T> {
  return Object.freeze({ ok: true, value: deepFreeze(value) });
}

function failure<T>(code: ObservationErrorCode, message: string, path: string, context: Partial<ObservationError> = {}): ObservationResult<T> {
  const metadata = context.inputIndex === undefined && context.outcomeId === undefined
    ? undefined
    : { ...(context.inputIndex === undefined ? {} : { inputIndex: context.inputIndex }), ...(context.outcomeId === undefined ? {} : { outcomeId: context.outcomeId }) };
  const error = deepFreeze({ code, message, path, ...context, ...(metadata ? { metadata } : {}) });
  return Object.freeze({ ok: false, error });
}

function unsafeCloneJsonCompatible(input: unknown, path: string, depth: number): ObservationResult<JsonValue> {
  if (input === null || typeof input === 'boolean') return success(input);
  if (typeof input === 'string') {
    if (input.length > MAX_UNTRUSTED_STRING_LENGTH) return failure('invalid_input', 'Untrusted string exceeds the boundary limit.', path);
    return success(input);
  }
  if (typeof input === 'number') return Number.isFinite(input)
    ? success(input)
    : failure('invalid_input', 'Untrusted numeric values must be finite.', path);
  if (typeof input !== 'object' || input === null || depth > MAX_UNTRUSTED_DEPTH) {
    return failure('invalid_input', 'Input must contain only bounded JSON-compatible values.', path);
  }

  const prototype = Object.getPrototypeOf(input);
  if (Array.isArray(input)) {
    if (prototype !== Array.prototype) return failure('invalid_input', 'Arrays must use the standard Array prototype.', path);
    if (input.length > MAX_UNTRUSTED_ARRAY_LENGTH) return failure('market_limit_exceeded', `An input array must not exceed ${MAX_UNTRUSTED_ARRAY_LENGTH} entries.`, path);
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.some((key) => typeof key === 'symbol')) return failure('invalid_input', 'Symbol keys are not supported.', path);
    const clone: JsonValue[] = [];
    for (let index = 0; index < input.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) return failure('invalid_input', 'Arrays must be dense data-only arrays.', `${path}[${index}]`, { inputIndex: index });
      const cloned = unsafeCloneJsonCompatible(descriptor.value, `${path}[${index}]`, depth + 1);
      if (!cloned.ok) return cloned;
      clone.push(cloned.value);
    }
    const unexpected = keys.filter((key) => key !== 'length' && !/^(?:0|[1-9]\d*)$/.test(String(key)));
    if (unexpected.length > 0) return failure('unknown_field', 'Arrays must not contain named properties.', `${path}.${String(unexpected[0])}`);
    return success(clone);
  }

  if (prototype !== Object.prototype && prototype !== null) return failure('invalid_input', 'Records must be plain JSON-compatible objects.', path);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length > MAX_UNTRUSTED_KEYS) return failure('invalid_input', 'Object contains too many fields.', path);
  const clone: JsonRecord = Object.create(null) as JsonRecord;
  for (const key of keys) {
    if (typeof key !== 'string') return failure('invalid_input', 'Symbol keys are not supported.', path);
    const descriptor = descriptors[key];
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return failure('invalid_input', 'Accessor properties are not supported.', `${path}.${key}`);
    if (CREDENTIAL_FIELD_NAMES.has(normalizedFieldName(key))) {
      return failure('credential_field', 'Credential-bearing fields are forbidden at this boundary.', `${path}.${key}`);
    }
    const cloned = unsafeCloneJsonCompatible(descriptor.value, `${path}.${key}`, depth + 1);
    if (!cloned.ok) return cloned;
    clone[key] = cloned.value;
  }
  return success(clone);
}

function snapshotUntrusted(input: unknown): ObservationResult<JsonValue> {
  try {
    return unsafeCloneJsonCompatible(input, '$', 0);
  } catch {
    return failure('invalid_input', 'Input could not be safely inspected as JSON-compatible data.', '$');
  }
}

function isRecord(input: JsonValue | undefined): input is JsonRecord {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function normalizedFieldName(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function validateShape(input: JsonRecord, allowed: readonly string[], path: string): ObservationResult<JsonRecord> {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(input)) {
    if (allowedSet.has(key)) continue;
    const credentialLike = CREDENTIAL_FIELD_NAMES.has(normalizedFieldName(key));
    return failure(
      credentialLike ? 'credential_field' : 'unknown_field',
      credentialLike ? 'Credential-bearing fields are forbidden at this boundary.' : 'Unknown field is not allowed by this contract.',
      `${path}.${key}`,
    );
  }
  return success(input);
}

function requireRecord(input: JsonValue | undefined, path: string): ObservationResult<JsonRecord> {
  return isRecord(input) ? success(input) : failure('invalid_input', 'Value must be a non-null JSON object.', path);
}

function parseTimestamp(input: JsonValue | undefined, path: string): ObservationResult<{ canonical: string; milliseconds: number }> {
  if (typeof input !== 'string' || input.length > MAX_TIMESTAMP_LENGTH || !UTC_MILLISECOND_PATTERN.test(input)) {
    return failure('invalid_timestamp', 'Timestamp must be canonical UTC ISO-8601 with milliseconds (YYYY-MM-DDTHH:mm:ss.sssZ).', path);
  }
  const milliseconds = Date.parse(input);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== input) return failure('invalid_timestamp', 'Timestamp is not a valid canonical UTC instant.', path);
  return success({ canonical: input, milliseconds });
}

function validateIdentifier(input: JsonValue | undefined, path: string, maxLength = MAX_CANONICAL_ID_LENGTH): ObservationResult<string> {
  if (typeof input !== 'string' || input.length === 0 || input.length > maxLength || !CANONICAL_ID_PATTERN.test(input)) {
    return failure('invalid_identifier', `Identifier must be 1-${maxLength} canonical characters.`, path);
  }
  return success(input);
}

function validateReference(input: JsonValue | undefined, path: string, maxLength: number): ObservationResult<string> {
  if (typeof input !== 'string' || input.length === 0 || input.length > maxLength || !REFERENCE_PATTERN.test(input)) {
    return failure('invalid_reference', `Reference must be 1-${maxLength} opaque reference characters.`, path);
  }
  return success(input);
}

function validatePolicyTrusted(input: JsonValue | undefined, path: string): ObservationResult<typeof BASELINE_FRESHNESS_POLICY> {
  const record = requireRecord(input, path);
  if (!record.ok) return record;
  const shape = validateShape(record.value, ['id', 'version', 'maxAgeMilliseconds'], path);
  if (!shape.ok) return shape;
  if (record.value.id !== BASELINE_FRESHNESS_POLICY.id || record.value.version !== BASELINE_FRESHNESS_POLICY.version
    || record.value.maxAgeMilliseconds !== BASELINE_FRESHNESS_POLICY.maxAgeMilliseconds) {
    return failure('unsupported_policy', 'Only the exact baseline-pre-match freshness policy version 1 is supported.', path);
  }
  return success(BASELINE_FRESHNESS_POLICY);
}

function classifyFreshnessTrusted(input: JsonRecord): ObservationResult<FreshnessClassification> {
  const shape = validateShape(input, ['policy', 'observedAt', 'receivedAt', 'eventStartAt', 'asOf'], '$');
  if (!shape.ok) return shape;
  const policy = validatePolicyTrusted(input.policy, '$.policy');
  if (!policy.ok) return policy;
  const observedAt = parseTimestamp(input.observedAt, '$.observedAt');
  if (!observedAt.ok) return observedAt;
  const receivedAt = parseTimestamp(input.receivedAt, '$.receivedAt');
  if (!receivedAt.ok) return receivedAt;
  const eventStartAt = parseTimestamp(input.eventStartAt, '$.eventStartAt');
  if (!eventStartAt.ok) return eventStartAt;
  const asOf = parseTimestamp(input.asOf, '$.asOf');
  if (!asOf.ok) return asOf;
  if (observedAt.value.milliseconds > asOf.value.milliseconds) return failure('future_observation', 'Observation time cannot be after evaluation time.', '$.observedAt');
  if (receivedAt.value.milliseconds < observedAt.value.milliseconds) return failure('invalid_time_order', 'Receipt time cannot precede observation time.', '$.receivedAt');
  if (receivedAt.value.milliseconds > asOf.value.milliseconds) return failure('invalid_time_order', 'Receipt time cannot be after evaluation time.', '$.receivedAt');
  if (asOf.value.milliseconds >= eventStartAt.value.milliseconds) return failure('post_start', 'Pre-match evaluation time must be strictly before event start time.', '$.asOf');
  const ageMilliseconds = asOf.value.milliseconds - observedAt.value.milliseconds;
  const current = ageMilliseconds <= policy.value.maxAgeMilliseconds;
  return success({
    classification: current ? 'current' : 'stale', reason: current ? 'within_maximum_age' : 'maximum_age_exceeded',
    policy: policy.value, observedAt: observedAt.value.canonical, receivedAt: receivedAt.value.canonical,
    eventStartAt: eventStartAt.value.canonical, asOf: asOf.value.canonical, ageMilliseconds,
    ingestionDelayMilliseconds: receivedAt.value.milliseconds - observedAt.value.milliseconds,
    millisecondsUntilStart: eventStartAt.value.milliseconds - asOf.value.milliseconds,
  });
}

export function classifyObservationFreshness(input: unknown): ObservationResult<FreshnessClassification> {
  const snapshot = snapshotUntrusted(input);
  if (!snapshot.ok) return snapshot;
  const record = requireRecord(snapshot.value, '$');
  return record.ok ? classifyFreshnessTrusted(record.value) : record;
}

function validateRetention(input: JsonValue | undefined, path: string): ObservationResult<SourceRetention> {
  const record = requireRecord(input, path);
  if (!record.ok) return record;
  const shape = validateShape(record.value, ['replayMode', 'payloadHash', 'payloadLocator', 'limitationReason'], path);
  if (!shape.ok) return shape;
  const replayMode = record.value.replayMode;
  if (replayMode !== 'full_payload_retained' && replayMode !== 'hash_and_retrievable_locator'
    && replayMode !== 'hash_only_verification' && replayMode !== 'not_fully_replayable') {
    return failure('invalid_replay_contract', 'Replay mode is not supported.', `${path}.replayMode`);
  }
  if (typeof record.value.payloadHash !== 'string' || !SHA256_PATTERN.test(record.value.payloadHash)) {
    return failure('invalid_provenance', 'payloadHash must be canonical lowercase sha256:<64 hex>.', `${path}.payloadHash`);
  }
  let payloadLocator: string | undefined;
  if (record.value.payloadLocator !== undefined) {
    const locator = validateReference(record.value.payloadLocator, `${path}.payloadLocator`, MAX_SOURCE_REFERENCE_LENGTH);
    if (!locator.ok) return locator;
    payloadLocator = locator.value;
  }
  let limitationReason: string | undefined;
  if (record.value.limitationReason !== undefined) {
    if (typeof record.value.limitationReason !== 'string' || record.value.limitationReason.length === 0
      || record.value.limitationReason.length > MAX_REPLAY_LIMITATION_LENGTH) {
      return failure('invalid_replay_contract', `limitationReason must be 1-${MAX_REPLAY_LIMITATION_LENGTH} characters.`, `${path}.limitationReason`);
    }
    limitationReason = record.value.limitationReason;
  }
  if ((replayMode === 'full_payload_retained' || replayMode === 'hash_and_retrievable_locator') && !payloadLocator) {
    return failure('invalid_replay_contract', 'This replay mode requires an immutable payload locator.', `${path}.payloadLocator`);
  }
  if (replayMode === 'hash_only_verification' && (payloadLocator || limitationReason)) return failure('invalid_replay_contract', 'Hash-only verification permits neither a locator nor a limitation reason.', path);
  if (replayMode === 'not_fully_replayable' && !limitationReason) return failure('invalid_replay_contract', 'Non-replayable provenance requires an explicit limitation reason.', `${path}.limitationReason`);
  if (replayMode !== 'not_fully_replayable' && limitationReason) return failure('invalid_replay_contract', 'A limitation reason is only valid for not_fully_replayable mode.', `${path}.limitationReason`);
  return success({ replayMode, payloadHash: record.value.payloadHash, ...(payloadLocator ? { payloadLocator } : {}), ...(limitationReason ? { limitationReason } : {}) });
}

type ValidatedSourceEnvelope = SourceEnvelope & {
  readonly effectiveMilliseconds: number;
};

function validateSourceEnvelope(input: JsonValue | undefined, path: string): ObservationResult<ValidatedSourceEnvelope> {
  const record = requireRecord(input, path);
  if (!record.ok) return record;
  const shape = validateShape(record.value, [
    'contractVersion', 'sourceId', 'providerRef', 'sourceSchemaVersion', 'termsRef', 'adapter',
    'retrievalMethod', 'observedAt', 'effectiveAt', 'receivedAt', 'retention',
  ], path);
  if (!shape.ok) return shape;
  if (record.value.contractVersion !== SOURCE_ENVELOPE_CONTRACT_VERSION) return failure('invalid_provenance', `contractVersion must be ${SOURCE_ENVELOPE_CONTRACT_VERSION}.`, `${path}.contractVersion`);
  const sourceId = validateIdentifier(record.value.sourceId, `${path}.sourceId`);
  if (!sourceId.ok) return sourceId;
  const providerRef = validateReference(record.value.providerRef, `${path}.providerRef`, MAX_SOURCE_REFERENCE_LENGTH);
  if (!providerRef.ok) return providerRef;
  const sourceSchemaVersion = validateReference(record.value.sourceSchemaVersion, `${path}.sourceSchemaVersion`, MAX_SOURCE_VERSION_LENGTH);
  if (!sourceSchemaVersion.ok) return sourceSchemaVersion;
  const termsRef = validateReference(record.value.termsRef, `${path}.termsRef`, MAX_SOURCE_REFERENCE_LENGTH);
  if (!termsRef.ok) return termsRef;
  const adapterRecord = requireRecord(record.value.adapter, `${path}.adapter`);
  if (!adapterRecord.ok) return adapterRecord;
  const adapterShape = validateShape(adapterRecord.value, ['id', 'version'], `${path}.adapter`);
  if (!adapterShape.ok) return adapterShape;
  const adapterId = validateIdentifier(adapterRecord.value.id, `${path}.adapter.id`);
  if (!adapterId.ok) return adapterId;
  const adapterVersion = validateReference(adapterRecord.value.version, `${path}.adapter.version`, MAX_SOURCE_VERSION_LENGTH);
  if (!adapterVersion.ok) return adapterVersion;
  if (record.value.retrievalMethod !== 'licensed_api' && record.value.retrievalMethod !== 'file_import' && record.value.retrievalMethod !== 'manual') {
    return failure('invalid_provenance', 'retrievalMethod must be licensed_api, file_import or manual.', `${path}.retrievalMethod`);
  }
  const observedAt = parseTimestamp(record.value.observedAt, `${path}.observedAt`);
  if (!observedAt.ok) return observedAt;
  const effectiveAt = parseTimestamp(record.value.effectiveAt, `${path}.effectiveAt`);
  if (!effectiveAt.ok) return effectiveAt;
  const receivedAt = parseTimestamp(record.value.receivedAt, `${path}.receivedAt`);
  if (!receivedAt.ok) return receivedAt;
  if (effectiveAt.value.milliseconds > observedAt.value.milliseconds) return failure('invalid_time_order', 'Effective time cannot be after observation time.', `${path}.effectiveAt`);
  if (receivedAt.value.milliseconds < observedAt.value.milliseconds) return failure('invalid_time_order', 'Receipt time cannot precede observation time.', `${path}.receivedAt`);
  const retention = validateRetention(record.value.retention, `${path}.retention`);
  if (!retention.ok) return retention;
  return success({
    contractVersion: SOURCE_ENVELOPE_CONTRACT_VERSION, sourceId: sourceId.value, providerRef: providerRef.value,
    sourceSchemaVersion: sourceSchemaVersion.value, termsRef: termsRef.value,
    adapter: { id: adapterId.value, version: adapterVersion.value }, retrievalMethod: record.value.retrievalMethod,
    observedAt: observedAt.value.canonical, effectiveAt: effectiveAt.value.canonical, receivedAt: receivedAt.value.canonical,
    retention: retention.value, effectiveMilliseconds: effectiveAt.value.milliseconds,
  });
}

function normalizeTrusted(input: JsonRecord): ObservationResult<NormalizedMarketSnapshot> {
  const shape = validateShape(input, [
    'sourceEnvelope', 'sportId', 'competitionId', 'eventId', 'marketId', 'eventStartAt', 'asOf',
    'freshnessPolicy', 'completeness', 'marketAvailability', 'outcomes',
  ], '$');
  if (!shape.ok) return shape;
  const source = validateSourceEnvelope(input.sourceEnvelope, '$.sourceEnvelope');
  if (!source.ok) return source;
  const identities = ['sportId', 'competitionId', 'eventId', 'marketId'] as const;
  const validatedIdentities = {} as Record<(typeof identities)[number], string>;
  for (const identity of identities) {
    const result = validateIdentifier(input[identity], `$.${identity}`);
    if (!result.ok) return result;
    validatedIdentities[identity] = result.value;
  }
  if (input.completeness !== 'complete' && input.completeness !== 'incomplete') return failure('invalid_market', 'Completeness must be complete or incomplete.', '$.completeness');
  if (input.marketAvailability !== 'active' && input.marketAvailability !== 'suspended' && input.marketAvailability !== 'unavailable') return failure('invalid_market', 'Market availability must be active, suspended or unavailable.', '$.marketAvailability');
  if (!Array.isArray(input.outcomes)) return failure('invalid_market', 'Outcomes must be an array.', '$.outcomes');
  if (input.outcomes.length > MAX_MARKET_OUTCOMES) return failure('market_limit_exceeded', `A market must not exceed ${MAX_MARKET_OUTCOMES} outcomes.`, '$.outcomes');
  if (input.outcomes.length === 0) return failure('invalid_market', 'A market must contain at least one outcome.', '$.outcomes');

  const freshness = classifyFreshnessTrusted({ policy: input.freshnessPolicy, observedAt: source.value.observedAt,
    receivedAt: source.value.receivedAt, eventStartAt: input.eventStartAt, asOf: input.asOf });
  if (!freshness.ok) return freshness;
  if (source.value.effectiveMilliseconds > Date.parse(freshness.value.asOf)) return failure('invalid_time_order', 'Effective time cannot be after evaluation time.', '$.sourceEnvelope.effectiveAt');

  const seen = new Set<string>();
  const outcomes: NormalizedMarketOutcome[] = [];
  for (let inputIndex = 0; inputIndex < input.outcomes.length; inputIndex += 1) {
    const path = `$.outcomes[${inputIndex}]`;
    const outcome = input.outcomes[inputIndex];
    if (!isRecord(outcome)) return failure('invalid_outcome', 'Every outcome must be a non-null object.', path, { inputIndex });
    const outcomeShape = validateShape(outcome, ['outcomeId', 'decimalOdds', 'availability', 'observationRef', 'sourceSequence', 'identity'], path);
    if (!outcomeShape.ok) return failure(outcomeShape.error.code, outcomeShape.error.message, outcomeShape.error.path, { inputIndex });
    const outcomeId = validateIdentifier(outcome.outcomeId, `${path}.outcomeId`, MAX_OUTCOME_ID_LENGTH);
    if (!outcomeId.ok) return failure(outcomeId.error.code, outcomeId.error.message, outcomeId.error.path, { inputIndex });
    const context = { inputIndex, outcomeId: outcomeId.value };
    if (seen.has(outcomeId.value)) return failure('duplicate_outcome', 'Outcome identifiers must be unique.', `${path}.outcomeId`, context);
    seen.add(outcomeId.value);
    if (outcome.identity !== undefined) {
      const repeated = requireRecord(outcome.identity, `${path}.identity`);
      if (!repeated.ok) return failure(repeated.error.code, repeated.error.message, repeated.error.path, context);
      const repeatedShape = validateShape(repeated.value, ['sportId', 'competitionId', 'eventId', 'marketId', 'outcomeId'], `${path}.identity`);
      if (!repeatedShape.ok) return failure(repeatedShape.error.code, repeatedShape.error.message, repeatedShape.error.path, context);
      for (const [key, expected] of [
        ['sportId', validatedIdentities.sportId], ['competitionId', validatedIdentities.competitionId],
        ['eventId', validatedIdentities.eventId], ['marketId', validatedIdentities.marketId], ['outcomeId', outcomeId.value],
      ] as const) {
        if (repeated.value[key] !== expected) return failure('identity_conflict', `Repeated ${key} conflicts with the canonical identity.`, `${path}.identity.${key}`, context);
      }
    }
    if (outcome.availability !== 'active' && outcome.availability !== 'suspended' && outcome.availability !== 'unavailable') return failure('invalid_outcome', 'Price availability must be active, suspended or unavailable.', `${path}.availability`, context);
    const observationRef = validateReference(outcome.observationRef, `${path}.observationRef`, MAX_OBSERVATION_REF_LENGTH);
    if (!observationRef.ok) return failure(observationRef.error.code, observationRef.error.message, observationRef.error.path, context);
    let sourceSequence: string | undefined;
    if (outcome.sourceSequence !== undefined) {
      const sequence = validateReference(outcome.sourceSequence, `${path}.sourceSequence`, MAX_SOURCE_VERSION_LENGTH);
      if (!sequence.ok) return failure(sequence.error.code, sequence.error.message, sequence.error.path, context);
      sourceSequence = sequence.value;
    }
    if (outcome.availability === 'unavailable') {
      if (outcome.decimalOdds !== undefined && outcome.decimalOdds !== null) return failure('invalid_price', 'Unavailable outcomes must not carry an offered price.', `${path}.decimalOdds`, context);
      outcomes.push({ outcomeId: outcomeId.value, availability: 'unavailable', observationRef: observationRef.value, ...(sourceSequence ? { sourceSequence } : {}), freshness: freshness.value });
      continue;
    }
    const odds = validateDecimalOdds(outcome.decimalOdds);
    if (!odds.ok) return failure('invalid_price', odds.error.message, `${path}.decimalOdds`, context);
    outcomes.push({ outcomeId: outcomeId.value, decimalOdds: odds.value.decimalOdds,
      decimalOddsMicros: odds.value.decimalOddsMicros, availability: outcome.availability,
      observationRef: observationRef.value, ...(sourceSequence ? { sourceSequence } : {}), freshness: freshness.value });
  }

  const sourceEnvelope: SourceEnvelope = {
    contractVersion: source.value.contractVersion, sourceId: source.value.sourceId, providerRef: source.value.providerRef,
    sourceSchemaVersion: source.value.sourceSchemaVersion, termsRef: source.value.termsRef, adapter: source.value.adapter,
    retrievalMethod: source.value.retrievalMethod, observedAt: source.value.observedAt, effectiveAt: source.value.effectiveAt,
    receivedAt: source.value.receivedAt, retention: source.value.retention,
  };
  return success({ contractVersion: 'market-observation-v1', sourceEnvelope, ...validatedIdentities,
    eventStartAt: freshness.value.eventStartAt, observedAt: sourceEnvelope.observedAt, effectiveAt: sourceEnvelope.effectiveAt,
    receivedAt: sourceEnvelope.receivedAt, asOf: freshness.value.asOf, completeness: input.completeness,
    marketAvailability: input.marketAvailability, freshnessPolicy: BASELINE_FRESHNESS_POLICY, outcomes });
}

export function normalizeMarketObservation(input: unknown): ObservationResult<NormalizedMarketSnapshot> {
  const snapshot = snapshotUntrusted(input);
  if (!snapshot.ok) return snapshot;
  const record = requireRecord(snapshot.value, '$');
  return record.ok ? normalizeTrusted(record.value) : record;
}

export function toOddsMarketInput(input: unknown): ObservationResult<Readonly<MarketPriceInput>> {
  const normalized = normalizeMarketObservation(input);
  if (!normalized.ok) return normalized;
  const snapshot = normalized.value;
  if (snapshot.completeness !== 'complete') return failure('incomplete_market', 'Only a complete market can be handed to odds calculations.', '$.completeness');
  if (snapshot.marketAvailability === 'suspended') return failure('suspended_market', 'A suspended market cannot be handed to odds calculations.', '$.marketAvailability');
  if (snapshot.marketAvailability === 'unavailable') return failure('unavailable_price', 'An unavailable market cannot be handed to odds calculations.', '$.marketAvailability');
  for (let inputIndex = 0; inputIndex < snapshot.outcomes.length; inputIndex += 1) {
    const outcome = snapshot.outcomes[inputIndex];
    const context = { inputIndex, outcomeId: outcome.outcomeId };
    if (outcome.freshness.classification === 'stale') return failure('stale_observation', 'A stale observation cannot be handed to odds calculations.', `$.outcomes[${inputIndex}].freshness`, context);
    if (outcome.availability === 'suspended') return failure('suspended_outcome', 'A suspended outcome cannot be handed to odds calculations.', `$.outcomes[${inputIndex}].availability`, context);
    if (outcome.availability === 'unavailable') return failure('unavailable_price', 'An unavailable outcome cannot be handed to odds calculations.', `$.outcomes[${inputIndex}].availability`, context);
    if (outcome.decimalOdds === undefined) return failure('unavailable_price', 'A calculation-ready outcome requires a price.', `$.outcomes[${inputIndex}].decimalOdds`, context);
  }
  if (snapshot.outcomes.length < 2) return failure('incomplete_market', 'A calculation-ready market requires at least two outcomes.', '$.outcomes');
  return success({ completeness: 'complete', prices: snapshot.outcomes.map((outcome) => ({
    outcomeId: outcome.outcomeId, decimalOdds: outcome.decimalOdds, availability: 'active', freshness: 'current',
    observationRef: outcome.observationRef,
  })) });
}
