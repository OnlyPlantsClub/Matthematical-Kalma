import assert from 'node:assert/strict';
import test from 'node:test';

import {
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

test('validates and canonicalises decimal odds without binary floating-point input', () => {
  assert.deepEqual(value(validateDecimalOdds('2')), {
    decimalOdds: '2.000000',
    decimalOddsMicros: '2000000',
  });
  assert.equal(value(validateDecimalOdds('1.000001')).decimalOddsMicros, '1000001');
  for (const invalid of ['1', '1.0', '0', '-2', '2.0000001', '02.00', 'Infinity', NaN, Infinity]) {
    const result = validateDecimalOdds(invalid);
    assert.equal(result.ok, false);
  }
  assert.equal(errorCode(validateDecimalOdds(NaN)), 'non_finite_price');
});

test('converts decimal odds to raw implied probability with half-even nanos rounding', () => {
  assert.equal(value(decimalOddsToImpliedProbability('2')).rawImpliedProbability, '0.500000000');
  assert.equal(value(decimalOddsToImpliedProbability('3')).rawImpliedProbability, '0.333333333');
  assert.equal(value(decimalOddsToImpliedProbability('1.000001')).rawImpliedProbability, '0.999999000');
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
});

test('fails explicitly for incomplete, missing, suspended, stale and non-finite market prices', () => {
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
  assert.equal(errorCode(removeMarginProportionally(complete(active('same', '2'), active('same', '2')))), 'incomplete_market');
});

test('calculates positive, zero and negative binary unit-stake expected value', () => {
  assert.equal(value(calculateExpectedValue({ decimalOdds: '2.20', independentProbability: '0.500000000' })).expectedValuePerUnit, '0.100000000');
  assert.equal(value(calculateExpectedValue({ decimalOdds: '2', independentProbability: '0.500000000' })).expectedValuePerUnit, '0.000000000');
  assert.equal(value(calculateExpectedValue({ decimalOdds: '1.80', independentProbability: '0.500000000' })).expectedValuePerUnit, '-0.100000000');
  assert.equal(errorCode(calculateExpectedValue({ decimalOdds: '2', independentProbability: '1.000000001' })), 'invalid_probability');
  assert.equal(errorCode(calculateExpectedValue({ decimalOdds: '2', independentProbability: 0.5 })), 'invalid_probability');
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
