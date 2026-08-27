# UI audit and Stage 3 handoff

## Current application surface

The application has one preserved route, `/`, rendered by `app/page.tsx`. It composes the existing mobile-first dashboard rather than maintaining separate page variants.

| Area | Component | Current live state |
|---|---|---|
| Application shell | `AppHeader`, `BottomNav` | Paper balance and plan count remain explicitly unset or zero. Navigation uses in-page anchors because no additional routes exist yet. |
| Hero and bankroll | `BettingDashboard`, `BankrollControl` | Account setup is unavailable and no balance is fabricated. |
| Market discovery | `MarketBoard` | Honest empty state: feeds, forecasts and recommendations are unavailable. |
| Position sizing | Empty state in `BettingDashboard` | Explains the prerequisites for a future governed paper position. |
| Position calculation | `PositionBuilder` | Existing reusable presentation for a supplied typed market; it is not mounted with demo data. |
| Future onboarding | `GettingStarted` | Presentation-only sequence with no actions, API calls or storage. |
| Future paper bankroll | `PaperBankrollPreview` | Presentation-only limit summary with unset balance and a disabled action. |

## Visual system

The existing CSS system remains in `app/globals.css`. Brand colours from `docs/BRAND.md` are preserved and supplemented with semantic surface, radius and shadow tokens. The interface continues to use:

- saturated blue chrome and model surfaces;
- yellow only for selected, decision and value emphasis;
- pale paper surfaces and white cards for scanning;
- compact, heavy headings and tabular-ready numeric surfaces;
- 44px-or-larger primary touch targets; and
- one information hierarchy that expands at 640px and 980px.

Shared interface icons are implemented by `AppIcon` as inline, current-colour SVGs. No external icon, font or image dependency was added.

## Empty and unavailable states

Live application states deliberately contain no example markets, prices, forecasts, balances or outcomes. Disabled controls communicate unavailable account and bankroll actions without suggesting that persistence exists. The market board lists the exact missing prerequisites, while the position builder explains the readiness sequence.

Loading and recoverable error variants should be introduced with the Stage 3 data contract, when the application can distinguish initial loading, authenticated empty data, stale data, upstream failure and access failure accurately. Fabricating those runtime states before the contract exists would make the current static application misleading.

## Platform overlap audit

The Cloudflare foundation range from `e0b762f` to `75dae86` changed CI, Sites removal, architecture documents, migrations, package metadata, lockfile, validation scripts, TypeScript/Vite configuration, Worker types and Wrangler configuration. It did not change `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `src/features/**`, `src/domain/**` or the public brand assets.

This UI stream intentionally does not modify authentication, domain calculations, data access, migrations, Worker code/configuration, Wrangler, Sites, CI, deployment configuration, package metadata or lockfiles.

## Stage 3 integration

Stage 3 should:

1. Replace disabled account affordances only after authenticated identity and user-isolation behaviour are available.
2. Connect onboarding completion and paper-bankroll limits to approved per-user persistence.
3. Define explicit typed states for loading, empty, stale, unavailable and failed market data.
4. Supply verified market records to `MarketBoard` and `PositionBuilder` without adding production fixtures.
5. Connect ledger and plan navigation only when their routes are implemented; preserve the current route until then.
6. Add interaction and accessibility tests around the real state transitions and persistent limits.
