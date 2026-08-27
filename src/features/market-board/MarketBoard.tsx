import type { MarketOpportunity } from '@/src/domain/betting/types';

interface MarketBoardProps { markets: MarketOpportunity[]; selectedId: string; onSelect: (market: MarketOpportunity) => void; }

export function MarketBoard({ markets, selectedId, onSelect }: MarketBoardProps) {
  return (
    <div className="board">
      <div className="section-head"><div><p className="eyebrow">Paper market board</p><h2>Kalma&apos;s best edges</h2></div><button type="button">See all ›</button></div>
      <div className="game-list">
        {markets.map((market) => {
          const edge = market.modelProbability - 1 / market.decimalPrice;
          return (
            <button type="button" key={market.id} onClick={() => onSelect(market)} className={`game-row ${selectedId === market.id ? 'selected' : ''}`}>
              <div className="league"><span>{market.sport}</span><small>{market.startTime}</small></div>
              <div className="match"><small>{market.competition}</small><strong>{market.participantA} <i>v</i> {market.participantB}</strong><span>{market.selection}</span></div>
              <div className="metric"><small>Market</small><strong>{market.decimalPrice.toFixed(2)}</strong></div>
              <div className="metric"><small>Model</small><strong>{(market.modelProbability * 100).toFixed(0)}%</strong></div>
              <div className="edge"><small>Edge</small><strong>{edge >= 0 ? '+' : ''}{(edge * 100).toFixed(1)}%</strong></div>
              <span className="arrow">+</span>
            </button>
          );
        })}
      </div>
      <div className="method-note"><span>ⓘ</span><p><strong>Paper mode.</strong> Every row uses demonstration data until the sport models and price feeds pass validation.</p></div>
    </div>
  );
}
