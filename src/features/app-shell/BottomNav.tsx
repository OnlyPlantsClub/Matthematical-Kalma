import { AppIcon } from './AppIcon';

const items = [
  { icon: 'home', label: 'Home', href: '#main-content' },
  { icon: 'markets', label: 'Markets', href: '#board' },
  { icon: 'model', label: 'Model', href: '#model' },
  { icon: 'ledger', label: 'Ledger', href: '#getting-started' },
  { icon: 'more', label: 'More', href: '#getting-started' },
] as const;

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map(({ icon, label, href }, index) => (
        <a aria-current={index === 0 ? 'page' : undefined} className={index === 0 ? 'active' : ''} href={href} key={label}>
          <AppIcon name={icon} /><span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
