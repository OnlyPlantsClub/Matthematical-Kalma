import {
  MAX_MARKET_OUTCOMES,
  MAX_OBSERVATION_REF_LENGTH,
  MAX_OUTCOME_ID_LENGTH,
  type MarketPriceInput,
  validateDecimalOdds,
} from './odds.ts';

export const MAX_CANONICAL_ID_LENGTH = 128;
export const MAX_SOURCE_REFERENCE_LENGTH = 256;
export const MAX_SOURCE_VERSION_LENGTH = 128;
export const MAX_TIMESTAMP_LENGTH = 24;

export const BASELINE_FRESHNESS_POLICY = Object.freeze({
  id: 'baseline-pre-match',
  version: '1',
  maxAgeMilliseconds: 60_000,
} as const);

export type ObservationErrorCode =
  | 'invalid_input'
  | 'invalid_identifier'
  | 'invalid_reference'
  | 'invalid_timestamp'
  | 'invalid_time_order'
  | 'future_observation'
  | 'post_start'
  | 'unsupported_policy'
  | 'invalid_market'
  | 'invalid_outcome'
  | 'duplicate_outcome'
  | 'identity_conflict'
  | 'invalid_price'
  | 'market_limit_exceeded'
  | 'unavailable_price';

export interface ObservationError {
  readonly code: ObservationErrorCode;
  readonly message: string;
  readonly path: string;
  readonly inputIndex?: number;
  readonly outcomeId?: string;
}

export type ObservationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ObservationError };

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
  readonly source: Readonly<{ sourceId: string; providerRef: string }>;
  readonly sportId: string;
  readonly competitionId: string;
  readonly eventId: string;
  readonly marketId: string;
  readonly eventStartAt: string;
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly asOf: string;
  readonly completeness: 'complete' | 'incomplete';
  readonly marketAvailability: 'active' | 'suspended';
  readonly freshnessPolicy: typeof BASELINE_FRESHNESS_POLICY;
  readonly outcomes: readonly NormalizedMarketOutcome[];
}

const CANONICAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/;
const UTC_MILLISECOND_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/;

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function success<T>(value: T): ObservationResult<T> {
  return { ok: true, value };
}

function failure<T>(code: ObservationErrorCode, message: string, path: string, context: Partial<ObservationError> = {}): ObservationResult<T> {
  return { ok: false, error: { code, message, path, ...context } };
}

function parseTimestamp(input: unknown, path: string): ObservationResult<{ canonical: string; milliseconds: number }> {
  if (typeof input !== 'string' || input.length > MAX_TIMESTAMP_LENGTH || !UTC_MILLISECOND_PATTERN.test(input)) {
    return failure('invalid_timestamp', 'Timestamp must be canonical UTC ISO-8601 with milliseconds (YYYY-MM-DDTHH:mm:ss.sssZ).', path);
  }
  const milliseconds = Date.parse(input);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== input) {
    return failure('invalid_timestamp', 'Timestamp is not a valid canonical UTC instant.', path);
  }
  return success({ canonical: input, milliseconds });
}

function validateIdentifier(input: unknown, path: string, maxLength = MAX_CANONICAL_ID_LENGTH): ObservationResult<string> {
  if (typeof input !== 'string' || input.length === 0 || input.length > maxLength || !CANONICAL_ID_PATTERN.test(input)) {
    return failure('invalid_identifier', `Identifier must be 1-${maxLength} canonical characters.`, path);
  }
  return success(input);
}

function validateReference(input: unknown, path: string, maxLength: number): ObservationResult<string> {
  if (typeof input !== 'string' || input.length === 0 || input.length > maxLength || !REFERENCE_PATTERN.test(input)) {
    return failure('invalid_reference', `Reference must be 1-${maxLength} opaque reference characters.`, path);
  }
  return success(input);
}

function validatePolicy(input: unknown, path: string): ObservationResult<typeof BASELINE_FRESHNESS_POLICY> {
  if (!isRecord(input)
    || input.id !== BASELINE_FRESHNESS_POLICY.id
    || input.version !== BASELINE_FRESHNESS_POLICY.version
    || input.maxAgeMilliseconds !== BASELINE_FRESHNESS_POLICY.maxAgeMilliseconds) {
    return failure('unsupported_policy', 'Only the exact baseline-pre-match freshness policy version 1 is supported.', path);
  }
  return success(BASELINE_FRESHNESS_POLICY);
}

export function classifyObservationFreshness(input: unknown): ObservationResult<FreshnessClassification> {
  if (!isRecord(input)) return failure('invalid_input', 'Freshness input must be a non-null object.', '$');
  const policy = validatePolicy(input.policy, '$.policy');
  if (!policy.ok) return policy;
  const observedAt = parseTimestamp(input.observedAt, '$.observedAt');
  if (!observedAt.ok) return observedAt;
  const receivedAt = parseTimestamp(input.receivedAt, '$.receivedAt');
  if (!receivedAt.ok) return receivedAt;
  const eventStartAt = parseTimestamp(input.eventStartAt, '$.eventStartAt');
  if (!eventStartAt.ok) return eventStartAt;
  const asOf = parseTimestamp(input.asOf, '$.asOf');
  if (!asOf.ok) return asOf;

  if (observedAt.value.milliseconds > asOf.value.milliseconds) {
    return failure('future_observation', 'Observation time cannot be after evaluation time.', '$.observedAt');
  }
  if (receivedAt.value.milliseconds < observedAt.value.milliseconds) {
    return failure('invalid_time_order', 'Receipt time cannot precede observation time.', '$.receivedAt');
  }
  if (receivedAt.value.milliseconds > asOf.value.milliseconds) {
    return failure('invalid_time_order', 'Receipt time cannot be after evaluation time.', '$.receivedAt');
  }
  if (asOf.value.milliseconds >= eventStartAt.value.milliseconds) {
    return failure('post_start', 'Pre-match evaluation time must be strictly before event start time.', '$.asOf');
  }

  const ageMilliseconds = asOf.value.milliseconds - observedAt.value.milliseconds;
  const current = ageMilliseconds <= policy.value.maxAgeMilliseconds;
  return success(Object.freeze({
    classification: current ? 'current' : 'stale',
    reason: current ? 'within_maximum_age' : 'maximum_age_exceeded',
    policy: policy.value,
    observedAt: observedAt.value.canonical,
    receivedAt: receivedAt.value.canonical,
    eventStartAt: eventStartAt.value.canonical,
    asOf: asOf.value.canonical,
    ageMilliseconds,
    ingestionDelayMilliseconds: receivedAt.value.milliseconds - observedAt.value.milliseconds,
    millisecondsUntilStart: eventStartAt.value.milliseconds - asOf.value.milliseconds,
  }));
}

export function normalizeMarketObservation(input: unknown): ObservationResult<NormalizedMarketSnapshot> {
  if (!isRecord(input)) return failure('invalid_input', 'Market observation must be a non-null object.', '$');
  if (!isRecord(input.source)) return failure('invalid_input', 'Source must be a non-null object.', '$.source');
  for (const forbidden of ['apiKey', 'credential', 'password', 'token']) {
    if (Object.hasOwn(input.source, forbidden)) {
      return failure('invalid_reference', 'Source references must not contain credentials.', `$.source.${forbidden}`);
    }
  }
  const sourceId = validateIdentifier(input.source.sourceId, '$.source.sourceId');
  if (!sourceId.ok) return sourceId;
  const providerRef = validateReference(input.source.providerRef, '$.source.providerRef', MAX_SOURCE_REFERENCE_LENGTH);
  if (!providerRef.ok) return providerRef;

  const identities = ['sportId', 'competitionId', 'eventId', 'marketId'] as const;
  const validatedIdentities: Record<(typeof identities)[number], string> = {} as Record<(typeof identities)[number], string>;
  for (const identity of identities) {
    const result = validateIdentifier(input[identity], `$.${identity}`);
    if (!result.ok) return result;
    validatedIdentities[identity] = result.value;
  }
  if (input.completeness !== 'complete' && input.completeness !== 'incomplete') {
    return failure('invalid_market', 'Completeness must be complete or incomplete.', '$.completeness');
  }
  if (input.marketAvailability !== 'active' && input.marketAvailability !== 'suspended') {
    return failure('invalid_market', 'Market availability must be active or suspended.', '$.marketAvailability');
  }
  if (!Array.isArray(input.outcomes)) return failure('invalid_market', 'Outcomes must be an array.', '$.outcomes');
  if (input.outcomes.length > MAX_MARKET_OUTCOMES) {
    return failure('market_limit_exceeded', `A market must not exceed ${MAX_MARKET_OUTCOMES} outcomes.`, '$.outcomes');
  }
  if (input.outcomes.length === 0) return failure('invalid_market', 'A market must contain at least one outcome.', '$.outcomes');

  const freshness = classifyObservationFreshness({
    policy: input.freshnessPolicy,
    observedAt: input.observedAt,
    receivedAt: input.receivedAt,
    eventStartAt: input.eventStartAt,
    asOf: input.asOf,
  });
  if (!freshness.ok) return freshness;

  const seen = new Set<string>();
  const outcomes: NormalizedMarketOutcome[] = [];
  for (let inputIndex = 0; inputIndex < input.outcomes.length; inputIndex += 1) {
    const path = `$.outcomes[${inputIndex}]`;
    if (!(inputIndex in input.outcomes)) return failure('invalid_outcome', 'Outcomes must be a dense array.', path, { inputIndex });
    const outcome = input.outcomes[inputIndex];
    if (!isRecord(outcome)) return failure('invalid_outcome', 'Every outcome must be a non-null object.', path, { inputIndex });
    const outcomeId = validateIdentifier(outcome.outcomeId, `${path}.outcomeId`, MAX_OUTCOME_ID_LENGTH);
    if (!outcomeId.ok) return failure(outcomeId.error.code, outcomeId.error.message, outcomeId.error.path, { inputIndex });
    const context = { inputIndex, outcomeId: outcomeId.value };
    if (seen.has(outcomeId.value)) return failure('duplicate_outcome', 'Outcome identifiers must be unique.', `${path}.outcomeId`, context);
    seen.add(outcomeId.value);
    for (const [key, expected] of [
      ['sourceId', sourceId.value], ['eventId', validatedIdentities.eventId], ['marketId', validatedIdentities.marketId],
    ] as const) {
      if (outcome[key] !== undefined && outcome[key] !== expected) {
        return failure('identity_conflict', `Outcome ${key} conflicts with the market identity.`, `${path}.${key}`, context);
      }
    }
    if (outcome.availability !== 'active' && outcome.availability !== 'suspended' && outcome.availability !== 'unavailable') {
      return failure('invalid_outcome', 'Price availability must be active, suspended or unavailable.', `${path}.availability`, context);
    }
    const observationRef = validateReference(outcome.observationRef, `${path}.observationRef`, MAX_OBSERVATION_REF_LENGTH);
    if (!observationRef.ok) return failure(observationRef.error.code, observationRef.error.message, observationRef.error.path, context);
    let sourceSequence: string | undefined;
    if (outcome.sourceSequence !== undefined) {
      const sequence = validateReference(outcome.sourceSequence, `${path}.sourceSequence`, MAX_SOURCE_VERSION_LENGTH);
      if (!sequence.ok) return failure(sequence.error.code, sequence.error.message, sequence.error.path, context);
      sourceSequence = sequence.value;
    }
    if (outcome.availability === 'unavailable') {
      if (outcome.decimalOdds !== undefined && outcome.decimalOdds !== null) {
        return failure('invalid_price', 'Unavailable outcomes must not carry an offered price.', `${path}.decimalOdds`, context);
      }
      outcomes.push(Object.freeze({ outcomeId: outcomeId.value, availability: 'unavailable', observationRef: observationRef.value, ...(sourceSequence ? { sourceSequence } : {}), freshness: freshness.value }));
      continue;
    }
    const odds = validateDecimalOdds(outcome.decimalOdds);
    if (!odds.ok) return failure('invalid_price', odds.error.message, `${path}.decimalOdds`, context);
    outcomes.push(Object.freeze({
      outcomeId: outcomeId.value,
      decimalOdds: odds.value.decimalOdds,
      decimalOddsMicros: odds.value.decimalOddsMicros,
      availability: outcome.availability === 'suspended' ? 'suspended' : 'active',
      observationRef: observationRef.value,
      ...(sourceSequence ? { sourceSequence } : {}),
      freshness: freshness.value,
    }));
  }

  const snapshot = {
    contractVersion: 'market-observation-v1',
    source: Object.freeze({ sourceId: sourceId.value, providerRef: providerRef.value }),
    ...validatedIdentities,
    eventStartAt: freshness.value.eventStartAt,
    observedAt: freshness.value.observedAt,
    receivedAt: freshness.value.receivedAt,
    asOf: freshness.value.asOf,
    completeness: input.completeness,
    marketAvailability: input.marketAvailability,
    freshnessPolicy: BASELINE_FRESHNESS_POLICY,
    outcomes: Object.freeze(outcomes),
  } as const;
  return success(Object.freeze(snapshot));
}

export function toOddsMarketInput(input: unknown): ObservationResult<Readonly<MarketPriceInput>> {
  const normalized = normalizeMarketObservation(input);
  if (!normalized.ok) return normalized;
  const snapshot = normalized.value;
  const unavailableIndex = snapshot.outcomes.findIndex((outcome) => outcome.availability === 'unavailable');
  if (unavailableIndex !== -1) {
    const outcome = snapshot.outcomes[unavailableIndex];
    return failure('unavailable_price', 'Unavailable prices cannot form an odds calculation.', `$.outcomes[${unavailableIndex}].availability`, { inputIndex: unavailableIndex, outcomeId: outcome.outcomeId });
  }
  return success(Object.freeze({
    completeness: snapshot.completeness,
    prices: Object.freeze(snapshot.outcomes.map((outcome) => Object.freeze({
      outcomeId: outcome.outcomeId,
      decimalOdds: outcome.decimalOdds,
      availability: snapshot.marketAvailability === 'suspended' || outcome.availability === 'suspended'
        ? 'suspended'
        : 'active',
      freshness: outcome.freshness.classification,
      observationRef: outcome.observationRef,
    }))),
  }));
}
