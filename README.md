# Matthematical Kalma

Private sports-market intelligence for AFL, tennis, MMA, and boxing. The product is designed to estimate fair prices, compare them with available market prices, manage a paper bankroll, and make **pass** a first-class decision.

> The current application renders honest empty states and has no production runtime fixtures. Nothing displayed by the application is betting advice or a validated production forecast.

## Current slice

- Interactive market board for the scoped MVP sports
- Fair-price and implied-probability calculations
- Confidence-discounted fractional-Kelly position sizing
- Hard 2.5% single-position cap
- Bet, watch, and pass decisions
- Pure arbitrage-margin calculation ready for feed integration

## Product documentation

- [Defined features](docs/FEATURES.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Architecture decisions](docs/adr/README.md)
- [Brand and mobile interface direction](docs/BRAND.md)

## Local development

Requires Node.js 22.13+ and pnpm.

```bash
pnpm install
pnpm dev
```

Quality checks:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Product principles

1. Evidence before bets.
2. Calibration over headline accuracy.
3. Record every forecast, not only bets taken.
4. Treat bankroll limits as constraints, not suggestions.
5. A positive model edge is necessary but never sufficient.
6. No automated or online in-play betting.
