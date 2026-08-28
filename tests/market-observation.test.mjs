import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeManualMarketFixture } from '../src/domain/intelligence/manual-market-adapter.ts';
import {
  BASELINE_FRESHNESS_POLICY,
  MAX_CANONICAL_ID_LENGTH,
  MAX_SOURCE_REFERENCE_LENGTH,
  classifyObservationFreshness,
  normalizeMarketObservation,
  toOddsMarketInput,
} from '../src/domain/intelligence/market-observation.ts';
import {
  MAX_MARKET_OUTCOMES,
  MAX_OBSERVATION_REF_LENGTH,
  calculateMarketOverround,
  decimalOddsToImpliedProbability,
  removeMarginProportionally,
} from '../src/domain/intelligence/odds.ts';

const times = {
  observedAt: '2026-08-28T01:00:00.000Z',
  receivedAt: '2026-08-28T01:00:00.250Z',
  asOf: '2026-08-28T01:00:30.000Z',
  eventStartAt: '2026-08-28T02:00:00.000Z',
};

const outcome = (outcomeId, decimalOdds, observationRef = `quote/${outcomeId}`) => ({
  outcomeId, decimalOdds, availability: 'active', observationRef,
});

const observation = (overrides = {}) => ({
  source: { sourceId: 'manual-fixture', providerRef: 'fixture/batch-1' },
  sportId: 'afl',
  competitionId: 'afl-men',
  eventId: 'event-1',
  marketId: 'winner-v1',
  ...times,
  freshnessPolicy: BASELINE_FRESHNESS_POLICY,
  completeness: 'complete',
  marketAvailability: 'active',
  outcomes: [{ ...outcome('home', '1.90', 'quote/home@7'), sourceSequence: 'sequence/7' }, outcome('away', '1.90', 'quote/away@8')],
  ...overrides,
});

function value(result) {
  assert.equal(result.ok, true, result.ok ? undefined : `${result.error.code}: ${result.error.message}`);
  return result.value;
}

function error(result, code, path) {
  assert.equal(result.ok, false);
  assert.equal(result.error.code, code);
  if (path) assert.equal(result.error.path, path);
  return result.error;
}

test('classifies the exact freshness boundary as current and one millisecond after as stale', () => {
  const classify = (asOf) => value(classifyObservationFreshness({ ...times, asOf, policy: BASELINE_FRESHNESS_POLICY }));
  assert.equal(classify('2026-08-28T01:00:59.999Z').classification, 'current');
  const boundary = classify('2026-08-28T01:01:00.000Z');
  assert.equal(boundary.classification, 'current');
  assert.equal(boundary.ageMilliseconds, 60_000);
  assert.equal(classify('2026-08-28T01:01:00.001Z').classification, 'stale');
});

test('freshness replay is deterministic and has no hidden system-clock dependency', () => {
  const input = { ...times, policy: BASELINE_FRESHNESS_POLICY };
  const first = value(classifyObservationFreshness(input));
  const originalNow = Date.now;
  Date.now = () => 1;
  try {
    assert.deepEqual(value(classifyObservationFreshness(input)), first);
  } finally {
    Date.now = originalNow;
  }
  assert.deepEqual(first, {
    classification: 'current', reason: 'within_maximum_age', policy: BASELINE_FRESHNESS_POLICY,
    ...times, ageMilliseconds: 30_000, ingestionDelayMilliseconds: 250, millisecondsUntilStart: 3_570_000,
  });
});

test('requires canonical UTC millisecond timestamps and rejects invalid calendar dates', () => {
  for (const observedAt of [
    '2026-08-28T09:00:00.000+08:00', '2026-08-28T01:00:00Z', '2026-08-28 01:00:00.000Z',
    '2026-02-30T01:00:00.000Z', 1_777_000_000_000, null,
  ]) {
    error(classifyObservationFreshness({ ...times, observedAt, policy: BASELINE_FRESHNESS_POLICY }), 'invalid_timestamp', '$.observedAt');
  }
});

test('rejects future observations, receipt-before-observation, future receipt and post-start evaluation', () => {
  error(classifyObservationFreshness({ ...times, observedAt: '2026-08-28T01:00:31.000Z', policy: BASELINE_FRESHNESS_POLICY }), 'future_observation', '$.observedAt');
  error(classifyObservationFreshness({ ...times, receivedAt: '2026-08-28T00:59:59.999Z', policy: BASELINE_FRESHNESS_POLICY }), 'invalid_time_order', '$.receivedAt');
  error(classifyObservationFreshness({ ...times, receivedAt: '2026-08-28T01:00:31.000Z', policy: BASELINE_FRESHNESS_POLICY }), 'invalid_time_order', '$.receivedAt');
  error(classifyObservationFreshness({ ...times, asOf: times.eventStartAt, policy: BASELINE_FRESHNESS_POLICY }), 'post_start', '$.asOf');
});

test('normalizes complete, incomplete and suspended snapshots while preserving provenance', () => {
  const complete = value(normalizeMarketObservation(observation()));
  assert.equal(complete.outcomes[0].decimalOdds, '1.900000');
  assert.equal(complete.outcomes[0].decimalOddsMicros, '1900000');
  assert.equal(complete.outcomes[0].observationRef, 'quote/home@7');
  assert.equal(complete.outcomes[0].sourceSequence, 'sequence/7');
  assert.equal(complete.source.providerRef, 'fixture/batch-1');
  assert.ok(Object.isFrozen(complete));
  assert.ok(Object.isFrozen(complete.outcomes));
  assert.ok(Object.isFrozen(complete.outcomes[0]));

  const incomplete = value(normalizeMarketObservation(observation({ completeness: 'incomplete' })));
  assert.equal(incomplete.completeness, 'incomplete');
  const suspended = value(normalizeMarketObservation(observation({
    marketAvailability: 'suspended',
    outcomes: [{ ...outcome('home', '1.9'), availability: 'suspended' }, outcome('away', '1.9')],
  })));
  assert.equal(suspended.marketAvailability, 'suspended');
  assert.equal(suspended.outcomes[0].availability, 'suspended');
});

test('normalizes stale observations without concealing their classification', () => {
  const stale = value(normalizeMarketObservation(observation({ asOf: '2026-08-28T01:01:00.001Z' })));
  assert.ok(stale.outcomes.every((item) => item.freshness.classification === 'stale'));
  assert.equal(stale.outcomes[0].freshness.reason, 'maximum_age_exceeded');
});

test('rejects duplicate outcomes and conflicting source, event and market identities with indexes', () => {
  error(normalizeMarketObservation(observation({ outcomes: [outcome('same', '2'), outcome('same', '3')] })), 'duplicate_outcome', '$.outcomes[1].outcomeId');
  for (const [key, expectedPath] of [['sourceId', '$.outcomes[0].sourceId'], ['eventId', '$.outcomes[0].eventId'], ['marketId', '$.outcomes[0].marketId']]) {
    const result = normalizeMarketObservation(observation({ outcomes: [{ ...outcome('home', '2'), [key]: 'wrong' }, outcome('away', '2')] }));
    const detail = error(result, 'identity_conflict', expectedPath);
    assert.equal(detail.inputIndex, 0);
    assert.equal(detail.outcomeId, 'home');
  }
});

test('fails closed for nullish, primitive, sparse and malformed runtime inputs', () => {
  for (const input of [null, undefined, 1, 'x', []]) error(normalizeMarketObservation(input), 'invalid_input', '$');
  error(normalizeMarketObservation({}), 'invalid_input', '$.source');
  error(normalizeMarketObservation({ ...observation(), eventId: undefined }), 'invalid_identifier', '$.eventId');
  error(normalizeMarketObservation({ ...observation(), outcomes: undefined }), 'invalid_market', '$.outcomes');
  error(normalizeMarketObservation({ ...observation(), freshnessPolicy: undefined }), 'unsupported_policy', '$.policy');
  const sparse = [];
  sparse.length = 2;
  error(normalizeMarketObservation(observation({ outcomes: sparse })), 'invalid_outcome', '$.outcomes[0]');
  error(normalizeMarketObservation(observation({ outcomes: [null] })), 'invalid_outcome', '$.outcomes[0]');
  error(normalizeMarketObservation(observation({ completeness: 'unknown' })), 'invalid_market', '$.completeness');
  error(normalizeMarketObservation(observation({ marketAvailability: 'closed' })), 'invalid_market', '$.marketAvailability');
  error(normalizeMarketObservation(observation({ outcomes: [{ ...outcome('home', '2'), availability: 'unknown' }] })), 'invalid_outcome', '$.outcomes[0].availability');
  error(normalizeMarketObservation(observation({ source: { sourceId: 'manual', providerRef: 'safe', token: 'secret' } })), 'invalid_reference', '$.source.token');
});

test('rejects oversized identifiers, references and markets before per-outcome work', () => {
  error(normalizeMarketObservation(observation({ eventId: 'a'.repeat(MAX_CANONICAL_ID_LENGTH + 1) })), 'invalid_identifier', '$.eventId');
  error(normalizeMarketObservation(observation({ source: { sourceId: 'manual', providerRef: 'r'.repeat(MAX_SOURCE_REFERENCE_LENGTH + 1) } })), 'invalid_reference', '$.source.providerRef');
  error(normalizeMarketObservation(observation({ outcomes: [outcome('home', '2', 'r'.repeat(MAX_OBSERVATION_REF_LENGTH + 1))] })), 'invalid_reference', '$.outcomes[0].observationRef');
  const tooMany = Array.from({ length: MAX_MARKET_OUTCOMES + 1 }, (_, index) => outcome(`o-${index}`, '2'));
  tooMany[0] = null;
  error(normalizeMarketObservation(observation({ outcomes: tooMany })), 'market_limit_exceeded', '$.outcomes');
});

test('rejects non-canonical prices and models unavailable prices explicitly', () => {
  error(normalizeMarketObservation(observation({ outcomes: [outcome('home', 1.9)] })), 'invalid_price', '$.outcomes[0].decimalOdds');
  error(normalizeMarketObservation(observation({ outcomes: [outcome('home', '01.90')] })), 'invalid_price', '$.outcomes[0].decimalOdds');
  const unavailable = value(normalizeMarketObservation(observation({ outcomes: [{ outcomeId: 'home', availability: 'unavailable', observationRef: 'quote/home' }] })));
  assert.equal(unavailable.outcomes[0].decimalOdds, undefined);
  error(normalizeMarketObservation(observation({ outcomes: [{ ...outcome('home', '2'), availability: 'unavailable' }] })), 'invalid_price', '$.outcomes[0].decimalOdds');
  error(toOddsMarketInput(observation({ outcomes: [{ outcomeId: 'home', availability: 'unavailable', observationRef: 'quote/home' }] })), 'unavailable_price', '$.outcomes[0].availability');
});

test('different manual fixture shapes produce equivalent normalized output', () => {
  const direct = observation();
  const canonical = value(normalizeManualMarketFixture({ format: 'canonical-manual-v1', observation: direct }));
  const compact = value(normalizeManualMarketFixture({
    format: 'compact-manual-v1',
    source: direct.source,
    identity: { sport: direct.sportId, competition: direct.competitionId, event: direct.eventId, market: direct.marketId },
    times: { start: direct.eventStartAt, observed: direct.observedAt, received: direct.receivedAt, asOf: direct.asOf },
    policy: direct.freshnessPolicy,
    completeness: direct.completeness,
    status: direct.marketAvailability,
    selections: direct.outcomes,
  }));
  assert.deepEqual(compact, canonical);
});

test('hands a current normalized snapshot into implied probability, overround and de-vig calculations', () => {
  const oddsInput = value(toOddsMarketInput(observation()));
  assert.equal(value(decimalOddsToImpliedProbability(oddsInput.prices[0].decimalOdds)).rawImpliedProbability, '0.526315789');
  assert.equal(value(calculateMarketOverround(oddsInput)).overround, '0.052631579');
  const baseline = value(removeMarginProportionally(oddsInput));
  assert.deepEqual(baseline.outcomes.map((item) => item.fairProbability), ['0.500000000', '0.500000000']);
  assert.deepEqual(baseline.outcomes.map((item) => item.observationRef), ['quote/home@7', 'quote/away@8']);

  const suspendedInput = value(toOddsMarketInput(observation({ marketAvailability: 'suspended' })));
  error(removeMarginProportionally(suspendedInput), 'suspended_price', '$.prices[0].availability');
});

test('permutation preserves values by outcome identity and provenance', () => {
  const first = value(normalizeMarketObservation(observation()));
  const second = value(normalizeMarketObservation(observation({ outcomes: [...observation().outcomes].reverse() })));
  const keyed = (snapshot) => Object.fromEntries(snapshot.outcomes.map((item) => [item.outcomeId, {
    decimalOdds: item.decimalOdds, observationRef: item.observationRef, freshness: item.freshness,
  }]));
  assert.deepEqual(keyed(second), keyed(first));
  assert.deepEqual(second.outcomes.map((item) => item.outcomeId), ['away', 'home']);
});

test('rejects unsupported policy values rather than accepting caller-selected thresholds', () => {
  error(classifyObservationFreshness({ ...times, policy: { ...BASELINE_FRESHNESS_POLICY, maxAgeMilliseconds: 60_001 } }), 'unsupported_policy', '$.policy');
  error(classifyObservationFreshness({ ...times, policy: { id: 'afl', version: '1', maxAgeMilliseconds: 60_000 } }), 'unsupported_policy', '$.policy');
});
