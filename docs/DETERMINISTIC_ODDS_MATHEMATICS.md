# Deterministic odds mathematics

Status: implemented as a pure, provider-independent domain slice; no forecasting, recommendation, staking, persistence or execution (2026-08-28)

The canonical implementation is [`src/domain/intelligence/odds.ts`](../src/domain/intelligence/odds.ts). It accepts canonical decimal strings, performs exact `bigint` integer/rational arithmetic and returns discriminated success/error results. IEEE-754 numbers are not authoritative inputs or outputs.

## Numeric contract

- Decimal odds use scale `1e6`. Valid input is an unsigned canonical decimal string with at most six fractional digits and value strictly greater than `1.000000`. Output is padded to six digits.
- Probabilities and rates use scale `1e9`. Authoritative outputs include the scaled integer as a decimal string and a nine-place display string.
- Division rounds to nearest with ties to even unless probability-vector normalisation requires sum-preserving apportionment.
- Proportional fair probabilities use largest-remainder apportionment at `1e9`: floor every exact normalized share, then distribute residual nanos to the largest fractional remainders, breaking exact ties by original outcome order. The returned vector therefore sums to exactly `1.000000000`.
- This module handles no currency. Future money calculations remain integer minor units under ADR-0004.

## Inputs and explicit unavailable states

A market declares `completeness: 'complete' | 'incomplete'`. Each outcome supplies a unique `outcomeId`, decimal odds, `availability: 'active' | 'suspended'`, `freshness: 'current' | 'stale'`, and an optional immutable `observationRef` for future provenance.

Calculations fail with a typed code for `incomplete_market`, `missing_price`, `suspended_price`, `stale_price`, `non_finite_price`, `invalid_odds` or `invalid_probability`. Missing or unavailable data is never converted into probability zero, odds `1`, or an empty successful result.

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

Results retain formula/method versions, canonical odds, odds micros, raw implied probability nanos, exact-sum fair probability nanos, overround, input order, outcome IDs, optional observation references and the per-outcome one-nano apportionment adjustment. Callers can hash or persist this immutable result later; this slice performs neither action.

## Explicit exclusions

- No source/provider integration, scraping or network access.
- No event/market identity matching beyond caller-declared completeness and unique outcome IDs.
- No model, calibration, recommendation or eligibility decision.
- No Kelly staking, paper ledger, arbitrage opportunity validation or wager placement.
- No storage, API, UI, migration or Cloudflare change.
