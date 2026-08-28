# Normalized market observations

Status: implemented as a pure, provider-neutral domain slice; manual/in-memory fixtures only (2026-08-28)

The canonical implementation is [`src/domain/intelligence/market-observation.ts`](../src/domain/intelligence/market-observation.ts). It accepts untrusted JSON-compatible runtime values, returns stable discriminated errors, and produces a recursively frozen `market-observation-v1` snapshot. Shared inspection and credential-name rules live in [`untrusted-json.ts`](../src/domain/intelligence/untrusted-json.ts). Accessors, proxies, exotic prototypes and failed property/prototype/enumeration traps are contained only while the untrusted graph is inspected and fail as `invalid_input`; raw exception details are never returned. Validation and other internal defects after that snapshot boundary are not caught or disguised. [`manual-market-adapter.ts`](../src/domain/intelligence/manual-market-adapter.ts) demonstrates two strict in-memory fixture shapes without choosing or contacting a provider.

## Lifecycle and normalization flow

`manual fixture → provider-neutral candidate → runtime validation → canonical identities/prices/times → deterministic freshness → immutable normalized snapshot → explicit odds-core handoff`

The slice records what one source reported. It does not de-vig, forecast, recommend, persist, retrieve, scrape or place a wager. Every input, including both manual formats, supplies the same `source-envelope-v1`. It contains source/provider identity, source schema version, terms/licence reference, adapter identity/version, retrieval method, observation/effective/receipt times and an explicit retention/replay contract. Each outcome retains an immutable `observationRef` and optional source sequence/version. The adapter maps shapes but does not resolve ambiguous identities. Canonical sport, competition, event, market and outcome IDs must already be supplied and must agree wherever repeated.

## Provenance and replay contract

`payloadHash` is required in canonical lowercase `sha256:<64 hex>` form. This slice validates but does not calculate it: the fixture/import producer is responsible for hashing the exact retained or observed bytes with SHA-256. The normalized contract therefore proves only that a canonical digest was supplied, not that this boundary independently verified the bytes.

The retention object declares exactly one replay mode:

- `full_payload_retained`: hash plus immutable locator for retained bytes; full replay is intended while that locator remains valid.
- `hash_and_retrievable_locator`: hash plus immutable locator for bytes retrievable from an authorised archive.
- `hash_only_verification`: hash only; later bytes can be compared but cannot be reconstructed from this record.
- `not_fully_replayable`: hash plus a required explicit limitation reason; no complete replay claim is made.

The first two modes require `payloadLocator`; hash-only forbids locator/limitation fields; non-replayable requires `limitationReason`. Provider selection, locator durability, licence rights and retention duration remain governed outside this slice.

## Time semantics and freshness policy

All instants are distinct:

- `eventStartAt`: scheduled event start and strict pre-match boundary.
- `observedAt`: when the source says the offered state was observed.
- `effectiveAt`: when the source state took effect; it cannot follow observation or evaluation.
- `receivedAt`: when that state reached ingestion.
- `asOf`: caller-injected evaluation/calculation time.

Every instant must be canonical UTC ISO-8601 with exactly milliseconds (`YYYY-MM-DDTHH:mm:ss.sssZ`). Offsets, offset-free forms, missing milliseconds and impossible calendar values fail validation. Domain functions never read the system clock.

The only supported policy is `baseline-pre-match` version `1`, with a 60,000 ms maximum observation age. It is a bounded test/MVP baseline, not a universal sport, market or provider threshold. Exact semantics are:

- `asOf - observedAt <= 60,000 ms` is `current`.
- `asOf - observedAt > 60,000 ms` is `stale`.
- `observedAt > asOf`, `receivedAt < observedAt`, `receivedAt > asOf`, and `asOf >= eventStartAt` are errors rather than freshness states.

The classification retains the policy ID/version/threshold, all four times, age, ingestion delay, time until start and a stable reason. Replaying the same input therefore explains and reproduces the result.

## Market and price states

A snapshot declares `complete | incomplete` independently of `active | suspended | unavailable` market availability. Outcomes declare `active | suspended | unavailable`. Active and suspended outcomes require canonical decimal odds; unavailable outcomes must omit a price. Normalization preserves all valid states for audit. `toOddsMarketInput` itself rejects incomplete or single-outcome snapshots, stale observations, suspended/unavailable markets and suspended/unavailable outcomes. Therefore `ok: true` means the returned market is complete, active, current, priced and calculation-ready; downstream arithmetic validation remains defence in depth.

## Limits and runtime safety

The slice reuses deterministic-odds limits where the constraint is identical: 16 outcomes, 128 characters per outcome ID, 256 characters per observation reference, and the existing decimal-odds syntax/range. New version-1 limits are 128 characters for source and canonical IDs, 256 for provider/terms/locator references, 128 for source/adapter versions, 512 for replay limitation reasons and 24 for the fixed timestamp form. Market count and boundary string length are checked before domain parsing or numeric conversion; sparse arrays, primitives, nulls, accessors, proxies, unknown enums, duplicates and identity conflicts return stable errors with paths and outcome indexes.

`untrusted-json-inspection-v1` applies one shared budget to the entire snapshot before cloning or descending:

- 512 visited values, counting the root, every object/array and every primitive value.
- 512 total object properties plus array entries.
- 16,384 cumulative JavaScript UTF-16 code units across string values and object field names; array index labels are not counted.
- Depth 8, 64 keys per object, 17 entries per array and 1,024 UTF-16 code units per individual string.

The limits comfortably contain the intended maximum 16-outcome winner-market contract while preventing multiplicative graph inspection. A deterministic maximum-size test fixture uses 206 visited values, 205 properties/entries and 3,140 UTF-16 code units. Exact-limit and one-over tests cover every aggregate counter. A shared-subtree fixture records one prototype inspection and then rejects its second reference, providing visit-count evidence without a timing assertion.

Because the accepted representation is JSON-compatible, cycles and every repeated object/array identity are rejected as `repeated_reference` using one snapshot-wide identity set before a subtree is cloned again. Aggregate exhaustion returns `inspection_limit_exceeded` with frozen limit/usage metadata. Individual malformed values retain `invalid_input`.

Every DTO uses an exact allowed-key schema. Unknown fields—including provider-state fields and typographical mistakes—fail as `unknown_field`. One shared classifier normalizes credential-like field names case-insensitively across `_`, `-`, whitespace and casing forms and fails as `credential_field` without echoing values. Singular/plural token, access/refresh token, API key, client secret, password, credential, authorization, bearer, cookie and set-cookie names are covered. Opaque values are never scanned, so a valid field such as `providerRef` may safely contain `provider/token-reference`. Future provider-specific adapters must explicitly map raw payloads into this strict internal contract.

Exported errors are `invalid_input`, `unknown_field`, `credential_field`, `inspection_limit_exceeded`, `repeated_reference`, `invalid_identifier`, `invalid_reference`, `invalid_provenance`, `invalid_replay_contract`, `invalid_timestamp`, `invalid_time_order`, `future_observation`, `post_start`, `unsupported_policy`, `invalid_market`, `incomplete_market`, `stale_observation`, `suspended_market`, `suspended_outcome`, `invalid_outcome`, `duplicate_outcome`, `identity_conflict`, `invalid_price`, `market_limit_exceeded` and `unavailable_price`. Success/failure envelopes, error objects, nested index/outcome/inspection metadata and every nested successful value are recursively frozen; readonly TypeScript contracts match this runtime guarantee. Strict-mode mutation attempts are tested to throw rather than merely checking freeze flags.

## Odds-core relationship

`toOddsMarketInput` normalizes and applies every calculation-readiness gate before emitting the existing `MarketPriceInput` contract with canonical price strings and observation references. `decimalOddsToImpliedProbability`, `calculateMarketOverround` and `removeMarginProportionally` remain provider-independent and unchanged. The observation snapshot establishes the factual inputs and replay capability declaration for arithmetic replay. Persistence and independent verification of the upstream payload hash remain later work.

## MVP scope and deferred decisions

Supported now: strict manual/in-memory normalization, exact canonical IDs, full validated source envelopes, explicit replay limitations, pre-match timestamps, baseline freshness classification, price/market states, provenance references and fail-closed deterministic odds handoff.

Deferred: paid-provider selection, automated acquisition, legal/licensing approval, provider timestamp/hash trust and skew allowances, sport/market/operator freshness selection, identity mapping and correction workflows, actual raw/canonical retention, digest recomputation, persistence, D1 migrations, APIs, UI, forecasting, recommendations, staking and wager execution.
