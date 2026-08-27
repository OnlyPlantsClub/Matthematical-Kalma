export function AppHeader() {
  return (
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark">MK</span><span>Matthematical Kalma</span></a>
      <nav aria-label="Primary"><a className="active" href="#board">Board</a><a href="#model">Model lab</a><a href="#ledger">Ledger</a></nav>
      <div className="status"><span /> Demo model</div>
    </header>
  );
}
