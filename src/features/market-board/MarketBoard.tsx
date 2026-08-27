import { AppIcon } from '@/src/features/app-shell/AppIcon';

export function MarketBoard() {
  return (
    <div className="board">
      <div className="section-head"><div><p className="eyebrow">Paper market board</p><h2>Kalma&apos;s best edges</h2></div><span className="private-beta">Private beta</span></div>
      <div className="market-empty">
        <span className="empty-icon" aria-hidden="true"><AppIcon name="chart" size={28} /></span>
        <h3>No opportunities yet</h3>
        <p>The board is clear because no validated prices or model forecasts have been connected. Real records will appear here only after they pass data-quality and confidence checks.</p>
        <div className="empty-status">
          <span><b>Market feeds</b><em>Not connected</em></span>
          <span><b>Model forecasts</b><em>Not available</em></span>
          <span><b>Recommendations</b><em>0</em></span>
        </div>
      </div>
      <div className="method-note"><span aria-hidden="true">i</span><p><strong>Honest empty state.</strong> Demonstration markets, prices, probabilities, balances and tips have been removed.</p></div>
    </div>
  );
}
