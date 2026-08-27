# Product features

This catalogue defines the intended product boundaries. Status values are **implemented**, **next**, **planned**, or **excluded**.

## F01 — Market board

**Status:** implemented with demonstration data

Provides one normalised view of upcoming supported events, observed prices, model probabilities, confidence, and calculated edge.

Initial sports:

- AFL
- ATP/WTA tennis
- UFC
- Manually entered boxing

The production board must show source, observation time, market status, and price expiry. Stale or suspended prices may not produce a recommendation.

## F02 — Independent probability models

**Status:** planned

Each sport owns a separate modelling adapter behind a shared forecast contract. A forecast contains probability, model version, feature timestamp, uncertainty, and evaluation cohort.

Initial markets:

- AFL match winner and line
- Tennis match winner
- UFC fight winner
- Boxing fight winner, initially manual

Models graduate only after walk-forward evaluation, calibration analysis, and comparison against de-vigged market baselines.

## F03 — Price intelligence

**Status:** next

Collects pre-match prices from approved Australian bookmakers and exchanges, maps equivalent events and selections, preserves observations, and calculates:

- implied probability;
- bookmaker margin;
- consensus probability;
- best available price;
- price movement; and
- closing price.

## F04 — Position builder

**Status:** implemented as a paper calculator

Converts a qualified forecast into a paper position using confidence-discounted fractional Kelly. The current implementation applies a 2.5% bankroll cap and returns bet, watch, or pass.

Production controls must include maximum exposure by day, week, sport, event, and correlated outcome.

## F05 — Arbitrage scanner

**Status:** domain calculation implemented; scanning planned

Finds pre-match winner-market combinations whose best inverse prices sum to less than one. An opportunity is valid only after fees, minimum/maximum stakes, liquidity, freshness, matching, and partial-fill risk are considered.

The first release provides alerts and stake allocations only. It does not place bets.

## F06 — Forecast and decision ledger

**Status:** planned

Records every forecast and decision, including passes and opportunities not acted upon. The ledger supports model evaluation, bankroll reconciliation, closing-line value, and a complete audit trail.

## F07 — Model evaluation lab

**Status:** planned

Measures calibration, Brier score, log loss, expected value, realised value, closing-line value, drawdown, and performance stability by sport, market, model version, and time period.

## F08 — Responsible-use controls

**Status:** partially implemented

Includes paper mode, explicit uncertainty, pass decisions, conservative caps, and warnings. Planned controls include deposit-independent bankroll limits, cooling-off controls, loss and drawdown alerts, and immutable limit history.

## F09 — Data quality and provenance

**Status:** planned

Every material number must be traceable to a source and observation time. Validation covers participant identity, event start time, market equivalence, result settlement, missingness, and correction history.

## Excluded from the initial product

- Automatic bet placement
- Online in-play betting or arbitrage
- Parlays/multis and same-game multis
- Player props, futures, novelty markets, and racing
- Public tips, subscriptions, affiliates, and social leaderboards
- Claims of guaranteed profit
