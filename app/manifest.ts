import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Matthematical Kalma',
    short_name: 'MathKalma',
    description: 'Sports market intelligence and bankroll-aware position sizing.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#EDF4F8',
    theme_color: '#0867AD',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
