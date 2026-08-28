import { normalizeMarketObservation, type NormalizedMarketSnapshot, type ObservationErrorCode, type ObservationResult } from './market-observation.ts';

const CREDENTIAL_FIELD_NAMES = new Set([
  'apikey', 'apikeys', 'accesstoken', 'accesstokens', 'refreshtoken', 'refreshtokens', 'clientsecret',
  'clientsecrets', 'password', 'passwords', 'credential', 'credentials', 'authorization', 'authorizationfield',
  'authorizationfields', 'authorizationheader', 'authorizationheaders', 'bearer', 'bearertoken', 'bearertokens',
  'bearervalue', 'bearervalues', 'cookie', 'cookies', 'setcookie',
]);

function failure<T>(code: ObservationErrorCode, message: string, path: string): ObservationResult<T> {
  const error = Object.freeze({ code, message, path });
  return Object.freeze({ ok: false, error });
}

function normalizedFieldName(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
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
      const credentialLike = CREDENTIAL_FIELD_NAMES.has(normalizedFieldName(key));
      return failure(credentialLike ? 'credential_field' : 'unknown_field',
        credentialLike ? 'Credential-bearing fields are forbidden at this boundary.' : 'Unknown fixture field is not allowed.', `${path}.${key}`);
    }
    output[key] = descriptor.value;
  }
  return Object.freeze({ ok: true, value: Object.freeze(output) });
}

export function normalizeManualMarketFixture(input: unknown): ObservationResult<NormalizedMarketSnapshot> {
  try {
    const wrapper = safeDataRecord(input, [
      'format', 'observation', 'sourceEnvelope', 'identity', 'times', 'policy', 'completeness', 'status', 'selections',
    ], '$');
    if (!wrapper.ok) return wrapper;
    if (wrapper.value.format === 'canonical-manual-v1') {
      const canonicalShape = safeDataRecord(input, ['format', 'observation'], '$');
      if (!canonicalShape.ok) return canonicalShape;
      return normalizeMarketObservation(canonicalShape.value.observation);
    }
    if (wrapper.value.format !== 'compact-manual-v1') return failure('invalid_input', 'Unsupported manual fixture format.', '$.format');
    const compactShape = safeDataRecord(input, ['format', 'sourceEnvelope', 'identity', 'times', 'policy', 'completeness', 'status', 'selections'], '$');
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
  } catch {
    return failure('invalid_input', 'Manual fixture could not be safely inspected as JSON-compatible data.', '$');
  }
}
