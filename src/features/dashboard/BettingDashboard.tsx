'use client';

import { useState } from 'react';
import type { MarketOpportunity } from '@/src/domain/betting/types';
import { AppHeader } from '@/src/features/app-shell/AppHeader';
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
    <main>
      <AppHeader />
      <section className="hero">
        <div><p className="eyebrow">Independent sports market intelligence</p><h1>Price the game.<br /><em>Mind your Kalma.</em></h1><p className="lede">A private paper-betting lab for AFL, tennis, combat sports and the occasional mathematically defensible opportunity.</p></div>
        <BankrollControl bankroll={bankroll} onChange={setBankroll} />
      </section>
      <section id="board" className="workspace">
        <MarketBoard markets={demoMarkets} selectedId={market.id} onSelect={selectMarket} />
        <PositionBuilder bankroll={bankroll} market={market} decimalPrice={decimalPrice} kellyMultiplier={kellyMultiplier} onPriceChange={setDecimalPrice} onKellyMultiplierChange={setKellyMultiplier} />
      </section>
    </main>
  );
}
