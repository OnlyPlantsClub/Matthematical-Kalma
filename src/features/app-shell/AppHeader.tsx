export function AppHeader() {
  return (
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark">mk<span>✓</span></span><strong>Matthematical<br />Kalma</strong></a>
      <div className="account-block"><span>Paper balance</span><strong>$2,500</strong></div>
      <button className="header-icon" type="button" aria-label="Open profile">MK</button>
      <a className="plan-pill" href="#model"><b>0</b><span>Bet Plan</span></a>
    </header>
  );
}
