'use client';

import { useState } from 'react';
import type { MarketOpportunity } from '@/src/domain/betting/types';
import { AppHeader } from '@/src/features/app-shell/AppHeader';
import { BottomNav } from '@/src/features/app-shell/BottomNav';
import { BankrollControl } from '@/src/features/bankroll/BankrollControl';
import { MarketBoard } from '@/src/features/market-board/MarketBoard';
import { demoMarkets } from '@/src/features/market-board/demoMarkets';
import { PositionBuilder } from '@/src/features/position-builder/PositionBuilder';

export function BettingDashboard() {
  const [market, setMarket] = useState(demoMarkets[0]);
  const [bankroll, setBankroll] = useState(2500);
  const [kellyMultiplier, setKellyMultiplier] = useState(0.25);
  const [decimalPrice, setDecimalPrice] = useState(market.decimalPrice);

  function selectMarket(nextMarket: MarketOpportunity) { setMarket(nextMarket); setDecimalPrice(nextMarket.decimalPrice); }

  return (
    <main className="app-shell">
      <AppHeader />
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow">Independent sports intelligence</p><h1>Good odds.<br /><em>Better Kalma.</em></h1><p className="lede">Paper-test the model. Take the edge seriously. Take ourselves less seriously.</p></div>
        <BankrollControl bankroll={bankroll} onChange={setBankroll} />
      </section>
      <div className="mode-switch" role="tablist" aria-label="Product mode"><button type="button">Arbitrage</button><button className="active" type="button">Model Picks</button><button type="button">For You</button></div>
      <nav className="sport-strip" aria-label="Sports"><button className="active" type="button"><b>🏉</b><span>AFL</span></button><button type="button"><b>🎾</b><span>Tennis</span></button><button type="button"><b>🥊</b><span>UFC</span></button><button type="button"><b>🥋</b><span>Boxing</span></button><button type="button"><b>•••</b><span>All</span></button></nav>
      <section id="board" className="workspace">
        <MarketBoard markets={demoMarkets} selectedId={market.id} onSelect={selectMarket} />
        <PositionBuilder bankroll={bankroll} market={market} decimalPrice={decimalPrice} kellyMultiplier={kellyMultiplier} onPriceChange={setDecimalPrice} onKellyMultiplierChange={setKellyMultiplier} />
      </section>
      <BottomNav />
    </main>
  );
}
