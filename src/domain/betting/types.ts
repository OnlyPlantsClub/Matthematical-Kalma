export type Sport = 'AFL' | 'TENNIS' | 'MMA' | 'BOXING' | 'NRL' | 'NBA';
export type MarketStatus = 'modelled' | 'watch' | 'manual';

export interface MarketOpportunity {
  id: string;
  sport: Sport;
  competition: string;
  startTime: string;
  participantA: string;
  participantB: string;
  selection: string;
  decimalPrice: number;
  modelProbability: number;
  confidence: number;
  status: MarketStatus;
}

export interface PositionRecommendation {
  impliedProbability: number;
  modelEdge: number;
  expectedValue: number;
  fullKellyFraction: number;
  recommendedFraction: number;
  recommendedStake: number;
  decision: 'bet' | 'watch' | 'pass';
}
