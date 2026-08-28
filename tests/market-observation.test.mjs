import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeManualMarketFixture } from '../src/domain/intelligence/manual-market-adapter.ts';
import {
  BASELINE_FRESHNESS_POLICY, MAX_CANONICAL_ID_LENGTH, MAX_SOURCE_REFERENCE_LENGTH,
  SOURCE_ENVELOPE_CONTRACT_VERSION, classifyObservationFreshness, normalizeMarketObservation, toOddsMarketInput,
} from '../src/domain/intelligence/market-observation.ts';
import { MAX_MARKET_OUTCOMES, MAX_OBSERVATION_REF_LENGTH, calculateMarketOverround,
  decimalOddsToImpliedProbability, removeMarginProportionally } from '../src/domain/intelligence/odds.ts';
import {
  UNTRUSTED_INSPECTION_LIMITS, inspectJsonCompatibleInput, isCredentialFieldName,
} from '../src/domain/intelligence/untrusted-json.ts';

const payloadHash = `sha256:${'a'.repeat(64)}`;
const times = {
  observedAt: '2026-08-28T01:00:00.000Z', receivedAt: '2026-08-28T01:00:00.250Z',
  asOf: '2026-08-28T01:00:30.000Z', eventStartAt: '2026-08-28T02:00:00.000Z',
};
const sourceEnvelope = (overrides = {}) => ({
  contractVersion: SOURCE_ENVELOPE_CONTRACT_VERSION,
  sourceId: 'manual-token-market',
  providerRef: 'provider/token-market-v1',
  sourceSchemaVersion: 'manual-schema/v1',
  termsRef: 'licence/manual-fixture-v1',
  adapter: { id: 'manual-fixture-adapter', version: '1' },
  retrievalMethod: 'manual',
  observedAt: times.observedAt,
  effectiveAt: '2026-08-28T00:59:59.000Z',
  receivedAt: times.receivedAt,
  retention: { replayMode: 'hash_and_retrievable_locator', payloadHash, payloadLocator: 'fixture/batch-1.json' },
  ...overrides,
});
const identity = (outcomeId) => ({ sportId: 'afl', competitionId: 'afl-men', eventId: 'event-1', marketId: 'winner-v1', outcomeId });
const outcome = (outcomeId, decimalOdds, observationRef = `quote/${outcomeId}`) => ({
  outcomeId, decimalOdds, availability: 'active', observationRef, identity: identity(outcomeId),
});
const observation = (overrides = {}) => ({
  sourceEnvelope: sourceEnvelope(), sportId: 'afl', competitionId: 'afl-men', eventId: 'event-1', marketId: 'winner-v1',
  eventStartAt: times.eventStartAt, asOf: times.asOf, freshnessPolicy: BASELINE_FRESHNESS_POLICY,
  completeness: 'complete', marketAvailability: 'active',
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

test('classifies exact freshness boundaries and has no hidden system clock', () => {
  const classify = (asOf) => value(classifyObservationFreshness({ ...times, asOf, policy: BASELINE_FRESHNESS_POLICY }));
  assert.equal(classify('2026-08-28T01:00:59.999Z').classification, 'current');
  assert.equal(classify('2026-08-28T01:01:00.000Z').classification, 'current');
  assert.equal(classify('2026-08-28T01:01:00.001Z').classification, 'stale');
  const originalNow = Date.now;
  Date.now = () => 1;
  try { assert.deepEqual(classify(times.asOf), classify(times.asOf)); } finally { Date.now = originalNow; }
});

test('rejects non-canonical times and impossible ordering', () => {
  for (const observedAt of ['2026-08-28T09:00:00.000+08:00', '2026-08-28T01:00:00Z', '2026-02-30T01:00:00.000Z']) {
    error(classifyObservationFreshness({ ...times, observedAt, policy: BASELINE_FRESHNESS_POLICY }), 'invalid_timestamp', '$.observedAt');
  }
  error(classifyObservationFreshness({ ...times, observedAt: '2026-08-28T01:00:31.000Z', policy: BASELINE_FRESHNESS_POLICY }), 'future_observation');
  error(classifyObservationFreshness({ ...times, receivedAt: '2026-08-28T00:59:59.999Z', policy: BASELINE_FRESHNESS_POLICY }), 'invalid_time_order');
  error(classifyObservationFreshness({ ...times, asOf: times.eventStartAt, policy: BASELINE_FRESHNESS_POLICY }), 'post_start');
});

test('preserves the complete immutable source envelope and per-outcome provenance', () => {
  const normalized = value(normalizeMarketObservation(observation()));
  assert.deepEqual(normalized.sourceEnvelope, sourceEnvelope());
  assert.equal(normalized.effectiveAt, sourceEnvelope().effectiveAt);
  assert.equal(normalized.outcomes[0].observationRef, 'quote/home@7');
  assert.equal(normalized.outcomes[0].sourceSequence, 'sequence/7');
  assert.ok(Object.isFrozen(normalized));
  assert.ok(Object.isFrozen(normalized.sourceEnvelope));
  assert.ok(Object.isFrozen(normalized.sourceEnvelope.adapter));
  assert.ok(Object.isFrozen(normalized.sourceEnvelope.retention));
  assert.ok(Object.isFrozen(normalized.outcomes));
  assert.ok(Object.isFrozen(normalized.outcomes[0].freshness));
});

test('validates source schema, terms, adapter and retrieval contracts', () => {
  error(normalizeMarketObservation(observation({ sourceEnvelope: sourceEnvelope({ sourceSchemaVersion: '' }) })), 'invalid_reference', '$.sourceEnvelope.sourceSchemaVersion');
  error(normalizeMarketObservation(observation({ sourceEnvelope: sourceEnvelope({ termsRef: '' }) })), 'invalid_reference', '$.sourceEnvelope.termsRef');
  error(normalizeMarketObservation(observation({ sourceEnvelope: sourceEnvelope({ adapter: { id: 'manual-fixture-adapter', version: '' } }) })), 'invalid_reference', '$.sourceEnvelope.adapter.version');
  error(normalizeMarketObservation(observation({ sourceEnvelope: sourceEnvelope({ retrievalMethod: 'scrape' }) })), 'invalid_provenance', '$.sourceEnvelope.retrievalMethod');
  error(normalizeMarketObservation(observation({ sourceEnvelope: sourceEnvelope({ effectiveAt: '2026-08-28T01:00:00.001Z' }) })), 'invalid_time_order', '$.sourceEnvelope.effectiveAt');
});

test('enforces canonical hash and the full replay locator/limitation matrix', () => {
  const modes = ['full_payload_retained', 'hash_and_retrievable_locator', 'hash_only_verification', 'not_fully_replayable'];
  for (const replayMode of modes) {
    for (const locator of [false, true]) {
      for (const limitation of [false, true]) {
        const retention = { replayMode, payloadHash,
          ...(locator ? { payloadLocator: 'r2/artifact-1' } : {}),
          ...(limitation ? { limitationReason: 'Manual source cannot be reconstructed after entry.' } : {}) };
        const result = normalizeMarketObservation(observation({ sourceEnvelope: sourceEnvelope({ retention }) }));
        const valid = (replayMode === 'full_payload_retained' || replayMode === 'hash_and_retrievable_locator')
          ? locator && !limitation
          : replayMode === 'hash_only_verification' ? !locator && !limitation : limitation;
        assert.equal(result.ok, valid, `${replayMode}; locator=${locator}; limitation=${limitation}`);
        if (!valid) assert.equal(result.error.code, 'invalid_replay_contract');
      }
    }
  }
  for (const invalid of [payloadHash.toUpperCase(), 'a'.repeat(64), 'sha256:xyz']) {
    error(normalizeMarketObservation(observation({ sourceEnvelope: sourceEnvelope({ retention: { replayMode: 'hash_only_verification', payloadHash: invalid } }) })), 'invalid_provenance');
  }
  error(normalizeMarketObservation(observation({ sourceEnvelope: sourceEnvelope({ retention: { replayMode: 'full_payload_retained', payloadHash } }) })), 'invalid_replay_contract', '$.sourceEnvelope.retention.payloadLocator');
  error(normalizeMarketObservation(observation({ sourceEnvelope: sourceEnvelope({ retention: { replayMode: 'hash_only_verification', payloadHash, payloadLocator: 'unexpected' } }) })), 'invalid_replay_contract');
  error(normalizeMarketObservation(observation({ sourceEnvelope: sourceEnvelope({ retention: { replayMode: 'not_fully_replayable', payloadHash } }) })), 'invalid_replay_contract', '$.sourceEnvelope.retention.limitationReason');
});

test('central credential classifier covers its vocabulary and benign counterexamples', () => {
  const classes = [
    ['token', 'Token', 'TOKENS'], ['access_token', 'Access-Token', 'access tokens'],
    ['refresh_token', 'Refresh-Token', 'refresh tokens'], ['api_key', 'API-Key', 'api keys'],
    ['client_secret', 'Client-Secret', 'client secrets'], ['password', 'Passwords'],
    ['credential', 'CREDENTIALS'], ['authorization', 'Authorization-Headers'],
    ['bearer', 'Bearer-Token', 'bearer values'], ['cookie', 'Cookies'], ['set-cookie', 'Set Cookies'],
  ];
  for (const variants of classes) for (const field of variants) assert.equal(isCredentialFieldName(field), true, field);
  for (const benign of ['providerRef', 'tokenizerMode', 'marketTokenReference', 'authorizationStatus', 'cookiePolicy']) {
    assert.equal(isCredentialFieldName(benign), false, benign);
  }
  assert.equal(value(normalizeMarketObservation(observation())).sourceEnvelope.providerRef, 'provider/token-market-v1');
});

test('requires all repeated canonical identities to agree', () => {
  for (const field of ['sportId', 'competitionId', 'eventId', 'marketId', 'outcomeId']) {
    const changed = outcome('home', '2');
    changed.identity = { ...changed.identity, [field]: 'wrong' };
    error(normalizeMarketObservation(observation({ outcomes: [changed, outcome('away', '2')] })), 'identity_conflict', `$.outcomes[0].identity.${field}`);
  }
  error(normalizeMarketObservation(observation({ outcomes: [outcome('same', '2'), outcome('same', '3')] })), 'duplicate_outcome');
});

test('strict schemas reject unknown and credential-like fields while harmless values remain valid', () => {
  const credentialFields = ['apiKey', 'API_KEY', 'access-token', 'RefreshToken', 'client_secret', 'Password', 'credentials', 'AUTHORIZATION', 'bearer_value', 'Cookie'];
  for (const field of credentialFields) {
    const result = normalizeMarketObservation({ ...observation(), sourceEnvelope: { ...sourceEnvelope(), [field]: 'must-not-echo-this-value' } });
    const detail = error(result, 'credential_field', `$.sourceEnvelope.${field}`);
    assert.equal(detail.message.includes('must-not-echo'), false);
  }
  assert.equal(value(normalizeMarketObservation(observation())).sourceEnvelope.sourceId, 'manual-token-market');
  error(normalizeMarketObservation({ ...observation(), marketAvailabilty: 'active' }), 'unknown_field', '$.marketAvailabilty');
  error(normalizeMarketObservation(observation({ outcomes: [{ ...outcome('home', '2'), providerState: 'open' }] })), 'unknown_field', '$.outcomes[0].providerState');
});

test('contains throwing getters, proxies, enumeration and prototype traps at every exported boundary', () => {
  const throwingGetter = {};
  Object.defineProperty(throwingGetter, 'sourceEnvelope', { enumerable: true, get() { throw new Error('secret'); } });
  error(normalizeMarketObservation(throwingGetter), 'invalid_input');
  error(classifyObservationFreshness(throwingGetter), 'invalid_input');
  error(normalizeManualMarketFixture(throwingGetter), 'invalid_input');

  const proxy = new Proxy(observation(), { ownKeys() { throw new Error('secret'); } });
  error(normalizeMarketObservation(proxy), 'invalid_input');
  const proxiedSource = new Proxy(sourceEnvelope(), { getOwnPropertyDescriptor() { throw new Error('secret'); } });
  error(normalizeMarketObservation(observation({ sourceEnvelope: proxiedSource })), 'invalid_input');
  const proxiedOutcome = new Proxy(outcome('home', '2'), { getPrototypeOf() { throw new Error('secret'); } });
  error(normalizeMarketObservation(observation({ outcomes: [proxiedOutcome] })), 'invalid_input');
  const prototypeTrap = new Proxy({}, { getPrototypeOf() { throw new Error('secret'); } });
  error(normalizeMarketObservation(prototypeTrap), 'invalid_input');
});

test('rejects direct cycles, indirect cycles, shared children and shared nested arrays', () => {
  const direct = {};
  direct.self = direct;
  error(inspectJsonCompatibleInput(direct), 'repeated_reference', '$.self');
  const indirectA = {};
  const indirectB = { back: indirectA };
  indirectA.next = indirectB;
  error(inspectJsonCompatibleInput(indirectA), 'repeated_reference', '$.next.back');
  const child = { value: 1 };
  error(inspectJsonCompatibleInput({ left: child, right: child }), 'repeated_reference', '$.right');
  const sharedArray = [1, 2];
  error(inspectJsonCompatibleInput({ left: sharedArray, right: { nested: sharedArray } }), 'repeated_reference', '$.right.nested');
});

test('rejects alias amplification before a shared subtree is inspected twice', () => {
  let prototypeVisits = 0;
  const shared = new Proxy({ branch: [{ leaf: 'safe' }] }, {
    getPrototypeOf(target) { prototypeVisits += 1; return Reflect.getPrototypeOf(target); },
  });
  let amplified = shared;
  for (let depth = 0; depth < 5; depth += 1) amplified = { left: amplified, right: amplified };
  error(inspectJsonCompatibleInput(amplified), 'repeated_reference');
  assert.equal(prototypeVisits, 1);
});

function treeWithValueCount(totalValues) {
  if (totalValues === 1) return null;
  const childCount = Math.min(UNTRUSTED_INSPECTION_LIMITS.maxArrayLength, totalValues - 1);
  const remaining = totalValues - 1;
  const base = Math.floor(remaining / childCount);
  const extra = remaining % childCount;
  return Array.from({ length: childCount }, (_, index) => treeWithValueCount(base + (index < extra ? 1 : 0)));
}

function propertyChain(keyCounts) {
  let child;
  for (let index = keyCounts.length - 1; index >= 0; index -= 1) {
    const record = {};
    const count = keyCounts[index];
    if (child !== undefined) record.a = child;
    const start = child === undefined ? 0 : 1;
    for (let key = start; key < count; key += 1) record[`p${index}_${key}`] = null;
    child = record;
  }
  const leaf = child;
  let cursor = leaf;
  while (cursor.a) cursor = cursor.a;
  const firstKey = Object.keys(cursor)[0];
  Object.defineProperty(cursor, firstKey, { enumerable: true, get() { throw new Error('must not escape'); } });
  return leaf;
}

test('enforces exact and one-unit-over aggregate node, property and UTF-16 string budgets', () => {
  const exactNodes = inspectJsonCompatibleInput(treeWithValueCount(UNTRUSTED_INSPECTION_LIMITS.maxVisitedValues));
  assert.equal(exactNodes.ok, true);
  assert.equal(exactNodes.value.usage.visitedValues, UNTRUSTED_INSPECTION_LIMITS.maxVisitedValues);
  const overNodes = inspectJsonCompatibleInput(treeWithValueCount(UNTRUSTED_INSPECTION_LIMITS.maxVisitedValues + 1));
  const nodeError = error(overNodes, 'inspection_limit_exceeded');
  assert.equal(nodeError.metadata.limitName, 'maxVisitedValues');
  assert.equal(nodeError.metadata.actual, UNTRUSTED_INSPECTION_LIMITS.maxVisitedValues + 1);

  const exactProperties = inspectJsonCompatibleInput(propertyChain([64, 64, 64, 64, 64, 64, 64, 1, 63]));
  assert.equal(exactProperties.ok, false);
  assert.equal(exactProperties.error.code, 'invalid_input');
  assert.equal(exactProperties.error.metadata.usage.propertiesAndEntries, UNTRUSTED_INSPECTION_LIMITS.maxPropertiesAndEntries);
  const overProperties = inspectJsonCompatibleInput(propertyChain([64, 64, 64, 64, 64, 64, 64, 1, 64]));
  const propertyError = error(overProperties, 'inspection_limit_exceeded');
  assert.equal(propertyError.metadata.limitName, 'maxPropertiesAndEntries');
  assert.equal(propertyError.metadata.actual, UNTRUSTED_INSPECTION_LIMITS.maxPropertiesAndEntries + 1);

  const exactStrings = inspectJsonCompatibleInput(Array.from({ length: 16 }, () => 'x'.repeat(1_024)));
  assert.equal(exactStrings.ok, true);
  assert.equal(exactStrings.value.usage.cumulativeStringCodeUnits, UNTRUSTED_INSPECTION_LIMITS.maxCumulativeStringCodeUnits);
  const overStrings = inspectJsonCompatibleInput([...Array.from({ length: 16 }, () => 'x'.repeat(1_024)), 'x']);
  const stringError = error(overStrings, 'inspection_limit_exceeded');
  assert.equal(stringError.metadata.limitName, 'maxCumulativeStringCodeUnits');
  assert.equal(stringError.metadata.actual, UNTRUSTED_INSPECTION_LIMITS.maxCumulativeStringCodeUnits + 1);
});

test('accepts an ordinary maximum valid 16-outcome observation within aggregate budgets', () => {
  const outcomes = Array.from({ length: MAX_MARKET_OUTCOMES }, (_, index) => outcome(`outcome-${index}`, '2'));
  const result = normalizeMarketObservation(observation({ outcomes }));
  assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
  assert.equal(result.value.outcomes.length, MAX_MARKET_OUTCOMES);
});

test('fails closed for sparse, primitive, oversized and malformed runtime values', () => {
  for (const input of [null, undefined, 1, 'x', []]) error(normalizeMarketObservation(input), 'invalid_input');
  const sparse = [];
  sparse.length = 2;
  error(normalizeMarketObservation(observation({ outcomes: sparse })), 'invalid_input', '$.outcomes[0]');
  error(normalizeMarketObservation(observation({ eventId: 'x'.repeat(MAX_CANONICAL_ID_LENGTH + 1) })), 'invalid_identifier');
  error(normalizeMarketObservation(observation({ sourceEnvelope: sourceEnvelope({ providerRef: 'r'.repeat(MAX_SOURCE_REFERENCE_LENGTH + 1) }) })), 'invalid_reference');
  error(normalizeMarketObservation(observation({ outcomes: [outcome('home', '2', 'r'.repeat(MAX_OBSERVATION_REF_LENGTH + 1))] })), 'invalid_reference');
  const tooMany = Array.from({ length: MAX_MARKET_OUTCOMES + 1 }, (_, index) => outcome(`o-${index}`, '2'));
  error(normalizeMarketObservation(observation({ outcomes: tooMany })), 'market_limit_exceeded');
});

test('normalizes all supported market states but handoff rejects every prohibited state itself', () => {
  const cases = [
    [observation({ completeness: 'incomplete' }), 'incomplete_market', '$.completeness'],
    [observation({ asOf: '2026-08-28T01:01:00.001Z' }), 'stale_observation', '$.outcomes[0].freshness'],
    [observation({ marketAvailability: 'suspended' }), 'suspended_market', '$.marketAvailability'],
    [observation({ marketAvailability: 'unavailable' }), 'unavailable_price', '$.marketAvailability'],
    [observation({ outcomes: [{ ...outcome('home', '2'), availability: 'suspended' }, outcome('away', '2')] }), 'suspended_outcome', '$.outcomes[0].availability'],
    [observation({ outcomes: [{ outcomeId: 'home', availability: 'unavailable', observationRef: 'quote/home', identity: identity('home') }, outcome('away', '2')] }), 'unavailable_price', '$.outcomes[0].availability'],
    [observation({ outcomes: [outcome('only', '2')] }), 'incomplete_market', '$.outcomes'],
  ];
  for (const [input, code, path] of cases) {
    assert.equal(normalizeMarketObservation(input).ok, true);
    error(toOddsMarketInput(input), code, path);
  }
});

test('distinguishes omitted from explicit undefined prices', () => {
  const unavailableOmitted = observation({ outcomes: [
    { outcomeId: 'home', availability: 'unavailable', observationRef: 'quote/home', identity: identity('home') }, outcome('away', '2'),
  ] });
  assert.equal(normalizeMarketObservation(unavailableOmitted).ok, true);
  error(normalizeMarketObservation(observation({ outcomes: [
    { outcomeId: 'home', decimalOdds: undefined, availability: 'unavailable', observationRef: 'quote/home', identity: identity('home') }, outcome('away', '2'),
  ] })), 'invalid_input', '$.outcomes[0].decimalOdds');
  error(normalizeMarketObservation(observation({ outcomes: [
    { outcomeId: 'home', availability: 'active', observationRef: 'quote/home', identity: identity('home') }, outcome('away', '2'),
  ] })), 'invalid_price', '$.outcomes[0].decimalOdds');
  error(normalizeMarketObservation(observation({ outcomes: [
    { outcomeId: 'home', decimalOdds: undefined, availability: 'active', observationRef: 'quote/home', identity: identity('home') }, outcome('away', '2'),
  ] })), 'invalid_input', '$.outcomes[0].decimalOdds');
});

test('successful handoff is calculation-ready for implied probability, overround and de-vig', () => {
  const oddsInput = value(toOddsMarketInput(observation()));
  assert.ok(Object.isFrozen(oddsInput));
  assert.ok(Object.isFrozen(oddsInput.prices));
  assert.equal(value(decimalOddsToImpliedProbability(oddsInput.prices[0].decimalOdds)).rawImpliedProbability, '0.526315789');
  assert.equal(value(calculateMarketOverround(oddsInput)).overround, '0.052631579');
  assert.deepEqual(value(removeMarginProportionally(oddsInput)).outcomes.map((item) => item.fairProbability), ['0.500000000', '0.500000000']);
});

function manualFixtures(input = observation()) {
  return [
    { format: 'canonical-manual-v1', observation: input },
    { format: 'compact-manual-v1', sourceEnvelope: input.sourceEnvelope,
      identity: { sport: input.sportId, competition: input.competitionId, event: input.eventId, market: input.marketId },
      times: { start: input.eventStartAt, asOf: input.asOf }, policy: input.freshnessPolicy,
      completeness: input.completeness, status: input.marketAvailability, selections: input.outcomes },
  ];
}

test('both strict manual formats preserve identical provenance and normalization', () => {
  const [canonical, compact] = manualFixtures().map((fixture) => value(normalizeManualMarketFixture(fixture)));
  assert.deepEqual(compact, canonical);
  assert.deepEqual(compact.sourceEnvelope, sourceEnvelope());
  const invalid = observation({ sourceEnvelope: sourceEnvelope({ termsRef: '' }) });
  const invalidResults = manualFixtures(invalid).map((fixture) => normalizeManualMarketFixture(fixture));
  assert.deepEqual(invalidResults.map((result) => [result.ok, result.error.code]), [[false, 'invalid_reference'], [false, 'invalid_reference']]);
});

test('manual fixture schemas reject unknown fields, misspellings and credentials', () => {
  error(normalizeManualMarketFixture({ ...manualFixtures()[0], extra: true }), 'unknown_field', '$.extra');
  error(normalizeManualMarketFixture({ ...manualFixtures()[1], completness: 'complete' }), 'unknown_field', '$.completness');
  error(normalizeManualMarketFixture({ ...manualFixtures()[1], API_KEY: 'hidden' }), 'credential_field', '$.API_KEY');
  error(normalizeManualMarketFixture({ ...manualFixtures()[1], times: { start: times.eventStartAt, asof: times.asOf } }), 'unknown_field', '$.times.asof');
});

test('manual adapter contains hostile inspection but lets post-boundary defects propagate', () => {
  const hostile = {};
  Object.defineProperty(hostile, 'format', { enumerable: true, get() { throw new Error('hostile fixture'); } });
  error(normalizeManualMarketFixture(hostile), 'invalid_input');

  const originalParse = Date.parse;
  Date.parse = () => { throw new Error('simulated internal defect'); };
  try {
    assert.throws(() => normalizeManualMarketFixture(manualFixtures()[0]), /simulated internal defect/);
  } finally {
    Date.parse = originalParse;
  }
  assert.equal(Date.parse, originalParse);
  assert.equal(normalizeManualMarketFixture(manualFixtures()[0]).ok, true);
});

test('success and failure envelopes and every nested contract are frozen', () => {
  const success = normalizeMarketObservation(observation());
  assert.ok(Object.isFrozen(success));
  assert.ok(Object.isFrozen(success.value));
  assert.ok(Object.isFrozen(success.value.sourceEnvelope.retention));
  const failed = normalizeMarketObservation({ ...observation(), unknown: { nested: true } });
  assert.ok(Object.isFrozen(failed));
  assert.ok(Object.isFrozen(failed.error));
  const indexedFailure = toOddsMarketInput(observation({ outcomes: [{ ...outcome('home', '2'), availability: 'suspended' }, outcome('away', '2')] }));
  assert.ok(Object.isFrozen(indexedFailure.error.metadata));
  const hostileFailed = normalizeMarketObservation(new Proxy({}, { ownKeys() { throw new Error('hidden'); } }));
  assert.ok(Object.isFrozen(hostileFailed));
  assert.ok(Object.isFrozen(hostileFailed.error));

  assert.throws(() => { success.value.sourceEnvelope.sourceId = 'changed'; }, TypeError);
  assert.throws(() => { success.value.outcomes.push(outcome('third', '3')); }, TypeError);
  assert.throws(() => { failed.error.message = 'changed'; }, TypeError);
  assert.throws(() => { indexedFailure.error.metadata.outcomeId = 'changed'; }, TypeError);
});

test('permutation preserves normalized values by outcome identity', () => {
  const first = value(normalizeMarketObservation(observation()));
  const second = value(normalizeMarketObservation(observation({ outcomes: [...observation().outcomes].reverse() })));
  const keyed = (snapshot) => Object.fromEntries(snapshot.outcomes.map((item) => [item.outcomeId, { decimalOdds: item.decimalOdds, observationRef: item.observationRef, freshness: item.freshness }]));
  assert.deepEqual(keyed(second), keyed(first));
});
