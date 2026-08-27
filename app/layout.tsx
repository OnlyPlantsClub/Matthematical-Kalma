import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Matthematical Kalma — Sports Market Intelligence',
  description: 'Independent probability estimates and bankroll-aware position sizing for disciplined sports betting decisions.',
  openGraph: {
    title: 'Matthematical Kalma — Sports Market Intelligence',
    description: 'Price the game. Mind your Kalma.',
    images: [{ url: '/og.png', width: 1536, height: 1024, alt: 'Matthematical Kalma sports market intelligence.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Matthematical Kalma — Sports Market Intelligence',
    description: 'Price the game. Mind your Kalma.',
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
