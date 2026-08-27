import { probabilityToFairDecimal, recommendPosition } from '@/src/domain/betting/odds';
import type { MarketOpportunity } from '@/src/domain/betting/types';

interface PositionBuilderProps { bankroll: number; market: MarketOpportunity; decimalPrice: number; kellyMultiplier: number; onPriceChange: (price: number) => void; onKellyMultiplierChange: (multiplier: number) => void; }
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function PositionBuilder({ bankroll, market, decimalPrice, kellyMultiplier, onPriceChange, onKellyMultiplierChange }: PositionBuilderProps) {
  const recommendation = recommendPosition({ bankroll, decimalPrice, modelProbability: market.modelProbability, kellyMultiplier, confidence: market.confidence });
  const decisionLabel = recommendation.decision === 'bet' ? 'Suggested paper position' : recommendation.decision === 'watch' ? 'Watch — confidence too low' : 'Pass — no qualifying edge';

  return (
    <aside id="model" className="ticket">
      <div className="ticket-head"><div><p className="eyebrow">Position builder</p><h2>{market.selection}</h2><span>{market.competition}</span></div><b>{recommendation.decision}</b></div>
      <div className="probability">
        <div className="ring" style={{ '--p': `${market.modelProbability * 360}deg` } as React.CSSProperties}><span><strong>{(market.modelProbability * 100).toFixed(0)}%</strong><small>model win<br />probability</small></span></div>
        <div className="fair"><small>Fair price</small><strong>{probabilityToFairDecimal(market.modelProbability).toFixed(2)}</strong><small>Confidence <b>{Math.round(market.confidence * 100)}/100</b></small></div>
      </div>
      <label className="field"><span>Observed price</span><input type="number" min="1.01" max="20" step="0.01" value={decimalPrice} onChange={(event) => onPriceChange(Math.max(1.01, Number(event.target.value)))} /></label>
      <div className="risk"><div><span>Kelly multiplier</span><b>{kellyMultiplier.toFixed(2)}×</b></div><input aria-label="Kelly multiplier" type="range" min="0.1" max="0.5" step="0.05" value={kellyMultiplier} onChange={(event) => onKellyMultiplierChange(Number(event.target.value))} /><div className="risk-labels"><span>Preserve</span><span>Measured</span><span>Assertive</span></div></div>
      <div className="recommendation"><p>{decisionLabel}</p><div><strong>{recommendation.decision === 'bet' ? `$${recommendation.recommendedStake.toFixed(0)}` : recommendation.decision.toUpperCase()}</strong><span>{percent(recommendation.recommendedFraction)} of bankroll</span></div></div>
      <div className="stats"><div><span>Expected value</span><b className={recommendation.expectedValue > 0 ? 'positive' : ''}>{percent(recommendation.expectedValue)}</b></div><div><span>Model edge</span><b>{percent(recommendation.modelEdge)}</b></div><div><span>Max loss</span><b>${recommendation.recommendedStake.toFixed(0)}</b></div></div>
      <button className="save" type="button" disabled={recommendation.decision !== 'bet'}>{recommendation.decision === 'bet' ? 'Add paper position' : decisionLabel}<span>→</span></button>
      <p className="disclaimer">Decision support only. Demonstration data is not betting advice. Never risk money you cannot afford to lose.</p>
    </aside>
  );
}
