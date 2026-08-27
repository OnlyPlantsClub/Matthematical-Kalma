type IconName = 'home' | 'markets' | 'model' | 'ledger' | 'more' | 'user' | 'arrow' | 'check' | 'chart' | 'wallet';

interface AppIconProps {
  name: IconName;
  size?: number;
}

const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 10.8 12 3l9 7.8" /><path d="M5.5 9.7V21h13V9.7M9 21v-6h6v6" /></>,
  markets: <><path d="M4 19V9m5 10V5m5 14v-7m5 7V3" /><path d="M2 19h20" /></>,
  model: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></>,
  ledger: <><path d="M5 3h14v18H5z" /><path d="M8 8h8m-8 4h8m-8 4h5" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
  arrow: <path d="m8 5 7 7-7 7" />,
  check: <path d="m5 12 4 4L19 6" />,
  chart: <><path d="M4 19V5" /><path d="m6 16 4-5 4 2 5-7" /></>,
  wallet: <><path d="M4 7h15a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13" /><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z" /></>,
};

export function AppIcon({ name, size = 20 }: AppIconProps) {
  return (
    <svg aria-hidden="true" className="app-icon" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[name]}</g>
    </svg>
  );
}
