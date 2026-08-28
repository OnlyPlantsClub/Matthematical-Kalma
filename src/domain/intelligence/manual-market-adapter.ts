import { normalizeMarketObservation, type NormalizedMarketSnapshot, type ObservationResult } from './market-observation.ts';

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

export function normalizeManualMarketFixture(input: unknown): ObservationResult<NormalizedMarketSnapshot> {
  if (!isRecord(input)) {
    return { ok: false, error: { code: 'invalid_input', message: 'Manual fixture must be a non-null object.', path: '$' } };
  }
  if (input.format === 'canonical-manual-v1') return normalizeMarketObservation(input.observation);
  if (input.format !== 'compact-manual-v1' || !isRecord(input.identity) || !isRecord(input.times)) {
    return { ok: false, error: { code: 'invalid_input', message: 'Unsupported or malformed manual fixture format.', path: '$.format' } };
  }
  return normalizeMarketObservation({
    source: input.source,
    sportId: input.identity.sport,
    competitionId: input.identity.competition,
    eventId: input.identity.event,
    marketId: input.identity.market,
    eventStartAt: input.times.start,
    observedAt: input.times.observed,
    receivedAt: input.times.received,
    asOf: input.times.asOf,
    freshnessPolicy: input.policy,
    completeness: input.completeness,
    marketAvailability: input.status,
    outcomes: input.selections,
  });
}
