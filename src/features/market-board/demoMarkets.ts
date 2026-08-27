import type { MarketOpportunity } from '@/src/domain/betting/types';

export const demoMarkets: MarketOpportunity[] = [
  { id: 'afl-fre-syd-h2h', sport: 'AFL', competition: 'AFL Premiership', startTime: 'Sat 2:10 PM', participantA: 'Fremantle', participantB: 'Sydney', selection: 'Fremantle moneyline', decimalPrice: 1.9, modelProbability: 0.56, confidence: 0.81, status: 'modelled' },
  { id: 'tennis-player-a-b', sport: 'TENNIS', competition: 'ATP Tour', startTime: '8:30 PM', participantA: 'Alex de Minaur', participantB: 'Opponent', selection: 'Alex de Minaur to win', decimalPrice: 1.82, modelProbability: 0.58, confidence: 0.76, status: 'watch' },
  { id: 'ufc-fighter-a-b', sport: 'MMA', competition: 'UFC', startTime: 'Sun 11:00 AM', participantA: 'Fighter A', participantB: 'Fighter B', selection: 'Fighter A to win', decimalPrice: 2.05, modelProbability: 0.52, confidence: 0.68, status: 'watch' },
];
