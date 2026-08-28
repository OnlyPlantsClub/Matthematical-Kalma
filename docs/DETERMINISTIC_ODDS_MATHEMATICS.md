# Deterministic odds mathematics

Status: implemented as a pure, provider-independent domain slice; no forecasting, recommendation, staking, persistence or execution (2026-08-28)

The canonical implementation is [`src/domain/intelligence/odds.ts`](../src/domain/intelligence/odds.ts). It accepts canonical decimal strings, performs exact `bigint` integer/rational arithmetic and returns discriminated success/error results. IEEE-754 numbers are not authoritative inputs or outputs.

## Numeric contract

- Decimal odds use scale `1e6`. Valid input is an unsigned canonical decimal string with at most six fractional digits, no more than 12 characters, and value strictly greater than `1.000000` and no greater than `10000.000000`. Output is padded to six digits.
- Probabilities and rates use scale `1e9`. Authoritative outputs include the scaled integer as a decimal string and a nine-place display string.
- Division rounds to nearest with ties to even unless probability-vector normalisation requires sum-preserving apportionment.
- Proportional fair probabilities use largest-remainder apportionment at `1e9`: floor every exact normalized share, then distribute residual nanos to the largest fractional remainders, breaking exact ties by original outcome order. The returned vector therefore sums to exactly `1.000000000`.
- This module handles no currency. Future money calculations remain integer minor units under ADR-0004.

## Bounded domain

The exported version-1 limits are 12 decimal-odds input characters, odds micros no greater than `10000000000` (`10000.000000`), 11 independent-probability input characters, 16 market outcomes, 128 characters per outcome ID and 256 characters per observation reference. Oversized numeric strings are rejected before regular-expression matching or `bigint` conversion. Excessive markets are rejected before per-outcome validation, fraction accumulation, sorting or output allocation. Within these odds and outcome-count bounds even the smallest possible normalized share remains greater than one probability nano, so a valid outcome cannot be apportioned to zero.

The AFL and combat-sport MVP begins with head-to-head/winner markets and explicit draw outcomes, so its intended complete market has two or three outcomes. Sixteen outcomes provide ample conservative headroom without exposing exact-rational arithmetic to unbounded denominator growth. Odds of 10,000 likewise exceed the intended winner-market range while bounding integer size. These are version-1 safety limits, not claims about all future market types; a future contract version may raise them only with new stress evidence.

Benchmark evidence recorded on 2026-08-28 using Node 24.19.0 on the review workstation: 10,000 maximum-size valid 16-outcome markets with distinct odds immediately below the maximum completed in 6,434.579 ms total (0.643458 ms/market). Ten thousand rejections of the same one-million-character string completed in 0.635 ms total because the length check precedes regex and conversion. These measurements are evidence, not CI thresholds; deterministic limit and early-rejection tests enforce the behavior.

## Inputs and explicit unavailable states

A market declares `completeness: 'complete' | 'incomplete'`. Each outcome supplies a unique valid `outcomeId`, decimal odds, `availability: 'active' | 'suspended'`, `freshness: 'current' | 'stale'`, and an optional non-empty `observationRef` for future provenance. All exported functions validate runtime values as untrusted input; malformed objects, arrays, fields and enums fail with a typed error rather than relying on TypeScript callers.

Calculations fail with a typed code for unavailable states, malformed structures, invalid identifiers/references, numeric range limits and market-size limits. Missing or unavailable data is never converted into probability zero, odds `1`, or an empty successful result. Errors include a stable input `path` and, where applicable, an outcome index and ID.

Freshness classification belongs to the preceding validated observation/snapshot layer documented in [MARKET_OBSERVATIONS.md](MARKET_OBSERVATIONS.md). This arithmetic slice only accepts or rejects that layer's explicit `current`/`stale` classification; it does not calculate age from timestamps. The observation layer now supplies observed, receipt, event-start and calculation/as-of times, freshness-policy version and immutable observation references. Canonical content hashing and persistence still remain future requirements before a calculation is stored as a complete derived fact.

## Formulas

For valid decimal odds `d_i`:

- Raw bookmaker-implied probability: `q_i = 1 / d_i`.
- Implied-probability total: `Q = Σ q_i`.
- Market overround: `O = Q - 1`.
- Proportional baseline fair probability: `p_i^market = q_i / Q`.

Proportional de-vig is the approved first baseline because it is transparent, deterministic and provider-independent. It assumes margin is distributed proportionally and is not market truth. Power, odds-ratio and source-specific alternatives remain future out-of-sample research; every replay identifies method `proportional`, version `1`.

For offered decimal odds `d` and an independently supplied win probability `p`, simple binary unit-stake expected net value is:

`EV = p(d - 1) - (1 - p) = pd - 1`.

This formula assumes win/lose only and excludes pushes, voids, commission, fees, rebates, currency effects and execution risk. Those require a future versioned payoff-state contract. Positive EV is not a recommendation.

## Bookmaker probability versus independent probability

Raw implied and proportionally de-vigged probabilities are deterministic transformations of bookmaker prices. They are market baselines, not independent forecasts. `calculateExpectedValue` deliberately names its separate input `independentProbability`; this slice does not create, calibrate or validate that probability.

## Example

A two-way market at `1.900000` / `1.900000` has raw implied probabilities of approximately `0.526315789` each, total `1.052631579`, and overround `0.052631579`. Proportional normalization returns `0.500000000` for each outcome.

At offered odds `2.200000` and an independent probability of `0.500000000`, binary unit-stake EV is `0.100000000`, meaning an expected net return of 0.1 stake units under the stated simplified payoff assumptions.

## Audit detail

Results retain formula/method versions, canonical odds, odds micros, raw implied probability nanos, exact-sum fair probability nanos, overround, input order, outcome IDs, optional validated observation references and the per-outcome one-nano apportionment adjustment. This is sufficient for deterministic **arithmetic replay of the supplied values only**. It does not reconstruct complete factual lineage and does not yet satisfy the architecture's “exact parents” provenance requirement. Callers can hash or persist this immutable result later; this slice performs neither action.

## Explicit exclusions

- No source/provider integration, scraping or network access.
- No event/market identity matching beyond caller-declared completeness and unique outcome IDs.
- No model, calibration, recommendation or eligibility decision.
- No Kelly staking, paper ledger, arbitrage opportunity validation or wager placement.
- No storage, API, UI, migration or Cloudflare change.
