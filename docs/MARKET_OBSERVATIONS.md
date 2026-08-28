# Normalized market observations

Status: implemented as a pure, provider-neutral domain slice; manual/in-memory fixtures only (2026-08-28)

The canonical implementation is [`src/domain/intelligence/market-observation.ts`](../src/domain/intelligence/market-observation.ts). It validates decoded JSON or arbitrary JavaScript values before use, returns stable discriminated errors, and produces a recursively frozen `market-observation-v1` snapshot. [`manual-market-adapter.ts`](../src/domain/intelligence/manual-market-adapter.ts) demonstrates two in-memory fixture shapes without choosing or contacting a provider.

## Lifecycle and normalization flow

`manual fixture → provider-neutral candidate → runtime validation → canonical identities/prices/times → deterministic freshness → immutable normalized snapshot → explicit odds-core handoff`

The slice records what one source reported. It does not de-vig, forecast, recommend, persist, retrieve, scrape or place a wager. A source is represented only by a canonical `sourceId` and opaque `providerRef`; credential-like fields are rejected. Each outcome retains an immutable `observationRef` and optional source sequence/version. The adapter maps shapes but does not resolve ambiguous identities. Canonical sport, competition, event, market and outcome IDs must already be supplied and must agree wherever repeated.

## Time semantics and freshness policy

All instants are distinct:

- `eventStartAt`: scheduled event start and strict pre-match boundary.
- `observedAt`: when the source says the offered state was observed.
- `receivedAt`: when that state reached ingestion.
- `asOf`: caller-injected evaluation/calculation time.

Every instant must be canonical UTC ISO-8601 with exactly milliseconds (`YYYY-MM-DDTHH:mm:ss.sssZ`). Offsets, offset-free forms, missing milliseconds and impossible calendar values fail validation. Domain functions never read the system clock.

The only supported policy is `baseline-pre-match` version `1`, with a 60,000 ms maximum observation age. It is a bounded test/MVP baseline, not a universal sport, market or provider threshold. Exact semantics are:

- `asOf - observedAt <= 60,000 ms` is `current`.
- `asOf - observedAt > 60,000 ms` is `stale`.
- `observedAt > asOf`, `receivedAt < observedAt`, `receivedAt > asOf`, and `asOf >= eventStartAt` are errors rather than freshness states.

The classification retains the policy ID/version/threshold, all four times, age, ingestion delay, time until start and a stable reason. Replaying the same input therefore explains and reproduces the result.

## Market and price states

A snapshot declares `complete | incomplete` independently of `active | suspended` market availability. Outcomes declare `active | suspended | unavailable`. Active and suspended outcomes require canonical decimal odds; unavailable outcomes must omit a price. Normalization preserves all valid states. The odds handoff returns an explicit error for unavailable prices and lets the existing deterministic odds core reject incomplete, suspended or stale calculation inputs under its own contract.

## Limits and runtime safety

The slice reuses deterministic-odds limits where the constraint is identical: 16 outcomes, 128 characters per outcome ID, 256 characters per observation reference, and the existing decimal-odds syntax/range. New version-1 limits are 128 characters for source and canonical IDs, 256 for provider references, 128 for source sequence/version references, and 24 for the fixed timestamp form. Market count and string length are checked before per-item parsing, sorting or numeric conversion; sparse arrays, primitives, nulls, unknown enums, duplicates and identity conflicts return stable errors with paths and outcome indexes.

Exported errors are `invalid_input`, `invalid_identifier`, `invalid_reference`, `invalid_timestamp`, `invalid_time_order`, `future_observation`, `post_start`, `unsupported_policy`, `invalid_market`, `invalid_outcome`, `duplicate_outcome`, `identity_conflict`, `invalid_price`, `market_limit_exceeded` and `unavailable_price`.

## Odds-core relationship

`toOddsMarketInput` normalizes first and then emits the existing `MarketPriceInput` contract with canonical price strings, availability, calculated freshness and observation references. `decimalOddsToImpliedProbability`, `calculateMarketOverround` and `removeMarginProportionally` remain provider-independent and unchanged. This snapshot establishes the missing factual inputs for arithmetic replay; persistence and canonical hashing remain later work.

## MVP scope and deferred decisions

Supported now: manual/in-memory normalization, exact canonical IDs, pre-match timestamps, baseline freshness classification, price/market states, provenance references and deterministic odds handoff.

Deferred: paid-provider selection, automated acquisition, legal/licensing approval, provider timestamp trust/skew allowances, sport/market/operator freshness selection, identity mapping and correction workflows, raw/canonical retention, canonical content hashes, persistence, D1 migrations, APIs, UI, forecasting, recommendations, staking and wager execution.
