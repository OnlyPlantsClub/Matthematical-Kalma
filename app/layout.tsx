import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Matthematical Kalma — Sports Market Intelligence',
  description: 'Independent probability estimates and bankroll-aware position sizing for disciplined sports betting decisions.',
  applicationName: 'MathKalma',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '16x16 32x32', type: 'image/x-icon' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MathKalma',
  },
  openGraph: {
    title: 'Matthematical Kalma — Sports Market Intelligence',
    description: 'Price the game. Mind your Kalma.',
    images: [{ url: '/og.png', width: 1730, height: 909, alt: 'matthematical kalma — Good odds. Better Kalma.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Matthematical Kalma — Sports Market Intelligence',
    description: 'Price the game. Mind your Kalma.',
    images: ['/og.png'],
  },
};

export const viewport = {
  themeColor: '#0867AD',
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
