const items = [
  ['⌂', 'Home'],
  ['◎', 'Markets'],
  ['◇', 'Model'],
  ['≋', 'Ledger'],
  ['☰', 'More'],
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map(([icon, label], index) => (
        <a className={index === 0 ? 'active' : ''} href={index === 0 ? '#' : index === 2 ? '#model' : '#board'} key={label}>
          <b aria-hidden="true">{icon}</b><span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
