import { normalizeMarketObservation, type NormalizedMarketSnapshot, type ObservationErrorCode, type ObservationResult } from './market-observation.ts';
import { inspectJsonCompatibleInput, isCredentialFieldName } from './untrusted-json.ts';

function failure<T>(code: ObservationErrorCode, message: string, path: string): ObservationResult<T> {
  const error = Object.freeze({ code, message, path });
  return Object.freeze({ ok: false, error });
}

function safeDataRecord(input: unknown, allowed: readonly string[], path: string): ObservationResult<Record<string, unknown>> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return failure('invalid_input', 'Fixture value must be a plain data object.', path);
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return failure('invalid_input', 'Fixture value must be a plain data object.', path);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(descriptors);
  const allowedSet = new Set(allowed);
  const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    if (typeof key !== 'string') return failure('invalid_input', 'Symbol fixture fields are not supported.', path);
    const descriptor = descriptors[key];
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return failure('invalid_input', 'Accessor fixture fields are not supported.', `${path}.${key}`);
    if (!allowedSet.has(key)) {
      const credentialLike = isCredentialFieldName(key);
      return failure(credentialLike ? 'credential_field' : 'unknown_field',
        credentialLike ? 'Credential-bearing fields are forbidden at this boundary.' : 'Unknown fixture field is not allowed.', `${path}.${key}`);
    }
    output[key] = descriptor.value;
  }
  return Object.freeze({ ok: true, value: Object.freeze(output) });
}

export function normalizeManualMarketFixture(input: unknown): ObservationResult<NormalizedMarketSnapshot> {
  const inspected = inspectJsonCompatibleInput(input);
  if (!inspected.ok) return inspected;
  const trustedFixture = inspected.value.data;
  const wrapper = safeDataRecord(trustedFixture, [
    'format', 'observation', 'sourceEnvelope', 'identity', 'times', 'policy', 'completeness', 'status', 'selections',
  ], '$');
  if (!wrapper.ok) return wrapper;
  if (wrapper.value.format === 'canonical-manual-v1') {
    const canonicalShape = safeDataRecord(trustedFixture, ['format', 'observation'], '$');
    if (!canonicalShape.ok) return canonicalShape;
    return normalizeMarketObservation(canonicalShape.value.observation);
  }
  if (wrapper.value.format !== 'compact-manual-v1') return failure('invalid_input', 'Unsupported manual fixture format.', '$.format');
  const compactShape = safeDataRecord(trustedFixture, ['format', 'sourceEnvelope', 'identity', 'times', 'policy', 'completeness', 'status', 'selections'], '$');
  if (!compactShape.ok) return compactShape;
  const identity = safeDataRecord(compactShape.value.identity, ['sport', 'competition', 'event', 'market'], '$.identity');
  if (!identity.ok) return identity;
  const times = safeDataRecord(compactShape.value.times, ['start', 'asOf'], '$.times');
  if (!times.ok) return times;
  return normalizeMarketObservation({
    sourceEnvelope: compactShape.value.sourceEnvelope,
    sportId: identity.value.sport,
    competitionId: identity.value.competition,
    eventId: identity.value.event,
    marketId: identity.value.market,
    eventStartAt: times.value.start,
    asOf: times.value.asOf,
    freshnessPolicy: compactShape.value.policy,
    completeness: compactShape.value.completeness,
    marketAvailability: compactShape.value.status,
    outcomes: compactShape.value.selections,
  });
}
