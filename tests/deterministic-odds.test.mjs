import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_DECIMAL_ODDS_INPUT_LENGTH,
  MAX_DECIMAL_ODDS_MICROS,
  MAX_MARKET_OUTCOMES,
  MAX_OBSERVATION_REF_LENGTH,
  MAX_OUTCOME_ID_LENGTH,
  MAX_PROBABILITY_INPUT_LENGTH,
  PROBABILITY_SCALE,
  calculateExpectedValue,
  calculateMarketOverround,
  decimalOddsToImpliedProbability,
  removeMarginProportionally,
  validateDecimalOdds,
} from '../src/domain/intelligence/odds.ts';

const active = (outcomeId, decimalOdds, observationRef) => ({
  outcomeId,
  decimalOdds,
  availability: 'active',
  freshness: 'current',
  ...(observationRef ? { observationRef } : {}),
});

const complete = (...prices) => ({ completeness: 'complete', prices });

function value(result) {
  assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
  return result.value;
}

function errorCode(result) {
  assert.equal(result.ok, false);
  return result.error.code;
}

function error(result) {
  assert.equal(result.ok, false);
  return result.error;
}

test('validates and canonicalises decimal odds without binary floating-point input', () => {
  assert.deepEqual(value(validateDecimalOdds('2')), {
    decimalOdds: '2.000000',
    decimalOddsMicros: '2000000',
  });
  assert.equal(value(validateDecimalOdds('1.000001')).decimalOddsMicros, '1000001');
  for (const invalid of [
    '1', '1.0', '0', '-2', '+2', ' 2', '2 ', '2e0', '.2', '2.', '2..0', '2.0000001', '02.00',
    'Infinity', NaN, Infinity,
  ]) {
    const result = validateDecimalOdds(invalid);
    assert.equal(result.ok, false);
  }
  assert.equal(errorCode(validateDecimalOdds(NaN)), 'non_finite_price');
  assert.equal(value(validateDecimalOdds('10000.000000')).decimalOddsMicros, MAX_DECIMAL_ODDS_MICROS.toString());
  assert.equal(errorCode(validateDecimalOdds('10000.000001')), 'odds_out_of_range');
  assert.equal(errorCode(validateDecimalOdds('9'.repeat(MAX_DECIMAL_ODDS_INPUT_LENGTH + 1))), 'input_limit_exceeded');
});

test('converts decimal odds to raw implied probability with half-even nanos rounding', () => {
  assert.equal(value(decimalOddsToImpliedProbability('2')).rawImpliedProbability, '0.500000000');
  assert.equal(value(decimalOddsToImpliedProbability('3')).rawImpliedProbability, '0.333333333');
  assert.equal(value(decimalOddsToImpliedProbability('1.000001')).rawImpliedProbability, '0.999999000');
  // 1e15 / 1,638,400 = 610,351,562.5; the even lower nano wins the exact tie.
  assert.equal(value(decimalOddsToImpliedProbability('1.638400')).rawImpliedProbabilityNanos, '610351562');
});

test('calculates even two-way overround and a proportional fair baseline', () => {
  const market = complete(active('home', '1.90', 'price-1'), active('away', '1.90', 'price-2'));
  const overround = value(calculateMarketOverround(market));
  assert.equal(overround.impliedProbabilitySum, '1.052631579');
  assert.equal(overround.overround, '0.052631579');

  const baseline = value(removeMarginProportionally(market));
  assert.deepEqual(baseline.method, { id: 'proportional', version: '1' });
  assert.deepEqual(baseline.outcomes.map((outcome) => outcome.fairProbability), ['0.500000000', '0.500000000']);
  assert.equal(baseline.outcomes[0].observationRef, 'price-1');
});

test('normalises an asymmetric two-way market and preserves exact probability sum', () => {
  const baseline = value(removeMarginProportionally(complete(active('favourite', '1.50'), active('underdog', '2.80'))));
  assert.deepEqual(baseline.outcomes.map((outcome) => outcome.fairProbability), ['0.651162791', '0.348837209']);
  assert.equal(baseline.fairProbabilitySumNanos, PROBABILITY_SCALE.toString());
  assert.equal(baseline.outcomes.reduce((sum, outcome) => sum + BigInt(outcome.fairProbabilityNanos), 0n), PROBABILITY_SCALE);
});

test('supports multi-outcome, zero-margin and high-overround books', () => {
  const threeWay = value(removeMarginProportionally(complete(
    active('one', '2.20'), active('draw', '3.40'), active('two', '3.60'),
  )));
  assert.equal(threeWay.outcomes.length, 3);
  assert.equal(threeWay.outcomes.reduce((sum, outcome) => sum + BigInt(outcome.fairProbabilityNanos), 0n), PROBABILITY_SCALE);

  const zeroMargin = value(calculateMarketOverround(complete(active('a', '2'), active('b', '2'))));
  assert.equal(zeroMargin.overround, '0.000000000');

  const highMargin = value(calculateMarketOverround(complete(active('a', '1.20'), active('b', '1.20'))));
  assert.equal(highMargin.overround, '0.666666667');

  const negativeMargin = value(calculateMarketOverround(complete(active('a', '3'), active('b', '3'))));
  assert.equal(negativeMargin.impliedProbabilitySumNanos, '666666667');
  assert.equal(negativeMargin.overroundNanos, '-333333333');
});

test('rounds exact overround half-nano boundaries independently with ties to even', () => {
  // 1/1.6384 + 1/2 = 1.1103515625, whose lower nano is even.
  const evenLower = value(calculateMarketOverround(complete(active('a', '1.6384'), active('b', '2'))));
  assert.equal(evenLower.impliedProbabilitySumNanos, '1110351562');
  assert.equal(evenLower.overroundNanos, '110351562');

  // 1/1.6384 + 1/512 = 0.6123046875, whose lower nano is odd.
  const oddLower = value(calculateMarketOverround(complete(active('a', '1.6384'), active('b', '512'))));
  assert.equal(oddLower.impliedProbabilitySumNanos, '612304688');
  assert.equal(oddLower.overroundNanos, '-387695312');
});

test('uses largest remainder and original order only to break exact ties', () => {
  const tied = value(removeMarginProportionally(complete(active('first', '3'), active('second', '3'), active('third', '3'))));
  assert.deepEqual(tied.outcomes.map(({ outcomeId, fairProbabilityNanos, allocationAdjustmentNanos }) => ({
    outcomeId, fairProbabilityNanos, allocationAdjustmentNanos,
  })), [
    { outcomeId: 'first', fairProbabilityNanos: '333333334', allocationAdjustmentNanos: '1' },
    { outcomeId: 'second', fairProbabilityNanos: '333333333', allocationAdjustmentNanos: '0' },
    { outcomeId: 'third', fairProbabilityNanos: '333333333', allocationAdjustmentNanos: '0' },
  ]);

  const reversedTie = value(removeMarginProportionally(complete(active('third', '3'), active('second', '3'), active('first', '3'))));
  assert.equal(reversedTie.outcomes[0].outcomeId, 'third');
  assert.equal(reversedTie.outcomes[0].allocationAdjustmentNanos, '1');

  const marketA = value(removeMarginProportionally(complete(active('fav', '1.5'), active('dog', '2.8'))));
  const marketB = value(removeMarginProportionally(complete(active('dog', '2.8'), active('fav', '1.5'))));
  assert.deepEqual(
    Object.fromEntries(marketA.outcomes.map((item) => [item.outcomeId, item.fairProbabilityNanos])),
    Object.fromEntries(marketB.outcomes.map((item) => [item.outcomeId, item.fairProbabilityNanos])),
  );
});

test('fails explicitly for incomplete, missing, suspended, stale and non-finite market prices', () => {
  assert.equal(errorCode(removeMarginProportionally(complete())), 'incomplete_market');
  assert.equal(errorCode(removeMarginProportionally({ completeness: 'incomplete', prices: [active('a', '2')] })), 'incomplete_market');
  assert.equal(errorCode(removeMarginProportionally(complete(active('a', '2')))), 'incomplete_market');
  assert.equal(errorCode(removeMarginProportionally(complete(active('a', null), active('b', '2')))), 'missing_price');
  assert.equal(errorCode(removeMarginProportionally(complete(
    { ...active('a', '2'), availability: 'suspended' }, active('b', '2'),
  ))), 'suspended_price');
  assert.equal(errorCode(removeMarginProportionally(complete(
    { ...active('a', '2'), freshness: 'stale' }, active('b', '2'),
  ))), 'stale_price');
  assert.equal(errorCode(removeMarginProportionally(complete(active('a', Infinity), active('b', '2')))), 'non_finite_price');
  assert.equal(errorCode(removeMarginProportionally(complete(active('same', '2'), active('same', '2')))), 'invalid_outcome_id');
});

test('fails closed for hostile malformed JavaScript market inputs without throwing', () => {
  const sparse = [];
  sparse.length = 2;
  const malformed = [
    [null, 'invalid_input', '$'],
    [42, 'invalid_input', '$'],
    [{ completeness: 'complete' }, 'invalid_market', '$.prices'],
    [{ completeness: 'unknown', prices: [] }, 'invalid_market', '$.completeness'],
    [{ completeness: 'complete', prices: sparse }, 'invalid_market', '$.prices[0]'],
    [complete(null, active('b', '2')), 'invalid_market', '$.prices[0]'],
    [complete('price', active('b', '2')), 'invalid_market', '$.prices[0]'],
    [complete({ outcomeId: 'a', decimalOdds: '2', freshness: 'current' }, active('b', '2')), 'invalid_market', '$.prices[0].availability'],
    [complete({ ...active('a', '2'), availability: 'unknown' }, active('b', '2')), 'invalid_market', '$.prices[0].availability'],
    [complete({ ...active('a', '2'), freshness: 'unknown' }, active('b', '2')), 'invalid_market', '$.prices[0].freshness'],
    [complete({ ...active('a', '2'), outcomeId: 1 }, active('b', '2')), 'invalid_outcome_id', '$.prices[0].outcomeId'],
    [complete(active('bad id', '2'), active('b', '2')), 'invalid_outcome_id', '$.prices[0].outcomeId'],
    [complete(active('a'.repeat(MAX_OUTCOME_ID_LENGTH + 1), '2'), active('b', '2')), 'invalid_outcome_id', '$.prices[0].outcomeId'],
    [complete({ ...active('a', '2'), observationRef: '' }, active('b', '2')), 'invalid_observation_ref', '$.prices[0].observationRef'],
    [complete({ ...active('a', '2'), observationRef: 'r'.repeat(MAX_OBSERVATION_REF_LENGTH + 1) }, active('b', '2')), 'invalid_observation_ref', '$.prices[0].observationRef'],
  ];
  for (const [input, code, path] of malformed) {
    const result = removeMarginProportionally(input);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, code);
    assert.equal(result.error.path, path);
  }
});

test('rejects excessive outcome counts before validating or allocating outcomes', () => {
  const prices = Array.from({ length: MAX_MARKET_OUTCOMES + 1 }, (_, index) => active(`outcome-${index}`, '2'));
  prices[0] = null;
  const result = removeMarginProportionally(complete(...prices));
  assert.equal(errorCode(result), 'market_limit_exceeded');
  assert.equal(error(result).path, '$.prices');
});

test('bounded valid markets cannot normalize an outcome to zero nanos', () => {
  const prices = Array.from({ length: MAX_MARKET_OUTCOMES }, (_, index) => (
    active(`outcome-${index}`, index === 0 ? '10000' : '1.000001')
  ));
  const baseline = value(removeMarginProportionally(complete(...prices)));
  assert.ok(baseline.outcomes.every((outcome) => BigInt(outcome.fairProbabilityNanos) > 0n));
});

test('calculates positive, zero and negative binary unit-stake expected value', () => {
  assert.equal(value(calculateExpectedValue({ decimalOdds: '2.20', independentProbability: '0.500000000' })).expectedValuePerUnit, '0.100000000');
  assert.equal(value(calculateExpectedValue({ decimalOdds: '2', independentProbability: '0.500000000' })).expectedValuePerUnit, '0.000000000');
  assert.equal(value(calculateExpectedValue({ decimalOdds: '1.80', independentProbability: '0.500000000' })).expectedValuePerUnit, '-0.100000000');
  assert.equal(errorCode(calculateExpectedValue({ decimalOdds: '2', independentProbability: '1.000000001' })), 'invalid_probability');
  assert.equal(errorCode(calculateExpectedValue({ decimalOdds: '2', independentProbability: 0.5 })), 'invalid_probability');
  assert.equal(value(calculateExpectedValue({ decimalOdds: '2', independentProbability: '0' })).expectedValueNanos, '-1000000000');
  assert.equal(value(calculateExpectedValue({ decimalOdds: '2', independentProbability: '1' })).expectedValueNanos, '1000000000');
});

test('fails closed for missing and malformed expected-value inputs', () => {
  for (const input of [null, undefined, 1, 'input', []]) {
    assert.equal(errorCode(calculateExpectedValue(input)), 'invalid_input');
  }
  assert.equal(errorCode(calculateExpectedValue({ independentProbability: '0.5' })), 'missing_price');
  assert.equal(error(calculateExpectedValue({ independentProbability: '0.5' })).path, '$.decimalOdds');
  assert.equal(errorCode(calculateExpectedValue({ decimalOdds: '2' })), 'invalid_probability');
  assert.equal(error(calculateExpectedValue({ decimalOdds: '2' })).path, '$.independentProbability');
  assert.equal(errorCode(calculateExpectedValue({
    decimalOdds: '2', independentProbability: `0.${'0'.repeat(MAX_PROBABILITY_INPUT_LENGTH)}`,
  })), 'input_limit_exceeded');
});

test('preserves valid observation references in market inputs and outcomes', () => {
  const baseline = value(removeMarginProportionally(complete(
    active('home', '2', 'source/quote:home@v1'),
    active('away', '2', 'source/quote:away@v1'),
  )));
  assert.deepEqual(baseline.inputs.map((item) => item.observationRef), ['source/quote:home@v1', 'source/quote:away@v1']);
  assert.deepEqual(baseline.outcomes.map((item) => item.observationRef), ['source/quote:home@v1', 'source/quote:away@v1']);
});

test('matches independent golden shares and keeps allocation error below one nano', () => {
  const oddsMicros = [2_000_000n, 3_000_000n, 6_000_000n];
  const baseline = value(removeMarginProportionally(complete(
    active('half', '2'), active('third', '3'), active('sixth', '6'),
  )));
  assert.equal(baseline.overroundNanos, '0');
  assert.deepEqual(baseline.outcomes.map((item) => item.fairProbabilityNanos), ['500000000', '333333333', '166666667']);

  const commonDenominator = oddsMicros.reduce((product, odds) => product * odds, 1n);
  const weights = oddsMicros.map((odds) => commonDenominator / odds);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0n);
  baseline.outcomes.forEach((outcome, index) => {
    const allocated = BigInt(outcome.fairProbabilityNanos);
    const signedErrorNumerator = allocated * weightTotal - weights[index] * PROBABILITY_SCALE;
    const absoluteErrorNumerator = signedErrorNumerator < 0n ? -signedErrorNumerator : signedErrorNumerator;
    assert.ok(absoluteErrorNumerator < weightTotal, `${outcome.outcomeId} differs by at least one nano`);
  });
});

test('uses half-even rounding at exact expected-value nano ties', () => {
  assert.equal(value(calculateExpectedValue({ decimalOdds: '1.500000', independentProbability: '0.000000001' })).expectedValueNanos, '-999999998');
  assert.equal(value(calculateExpectedValue({ decimalOdds: '1.500000', independentProbability: '0.000000003' })).expectedValueNanos, '-999999996');
});

test('probability normalisation invariant holds across deterministic generated books', () => {
  let state = 0x12345678;
  const next = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state;
  };
  for (let sample = 0; sample < 500; sample += 1) {
    const outcomeCount = 2 + (next() % 7);
    const prices = Array.from({ length: outcomeCount }, (_, index) => {
      const oddsMicros = 1_000_001 + (next() % 49_000_000);
      const integer = Math.floor(oddsMicros / 1_000_000);
      const fraction = String(oddsMicros % 1_000_000).padStart(6, '0');
      return active(`outcome-${index}`, `${integer}.${fraction}`);
    });
    const baseline = value(removeMarginProportionally(complete(...prices)));
    const fairSum = baseline.outcomes.reduce((sum, outcome) => sum + BigInt(outcome.fairProbabilityNanos), 0n);
    assert.equal(fairSum, PROBABILITY_SCALE);
    assert.ok(baseline.outcomes.every((outcome) => BigInt(outcome.fairProbabilityNanos) > 0n));
    assert.equal(value(removeMarginProportionally(complete(...prices))).outcomes.map((outcome) => outcome.fairProbabilityNanos).join(','), baseline.outcomes.map((outcome) => outcome.fairProbabilityNanos).join(','));
  }
});
