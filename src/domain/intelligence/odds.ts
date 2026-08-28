export const DECIMAL_ODDS_SCALE = 1_000_000n;
export const PROBABILITY_SCALE = 1_000_000_000n;
export const MAX_DECIMAL_ODDS_INPUT_LENGTH = 12;
export const MAX_DECIMAL_ODDS_MICROS = 10_000_000_000n;
export const MAX_PROBABILITY_INPUT_LENGTH = 11;
export const MAX_MARKET_OUTCOMES = 16;
export const MAX_OUTCOME_ID_LENGTH = 128;
export const MAX_OBSERVATION_REF_LENGTH = 256;

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
  | 'invalid_probability'
  | 'invalid_input'
  | 'invalid_market'
  | 'invalid_outcome_id'
  | 'invalid_observation_ref'
  | 'input_limit_exceeded'
  | 'odds_out_of_range'
  | 'market_limit_exceeded';

export interface CalculationError {
  code: CalculationErrorCode;
  message: string;
  outcomeId?: string;
  inputIndex?: number;
  path?: string;
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
const OUTCOME_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const OBSERVATION_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/;

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

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
  if (input.length > MAX_DECIMAL_ODDS_INPUT_LENGTH) {
    return failure({
      code: 'input_limit_exceeded',
      message: `Decimal odds must not exceed ${MAX_DECIMAL_ODDS_INPUT_LENGTH} characters.`,
    });
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
  if (oddsMicros > MAX_DECIMAL_ODDS_MICROS) {
    return failure({
      code: 'odds_out_of_range',
      message: 'Decimal odds must not exceed 10000.000000.',
    });
  }
  return success(oddsMicros);
}

function parseProbability(input: unknown): CalculationResult<bigint> {
  if (typeof input !== 'string') {
    return failure({
      code: 'invalid_probability',
      message: 'Independent probability must be a canonical decimal string from 0 to 1 with at most 9 fractional digits.',
    });
  }
  if (input.length > MAX_PROBABILITY_INPUT_LENGTH) {
    return failure({
      code: 'input_limit_exceeded',
      message: `Independent probability must not exceed ${MAX_PROBABILITY_INPUT_LENGTH} characters.`,
    });
  }
  if (!PROBABILITY_PATTERN.test(input)) {
    return failure({
      code: 'invalid_probability',
      message: 'Independent probability must be a canonical decimal string from 0 to 1 with at most 9 fractional digits.',
    });
  }
  const [integerPart, fractionalPart = ''] = input.split('.');
  return success(BigInt(integerPart) * PROBABILITY_SCALE + BigInt(fractionalPart.padEnd(9, '0') || '0'));
}

function validateMarket(input: unknown): CalculationResult<ValidatedPrice[]> {
  if (!isRecord(input)) {
    return failure({ code: 'invalid_input', message: 'Market input must be a non-null object.', path: '$' });
  }
  if (input.completeness !== 'complete' && input.completeness !== 'incomplete') {
    return failure({
      code: 'invalid_market',
      message: 'Market completeness must be complete or incomplete.',
      path: '$.completeness',
    });
  }
  if (!Array.isArray(input.prices)) {
    return failure({ code: 'invalid_market', message: 'Market prices must be an array.', path: '$.prices' });
  }
  if (input.prices.length > MAX_MARKET_OUTCOMES) {
    return failure({
      code: 'market_limit_exceeded',
      message: `A market must not exceed ${MAX_MARKET_OUTCOMES} outcomes.`,
      path: '$.prices',
    });
  }
  if (input.completeness !== 'complete' || input.prices.length < 2) {
    return failure({
      code: 'incomplete_market',
      message: 'A market calculation requires at least two exhaustive, mutually exclusive outcomes.',
      path: '$.prices',
    });
  }
  const seenOutcomeIds = new Set<string>();
  const validated: ValidatedPrice[] = [];
  for (let inputIndex = 0; inputIndex < input.prices.length; inputIndex += 1) {
    const path = `$.prices[${inputIndex}]`;
    if (!(inputIndex in input.prices)) {
      return failure({ code: 'invalid_market', message: 'Market prices must be a dense array.', inputIndex, path });
    }
    const price = input.prices[inputIndex];
    if (!isRecord(price)) {
      return failure({ code: 'invalid_market', message: 'Every price must be a non-null object.', inputIndex, path });
    }
    const outcomeId = price.outcomeId;
    const context = {
      ...(typeof outcomeId === 'string' ? { outcomeId } : {}),
      inputIndex,
      path,
    };
    if (
      typeof outcomeId !== 'string'
      || outcomeId.length === 0
      || outcomeId.length > MAX_OUTCOME_ID_LENGTH
      || !OUTCOME_ID_PATTERN.test(outcomeId)
      || seenOutcomeIds.has(outcomeId)
    ) {
      return failure({
        code: 'invalid_outcome_id',
        message: `Every outcomeId must be unique, 1-${MAX_OUTCOME_ID_LENGTH} characters, and use only letters, digits, '.', '_', ':' or '-'.`,
        ...context,
        path: `${path}.outcomeId`,
      });
    }
    seenOutcomeIds.add(outcomeId);
    if (price.availability !== 'active' && price.availability !== 'suspended') {
      return failure({
        code: 'invalid_market',
        message: 'Price availability must be active or suspended.',
        ...context,
        path: `${path}.availability`,
      });
    }
    if (price.freshness !== 'current' && price.freshness !== 'stale') {
      return failure({
        code: 'invalid_market',
        message: 'Price freshness must be current or stale.',
        ...context,
        path: `${path}.freshness`,
      });
    }
    if (price.observationRef !== undefined && (
      typeof price.observationRef !== 'string'
      || price.observationRef.length === 0
      || price.observationRef.length > MAX_OBSERVATION_REF_LENGTH
      || !OBSERVATION_REF_PATTERN.test(price.observationRef)
    )) {
      return failure({
        code: 'invalid_observation_ref',
        message: `observationRef must be 1-${MAX_OBSERVATION_REF_LENGTH} characters and use only opaque reference characters.`,
        ...context,
        path: `${path}.observationRef`,
      });
    }
    if (price.decimalOdds === null || price.decimalOdds === undefined || price.decimalOdds === '') {
      return failure({ code: 'missing_price', message: 'Every outcome requires a price.', ...context, path: `${path}.decimalOdds` });
    }
    if (price.availability === 'suspended') {
      return failure({ code: 'suspended_price', message: 'Suspended prices cannot form a market calculation.', ...context, path: `${path}.availability` });
    }
    if (price.freshness === 'stale') {
      return failure({ code: 'stale_price', message: 'Stale prices cannot form a market calculation.', ...context, path: `${path}.freshness` });
    }
    const parsed = parseDecimalOdds(price.decimalOdds);
    if (!parsed.ok) return failure({ ...parsed.error, ...context, path: `${path}.decimalOdds` });
    validated.push({
      outcomeId,
      oddsMicros: parsed.value,
      ...(typeof price.observationRef === 'string' ? { observationRef: price.observationRef } : {}),
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

export function calculateMarketOverround(input: unknown): CalculationResult<OverroundCalculation> {
  const validated = validateMarket(input);
  if (!validated.ok) return validated;
  return success(buildOverround(validated.value));
}

export function removeMarginProportionally(input: unknown): CalculationResult<ProportionalMarketBaseline> {
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

export function calculateExpectedValue(input: unknown): CalculationResult<ExpectedValueCalculation> {
  if (!isRecord(input)) {
    return failure({ code: 'invalid_input', message: 'Expected-value input must be a non-null object.', path: '$' });
  }
  if (!Object.hasOwn(input, 'decimalOdds')) {
    return failure({ code: 'missing_price', message: 'Expected-value input requires decimalOdds.', path: '$.decimalOdds' });
  }
  if (!Object.hasOwn(input, 'independentProbability')) {
    return failure({
      code: 'invalid_probability',
      message: 'Expected-value input requires independentProbability.',
      path: '$.independentProbability',
    });
  }
  const parsedOdds = parseDecimalOdds(input.decimalOdds);
  if (!parsedOdds.ok) return failure({ ...parsedOdds.error, path: '$.decimalOdds' });
  const parsedProbability = parseProbability(input.independentProbability);
  if (!parsedProbability.ok) return failure({ ...parsedProbability.error, path: '$.independentProbability' });
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
