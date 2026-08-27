import type { MarketOpportunity } from '@/src/domain/betting/types';

interface MarketBoardProps { markets: MarketOpportunity[]; selectedId: string; onSelect: (market: MarketOpportunity) => void; }

export function MarketBoard({ markets, selectedId, onSelect }: MarketBoardProps) {
  return (
    <div className="board">
      <div className="section-head"><div><p className="eyebrow">Paper market board</p><h2>Where model and market disagree</h2></div><button type="button">MVP sports⌄</button></div>
      <div className="game-list">
        {markets.map((market) => {
          const edge = market.modelProbability - 1 / market.decimalPrice;
          return (
            <button type="button" key={market.id} onClick={() => onSelect(market)} className={`game-row ${selectedId === market.id ? 'selected' : ''}`}>
              <div className="league"><span>{market.sport}</span><small>{market.startTime}</small></div>
              <div className="match"><strong>{market.participantA} <i>v</i> {market.participantB}</strong><small>{market.selection}</small></div>
              <div className="metric"><small>Market</small><strong>{market.decimalPrice.toFixed(2)}</strong></div>
              <div className="metric"><small>Model</small><strong>{(market.modelProbability * 100).toFixed(0)}%</strong></div>
              <div className="edge"><small>Edge</small><strong>{edge >= 0 ? '+' : ''}{(edge * 100).toFixed(1)}%</strong></div>
              <span className="arrow">›</span>
            </button>
          );
        })}
      </div>
      <div className="method-note"><span>◇</span><p><strong>Every row is demonstration data.</strong> Production recommendations require validated sources, walk-forward testing, calibration, and recorded closing prices.</p></div>
    </div>
  );
}
