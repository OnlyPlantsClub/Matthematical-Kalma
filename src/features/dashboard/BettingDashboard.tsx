import { AppHeader } from '@/src/features/app-shell/AppHeader';
import { BottomNav } from '@/src/features/app-shell/BottomNav';
import { BankrollControl } from '@/src/features/bankroll/BankrollControl';
import { PaperBankrollPreview } from '@/src/features/bankroll/PaperBankrollPreview';
import { MarketBoard } from '@/src/features/market-board/MarketBoard';
import { GettingStarted } from '@/src/features/onboarding/GettingStarted';

export function BettingDashboard() {
  return (
    <main className="app-shell" id="main-content">
      <AppHeader />
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow">Independent sports intelligence</p><h1>Good odds.<br /><em>Better Kalma.</em></h1><p className="lede">Paper-test the model. Take the edge seriously. Take ourselves less seriously.</p></div>
        <BankrollControl />
      </section>
      <div className="mode-switch" role="tablist" aria-label="Product mode"><button type="button">Arbitrage</button><button className="active" type="button">Model Picks</button><button type="button">For You</button></div>
      <nav className="sport-strip" aria-label="Sports"><button className="active" type="button"><b>🏉</b><span>AFL</span></button><button type="button"><b>🎾</b><span>Tennis</span></button><button type="button"><b>🥊</b><span>UFC</span></button><button type="button"><b>🥋</b><span>Boxing</span></button><button type="button"><b>•••</b><span>All</span></button></nav>
      <section id="board" className="workspace">
        <MarketBoard />
        <aside id="model" className="ticket empty-ticket">
          <span className="empty-icon quiet-icon" aria-hidden="true">0</span>
          <p className="eyebrow">Position builder</p>
          <h2>Nothing to size yet</h2>
          <p>Selecting and sizing a position will become available after a verified market, model forecast and personal paper bankroll exist.</p>
          <div className="readiness-list">
            <span><b>1</b> Sign in and create a paper bankroll</span>
            <span><b>2</b> Wait for validated market intelligence</span>
            <span><b>3</b> Review a governed Bet Plan</span>
          </div>
          <button className="save" type="button" disabled>Bet Plan is empty</button>
          <p className="disclaimer">Decision support only. No betting advice or automatic bet placement.</p>
        </aside>
      </section>
      <GettingStarted />
      <PaperBankrollPreview />
      <BottomNav />
    </main>
  );
}
