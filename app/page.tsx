'use client';

import { useMemo, useState } from 'react';

const games = [
  { league: 'NBA', time: '7:30 PM', away: 'Boston', home: 'New York', market: 'Boston moneyline', price: 1.91, model: 57, confidence: 82, tag: 'High signal' },
  { league: 'EPL', time: '10:00 PM', away: 'Arsenal', home: 'Brighton', market: 'Arsenal to win', price: 1.74, model: 61, confidence: 74, tag: 'Watch' },
  { league: 'AFL', time: 'Sat 2:10 PM', away: 'Fremantle', home: 'Sydney', market: 'Fremantle +14.5', price: 1.90, model: 55, confidence: 78, tag: 'Value' },
];

function pct(n: number) { return `${n.toFixed(1)}%`; }

export default function Home() {
  const [selected, setSelected] = useState(0);
  const [bankroll, setBankroll] = useState(2500);
  const [risk, setRisk] = useState(0.25);
  const [price, setPrice] = useState(games[0].price);
  const game = games[selected];
  const calc = useMemo(() => {
    const p = game.model / 100;
    const implied = 1 / price;
    const edge = p - implied;
    const fullKelly = Math.max(0, (price * p - 1) / (price - 1));
    const fraction = Math.min(fullKelly * risk, 0.025);
    return { edge, stake: bankroll * fraction, fraction, ev: (p * price - 1) * 100 };
  }, [bankroll, game, price, risk]);

  function choose(index: number) { setSelected(index); setPrice(games[index].price); }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark">E</span><span>Edgewise</span></a>
        <nav aria-label="Primary"><a className="active" href="#board">Board</a><a href="#model">Model lab</a><a href="#ledger">Ledger</a></nav>
        <div className="status"><span /> Model updated 2m ago</div>
      </header>
      <section className="hero">
        <div><p className="eyebrow">Independent market intelligence</p><h1>Price the game.<br /><em>Protect the bankroll.</em></h1><p className="lede">A disciplined second opinion for sports markets—built to find genuine price gaps, account for uncertainty, and tell you when to pass.</p></div>
        <div className="bank-card"><div><span>Working bankroll</span><strong>${bankroll.toLocaleString()}</strong></div><input aria-label="Bankroll" type="range" min="500" max="10000" step="100" value={bankroll} onChange={e => setBankroll(Number(e.target.value))} /><div className="bank-meta"><span>Today’s exposure <b>1.3%</b></span><span>Weekly P/L <b className="positive">+3.8%</b></span></div></div>
      </section>
      <section id="board" className="workspace">
        <div className="board">
          <div className="section-head"><div><p className="eyebrow">Today’s board</p><h2>Where model and market disagree</h2></div><button>All sports⌄</button></div>
          <div className="game-list">{games.map((g, i) => { const edge = g.model - 100 / g.price; return <button key={g.market} onClick={() => choose(i)} className={`game-row ${selected === i ? 'selected' : ''}`}><div className="league"><span>{g.league}</span><small>{g.time}</small></div><div className="match"><strong>{g.away} <i>at</i> {g.home}</strong><small>{g.market}</small></div><div className="metric"><small>Market</small><strong>{g.price.toFixed(2)}</strong></div><div className="metric"><small>Model</small><strong>{g.model}%</strong></div><div className="edge"><small>Edge</small><strong>+{edge.toFixed(1)}%</strong></div><span className="arrow">›</span></button>; })}</div>
          <div className="method-note"><span>◇</span><p><strong>Not every edge is a bet.</strong> Edgewise discounts signals for model confidence, market liquidity, and correlated exposure before recommending a stake.</p></div>
        </div>
        <aside id="model" className="ticket">
          <div className="ticket-head"><div><p className="eyebrow">Position builder</p><h2>{game.market}</h2><span>{game.away} at {game.home}</span></div><b>{game.tag}</b></div>
          <div className="probability"><div className="ring" style={{'--p': `${game.model * 3.6}deg`} as React.CSSProperties}><span><strong>{game.model}%</strong><small>model win<br/>probability</small></span></div><div className="fair"><small>Fair price</small><strong>{(100 / game.model).toFixed(2)}</strong><small>Confidence <b>{game.confidence}/100</b></small></div></div>
          <label className="field"><span>Sportsbook price</span><input type="number" min="1.01" max="20" step="0.01" value={price} onChange={e => setPrice(Math.max(1.01, Number(e.target.value)))} /></label>
          <div className="risk"><div><span>Risk posture</span><b>{risk === .15 ? 'Cautious' : risk === .25 ? 'Measured' : 'Assertive'}</b></div><input aria-label="Risk posture" type="range" min="0.15" max="0.5" step="0.1" value={risk} onChange={e => setRisk(Number(e.target.value))}/><div className="risk-labels"><span>Preserve</span><span>Balanced</span><span>Grow</span></div></div>
          <div className="recommendation"><p>{calc.edge > 0 ? 'Suggested position' : 'Recommendation'}</p><div>{calc.edge > 0 ? <><strong>${calc.stake.toFixed(0)}</strong><span>{pct(calc.fraction * 100)} of bankroll</span></> : <><strong>PASS</strong><span>No positive model edge</span></>}</div></div>
          <div className="stats"><div><span>Expected value</span><b className={calc.ev > 0 ? 'positive' : ''}>{calc.ev > 0 ? '+' : ''}{pct(calc.ev)}</b></div><div><span>Model edge</span><b>{calc.edge > 0 ? '+' : ''}{pct(calc.edge * 100)}</b></div><div><span>Max loss</span><b>${calc.stake.toFixed(0)}</b></div></div>
          <button className="save" disabled={calc.edge <= 0}>{calc.edge > 0 ? 'Add to plan' : 'No bet advised'} <span>→</span></button>
          <p className="disclaimer">For informed decision support only. No outcome is guaranteed. Set limits, never chase losses, and only risk money you can afford to lose.</p>
        </aside>
      </section>
    </main>
  );
}
