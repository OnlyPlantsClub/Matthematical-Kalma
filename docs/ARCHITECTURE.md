# Architecture

## Direction

Matthematical Kalma begins as a modular web application, not a distributed system. Modules are separated by business capability so they can evolve independently without creating premature infrastructure.

```text
app/                         Route and application composition
src/domain/betting/          Pure odds, staking, and arbitrage rules
src/features/app-shell/      Navigation and global product framing
src/features/bankroll/       Bankroll inputs and exposure controls
src/features/market-board/   Opportunity discovery and market presentation
src/features/position-builder/ Recommendation and stake interaction
src/features/dashboard/      Composition of the current product slice
docs/                        Product and engineering decisions
```

## Dependency rule

Feature modules may depend on domain modules. Domain modules must not import React, framework code, feeds, storage, or feature components. Features should communicate through typed contracts rather than importing one another's internal state.

## Planned boundaries

### Ingestion

Adapters retrieve fixtures, results, participant data, and timestamped prices. Raw provider payloads remain separate from the canonical domain model.

### Normalisation

Maps provider-specific identities and market names into canonical events, participants, markets, outcomes, and prices. Arbitrage and comparison require identity confidence before calculation.

### Modelling

Sport-specific pipelines produce the same versioned forecast contract. Models do not size bets.

### Decision engine

Combines forecast, confidence, observed price, exposure, and policy limits to return bet, watch, or pass with reasons.

### Ledger and evaluation

Stores immutable observations and decisions. Derived evaluation views calculate calibration, value, closing-line performance, and drawdown without rewriting history.

## Current technical decisions

- Next-compatible React application built with Vinext for Cloudflare deployment.
- TypeScript in strict mode.
- Decimal odds are canonical at the domain boundary.
- Probabilities are represented as numbers from zero to one.
- Position sizing is pure and deterministic.
- Demonstration data is isolated from domain logic.
- No credentials, provider payloads, or bookmaker automation in the client.

## Next engineering slice

1. Add unit tests for odds conversion, Kelly sizing, confidence gating, caps, and arbitrage margins.
2. Define canonical event, market, price-observation, forecast, and decision schemas.
3. Add a persistent paper ledger.
4. Evaluate one fixture/result source and one Australian odds source against the schemas.
5. Implement AFL ingestion before adding a second sport adapter.
