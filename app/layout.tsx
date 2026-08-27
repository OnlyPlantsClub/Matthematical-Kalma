import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Edgewise — Independent Sports Market Intelligence',
  description: 'Independent probability estimates and bankroll-aware position sizing for disciplined sports betting decisions.',
  openGraph: {
    title: 'Edgewise — Independent Sports Market Intelligence',
    description: 'Price the game. Protect the bankroll.',
    images: [{ url: '/og.png', width: 1536, height: 1024, alt: 'Edgewise — Price the game. Protect the bankroll.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Edgewise — Independent Sports Market Intelligence',
    description: 'Price the game. Protect the bankroll.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
