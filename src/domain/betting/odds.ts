import type { PositionRecommendation } from './types';

export const DEFAULT_MAX_POSITION_FRACTION = 0.025;
export const DEFAULT_MIN_EDGE = 0.01;

export function decimalToImpliedProbability(decimalPrice: number): number {
  if (!Number.isFinite(decimalPrice) || decimalPrice <= 1) return 1;
  return 1 / decimalPrice;
}

export function probabilityToFairDecimal(probability: number): number {
  if (!Number.isFinite(probability) || probability <= 0 || probability > 1) {
    throw new RangeError('Probability must be greater than zero and no more than one.');
  }
  return 1 / probability;
}

export function calculateArbitrageMargin(bestPrices: number[]): number | null {
  if (bestPrices.length < 2 || bestPrices.some((price) => price <= 1)) return null;
  return 1 - bestPrices.reduce((sum, price) => sum + 1 / price, 0);
}

interface PositionInput {
  bankroll: number;
  decimalPrice: number;
  modelProbability: number;
  kellyMultiplier: number;
  confidence: number;
  maxPositionFraction?: number;
  minEdge?: number;
}

export function recommendPosition({ bankroll, decimalPrice, modelProbability, kellyMultiplier, confidence, maxPositionFraction = DEFAULT_MAX_POSITION_FRACTION, minEdge = DEFAULT_MIN_EDGE }: PositionInput): PositionRecommendation {
  const impliedProbability = decimalToImpliedProbability(decimalPrice);
  const modelEdge = modelProbability - impliedProbability;
  const expectedValue = modelProbability * decimalPrice - 1;
  const fullKellyFraction = Math.max(0, (decimalPrice * modelProbability - 1) / Math.max(decimalPrice - 1, Number.EPSILON));
  const confidenceDiscount = Math.min(1, Math.max(0, confidence));
  const recommendedFraction = Math.min(fullKellyFraction * kellyMultiplier * confidenceDiscount, maxPositionFraction);
  const decision = modelEdge < minEdge || expectedValue <= 0 ? 'pass' : confidence < 0.7 ? 'watch' : 'bet';

  return {
    impliedProbability,
    modelEdge,
    expectedValue,
    fullKellyFraction,
    recommendedFraction: decision === 'bet' ? recommendedFraction : 0,
    recommendedStake: decision === 'bet' ? Math.max(0, bankroll) * recommendedFraction : 0,
    decision,
  };
}
