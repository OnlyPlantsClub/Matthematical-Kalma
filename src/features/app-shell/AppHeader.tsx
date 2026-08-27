export function AppHeader() {
  return (
    <header className="topbar">
      <a className="brand" href="#" aria-label="Matthematical Kalma home">
        <span className="brand-mark" aria-hidden="true"><i>m</i><b>k</b><span>✓</span></span>
        <strong className="brand-name"><i>matthematical</i><b>kalma</b></strong>
      </a>
      <div className="account-block"><span>Paper balance</span><strong>—</strong></div>
      <button className="header-icon" type="button" aria-label="Sign in">?</button>
      <a className="plan-pill" href="#model"><b>0</b><span>Bet Plan</span></a>
    </header>
  );
}
