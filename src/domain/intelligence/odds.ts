export const DECIMAL_ODDS_SCALE = 1_000_000n;
export const PROBABILITY_SCALE = 1_000_000_000n;

export const PROPORTIONAL_DEVIG_METHOD = {
  id: 'proportional',
  version: '1',
} as const;

export type CalculationErrorCode =
  | 'invalid_odds'
  | 'non_finite_price'
  | 'missing_price'
  | 'suspended_price'
  | 'stale_price'
  | 'incomplete_market'
  | 'invalid_probability';

export interface CalculationError {
  code: CalculationErrorCode;
  message: string;
  outcomeId?: string;
  inputIndex?: number;
}

export type CalculationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: CalculationError };

export interface PriceInput {
  outcomeId: string;
  decimalOdds: unknown;
  availability: 'active' | 'suspended';
  freshness: 'current' | 'stale';
  observationRef?: string;
}

export interface MarketPriceInput {
  completeness: 'complete' | 'incomplete';
  prices: readonly PriceInput[];
}

export interface ImpliedProbabilityCalculation {
  formulaVersion: 'decimal-implied-probability-v1';
  decimalOdds: string;
  decimalOddsMicros: string;
  rawImpliedProbability: string;
  rawImpliedProbabilityNanos: string;
}

export interface OverroundCalculation {
  formulaVersion: 'market-overround-v1';
  probabilityScale: '1000000000';
  impliedProbabilitySum: string;
  impliedProbabilitySumNanos: string;
  overround: string;
  overroundNanos: string;
  inputs: readonly {
    outcomeId: string;
    decimalOdds: string;
    decimalOddsMicros: string;
    observationRef?: string;
  }[];
}

export interface ProportionalMarketBaseline extends OverroundCalculation {
  method: typeof PROPORTIONAL_DEVIG_METHOD;
  fairProbabilitySum: '1.000000000';
  fairProbabilitySumNanos: '1000000000';
  outcomes: readonly {
    outcomeId: string;
    decimalOdds: string;
    decimalOddsMicros: string;
    rawImpliedProbability: string;
    rawImpliedProbabilityNanos: string;
    fairProbability: string;
    fairProbabilityNanos: string;
    allocationAdjustmentNanos: '0' | '1';
    observationRef?: string;
  }[];
}

export interface ExpectedValueInput {
  decimalOdds: unknown;
  independentProbability: unknown;
}

export interface ExpectedValueCalculation {
  formulaVersion: 'binary-unit-stake-ev-v1';
  decimalOdds: string;
  decimalOddsMicros: string;
  independentProbability: string;
  independentProbabilityNanos: string;
  expectedValuePerUnit: string;
  expectedValueNanos: string;
}

interface Fraction {
  numerator: bigint;
  denominator: bigint;
}

interface ValidatedPrice {
  outcomeId: string;
  oddsMicros: bigint;
  observationRef?: string;
}

const DECIMAL_ODDS_PATTERN = /^(?:0|[1-9]\d*)(?:\.(\d{1,6}))?$/;
const PROBABILITY_PATTERN = /^(?:0(?:\.(\d{1,9}))?|1(?:\.0{1,9})?)$/;

function success<T>(value: T): CalculationResult<T> {
  return { ok: true, value };
}

function failure<T>(error: CalculationError): CalculationResult<T> {
  return { ok: false, error };
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

function reduce(fraction: Fraction): Fraction {
  const divisor = greatestCommonDivisor(fraction.numerator, fraction.denominator);
  return {
    numerator: fraction.numerator / divisor,
    denominator: fraction.denominator / divisor,
  };
}

function add(left: Fraction, right: Fraction): Fraction {
  return reduce({
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

function roundHalfEven(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError('The rounding denominator must be positive.');
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  const doubled = remainder * 2n;
  const rounded = doubled > denominator || (doubled === denominator && quotient % 2n === 1n)
    ? quotient + 1n
    : quotient;
  return negative ? -rounded : rounded;
}

function formatScaled(value: bigint, scaleDigits: number): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const scale = 10n ** BigInt(scaleDigits);
  const integer = absolute / scale;
  const fractional = (absolute % scale).toString().padStart(scaleDigits, '0');
  return `${negative ? '-' : ''}${integer}.${fractional}`;
}

function parseDecimalOdds(input: unknown): CalculationResult<bigint> {
  if (typeof input === 'number' && !Number.isFinite(input)) {
    return failure({ code: 'non_finite_price', message: 'Decimal odds must be finite.' });
  }
  if (typeof input !== 'string') {
    return failure({ code: 'invalid_odds', message: 'Decimal odds must be a canonical decimal string.' });
  }
  const match = DECIMAL_ODDS_PATTERN.exec(input);
  if (!match) {
    return failure({
      code: 'invalid_odds',
      message: 'Decimal odds must be an unsigned canonical decimal string with at most 6 fractional digits.',
    });
  }
  const [integerPart, fractionalPart = ''] = input.split('.');
  const oddsMicros = BigInt(integerPart) * DECIMAL_ODDS_SCALE
    + BigInt(fractionalPart.padEnd(6, '0') || '0');
  if (oddsMicros <= DECIMAL_ODDS_SCALE) {
    return failure({ code: 'invalid_odds', message: 'Decimal odds must be greater than 1.000000.' });
  }
  return success(oddsMicros);
}

function parseProbability(input: unknown): CalculationResult<bigint> {
  if (typeof input !== 'string' || !PROBABILITY_PATTERN.test(input)) {
    return failure({
      code: 'invalid_probability',
      message: 'Independent probability must be a canonical decimal string from 0 to 1 with at most 9 fractional digits.',
    });
  }
  const [integerPart, fractionalPart = ''] = input.split('.');
  return success(BigInt(integerPart) * PROBABILITY_SCALE + BigInt(fractionalPart.padEnd(9, '0') || '0'));
}

function validateMarket(input: MarketPriceInput): CalculationResult<ValidatedPrice[]> {
  if (input.completeness !== 'complete' || input.prices.length < 2) {
    return failure({
      code: 'incomplete_market',
      message: 'A market calculation requires at least two exhaustive, mutually exclusive outcomes.',
    });
  }
  const seenOutcomeIds = new Set<string>();
  const validated: ValidatedPrice[] = [];
  for (const [inputIndex, price] of input.prices.entries()) {
    const context = { outcomeId: price.outcomeId, inputIndex };
    if (!price.outcomeId || seenOutcomeIds.has(price.outcomeId)) {
      return failure({
        code: 'incomplete_market',
        message: 'Every market outcome must have a unique non-empty outcomeId.',
        ...context,
      });
    }
    seenOutcomeIds.add(price.outcomeId);
    if (price.decimalOdds === null || price.decimalOdds === undefined || price.decimalOdds === '') {
      return failure({ code: 'missing_price', message: 'Every outcome requires a price.', ...context });
    }
    if (price.availability === 'suspended') {
      return failure({ code: 'suspended_price', message: 'Suspended prices cannot form a market calculation.', ...context });
    }
    if (price.freshness === 'stale') {
      return failure({ code: 'stale_price', message: 'Stale prices cannot form a market calculation.', ...context });
    }
    const parsed = parseDecimalOdds(price.decimalOdds);
    if (!parsed.ok) return failure({ ...parsed.error, ...context });
    validated.push({
      outcomeId: price.outcomeId,
      oddsMicros: parsed.value,
      ...(price.observationRef === undefined ? {} : { observationRef: price.observationRef }),
    });
  }
  return success(validated);
}

function impliedFraction(oddsMicros: bigint): Fraction {
  return reduce({ numerator: DECIMAL_ODDS_SCALE, denominator: oddsMicros });
}

function impliedProbabilityNanos(oddsMicros: bigint): bigint {
  return roundHalfEven(DECIMAL_ODDS_SCALE * PROBABILITY_SCALE, oddsMicros);
}

function buildOverround(prices: readonly ValidatedPrice[]): OverroundCalculation {
  const impliedTotal = prices.reduce<Fraction>(
    (total, price) => add(total, impliedFraction(price.oddsMicros)),
    { numerator: 0n, denominator: 1n },
  );
  const totalNanos = roundHalfEven(impliedTotal.numerator * PROBABILITY_SCALE, impliedTotal.denominator);
  const overroundNanos = totalNanos - PROBABILITY_SCALE;
  return {
    formulaVersion: 'market-overround-v1',
    probabilityScale: '1000000000',
    impliedProbabilitySum: formatScaled(totalNanos, 9),
    impliedProbabilitySumNanos: totalNanos.toString(),
    overround: formatScaled(overroundNanos, 9),
    overroundNanos: overroundNanos.toString(),
    inputs: prices.map((price) => ({
      outcomeId: price.outcomeId,
      decimalOdds: formatScaled(price.oddsMicros, 6),
      decimalOddsMicros: price.oddsMicros.toString(),
      ...(price.observationRef === undefined ? {} : { observationRef: price.observationRef }),
    })),
  };
}

export function validateDecimalOdds(decimalOdds: unknown): CalculationResult<{
  decimalOdds: string;
  decimalOddsMicros: string;
}> {
  const parsed = parseDecimalOdds(decimalOdds);
  if (!parsed.ok) return parsed;
  return success({
    decimalOdds: formatScaled(parsed.value, 6),
    decimalOddsMicros: parsed.value.toString(),
  });
}

export function decimalOddsToImpliedProbability(decimalOdds: unknown): CalculationResult<ImpliedProbabilityCalculation> {
  const parsed = parseDecimalOdds(decimalOdds);
  if (!parsed.ok) return parsed;
  const probabilityNanos = impliedProbabilityNanos(parsed.value);
  return success({
    formulaVersion: 'decimal-implied-probability-v1',
    decimalOdds: formatScaled(parsed.value, 6),
    decimalOddsMicros: parsed.value.toString(),
    rawImpliedProbability: formatScaled(probabilityNanos, 9),
    rawImpliedProbabilityNanos: probabilityNanos.toString(),
  });
}

export function calculateMarketOverround(input: MarketPriceInput): CalculationResult<OverroundCalculation> {
  const validated = validateMarket(input);
  if (!validated.ok) return validated;
  return success(buildOverround(validated.value));
}

export function removeMarginProportionally(input: MarketPriceInput): CalculationResult<ProportionalMarketBaseline> {
  const validated = validateMarket(input);
  if (!validated.ok) return validated;

  const implied = validated.value.map((price) => impliedFraction(price.oddsMicros));
  const impliedTotal = implied.reduce<Fraction>(add, { numerator: 0n, denominator: 1n });
  const exactFair = implied.map((probability) => reduce({
    numerator: probability.numerator * impliedTotal.denominator,
    denominator: probability.denominator * impliedTotal.numerator,
  }));
  const allocations = exactFair.map((probability, inputIndex) => {
    const scaledNumerator = probability.numerator * PROBABILITY_SCALE;
    return {
      inputIndex,
      nanos: scaledNumerator / probability.denominator,
      remainder: scaledNumerator % probability.denominator,
      denominator: probability.denominator,
      adjusted: false,
    };
  });
  let residual = PROBABILITY_SCALE - allocations.reduce((sum, allocation) => sum + allocation.nanos, 0n);
  const ranked = [...allocations].sort((left, right) => {
    const comparison = left.remainder * right.denominator - right.remainder * left.denominator;
    if (comparison === 0n) return left.inputIndex - right.inputIndex;
    return comparison > 0n ? -1 : 1;
  });
  for (const allocation of ranked) {
    if (residual === 0n) break;
    allocation.nanos += 1n;
    allocation.adjusted = true;
    residual -= 1n;
  }
  if (residual !== 0n) throw new Error('Probability apportionment failed to preserve the probability scale.');

  const overround = buildOverround(validated.value);
  return success({
    ...overround,
    method: PROPORTIONAL_DEVIG_METHOD,
    fairProbabilitySum: '1.000000000',
    fairProbabilitySumNanos: '1000000000',
    outcomes: validated.value.map((price, inputIndex) => {
      const rawNanos = impliedProbabilityNanos(price.oddsMicros);
      const allocation = allocations[inputIndex];
      return {
        outcomeId: price.outcomeId,
        decimalOdds: formatScaled(price.oddsMicros, 6),
        decimalOddsMicros: price.oddsMicros.toString(),
        rawImpliedProbability: formatScaled(rawNanos, 9),
        rawImpliedProbabilityNanos: rawNanos.toString(),
        fairProbability: formatScaled(allocation.nanos, 9),
        fairProbabilityNanos: allocation.nanos.toString(),
        allocationAdjustmentNanos: allocation.adjusted ? '1' : '0',
        ...(price.observationRef === undefined ? {} : { observationRef: price.observationRef }),
      };
    }),
  });
}

export function calculateExpectedValue(input: ExpectedValueInput): CalculationResult<ExpectedValueCalculation> {
  const parsedOdds = parseDecimalOdds(input.decimalOdds);
  if (!parsedOdds.ok) return parsedOdds;
  const parsedProbability = parseProbability(input.independentProbability);
  if (!parsedProbability.ok) return parsedProbability;
  const grossReturnNanos = roundHalfEven(parsedOdds.value * parsedProbability.value, DECIMAL_ODDS_SCALE);
  const expectedValueNanos = grossReturnNanos - PROBABILITY_SCALE;
  return success({
    formulaVersion: 'binary-unit-stake-ev-v1',
    decimalOdds: formatScaled(parsedOdds.value, 6),
    decimalOddsMicros: parsedOdds.value.toString(),
    independentProbability: formatScaled(parsedProbability.value, 9),
    independentProbabilityNanos: parsedProbability.value.toString(),
    expectedValuePerUnit: formatScaled(expectedValueNanos, 9),
    expectedValueNanos: expectedValueNanos.toString(),
  });
}
