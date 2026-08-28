# Intelligence engine unresolved decisions

Status: unresolved proposals and provider-dependent assumptions (2026-08-28)

Nothing in this register authorises data acquisition, real-money use or provider integration.

## Product, legal and safety

| ID | Decision needed | Current assumption / evidence required |
| --- | --- | --- |
| O-01 | Legal classification and applicable Commonwealth/state/territory obligations | Paper-only independent decision support is the design boundary; obtain qualified Australian legal review before external beta or any real-money tracking/linking. |
| O-02 | Responsible-gambling control/copy baseline | Keep pause, cooling-off, caps, help and no-guarantee language; determine which National Consumer Protection Framework/BetStop obligations or best practices apply. |
| O-03 | Audience and distribution | Private beta is assumed. Public tips, subscriptions, affiliate links and notifications need a separate legal/product decision. |
| O-04 | Manual recording of externally placed bets | Architecture can distinguish it, but phase scope is paper-only. Decide whether it should remain excluded. |
| O-05 | Tennis in existing product scope | Existing docs/UI include tennis; this workstream prioritises AFL/MMA/boxing. Decide whether tennis is deferred or receives a later plug-in plan. |

## Providers and acquisition

| ID | Decision needed | Provider-dependent evidence |
| --- | --- | --- |
| O-10 | Price/event/result provider(s) | Licensed Australian operator coverage, exchanges, sports, market depth, history, timestamp provenance, corrections, availability and cost. |
| O-11 | Permitted acquisition methods | Written terms/licence for API, files or manual entry; no assumption that HTML scraping, automation or redistribution is allowed. |
| O-12 | Retention and reproducibility | Whether raw payloads may be retained, duration, audit use, derived-data rights, deletion and post-termination rights. |
| O-13 | Timestamp semantics | Whether timestamps are provider observation, upstream creation or delivery; clock precision/skew and historical point-in-time guarantees. |
| O-14 | Limits/liquidity/commission | Availability and reliability by operator/account/market; absent fields make arbitrage non-actionable. |
| O-15 | Official sport features/results | Authoritative sources, licences, correction cadence, entity identifiers and publication times for AFL, MMA and boxing. |
| O-16 | Provider outage/fallback | Whether consensus may degrade to fewer sources, minimum coverage, source weighting and suspension thresholds. |

### Resolved for the normalized observation slice

- **Time syntax:** observation, receipt, event-start and calculation/as-of instants use ADR-0004 canonical UTC ISO-8601 milliseconds. Offset-bearing, offset-free and non-millisecond inputs are rejected at this boundary.
- **Baseline freshness contract:** `baseline-pre-match` version `1` uses a 60,000 ms maximum age solely as a deterministic MVP/test baseline. The exact boundary is inclusive (`age <= 60,000 ms` is current). Sport/market/operator policy selection and production thresholds remain O-13/O-29 governance work.
- **Ordering:** observation must not be after `asOf`; receipt must be between observation and `asOf`; `asOf` must be strictly before event start. Invalid ordering is preserved as an error, not relabelled stale.
- **Observation limits:** deterministic-odds outcome, outcome-ID, observation-reference and decimal-price limits are reused. Version-1 source/canonical IDs are bounded to 128 characters, provider references to 256, source sequence/version references to 128 and fixed canonical timestamps to 24.
- **Provenance boundary:** `source-envelope-v1` retains source/provider identity, source schema, terms/licence reference, adapter/version, retrieval method, observation/effective/receipt times, canonical upstream-supplied SHA-256, explicit replay/retention mode, and immutable per-outcome references/sequence. This slice validates rather than computes the hash. Provider selection, actual retention/licensing, locator durability, hash verification and persistence remain unresolved under O-10–O-13.
- **Strict adapter boundary:** manual formats and normalized DTOs reject unknown keys and credential-bearing field names. Future provider adapters must explicitly map raw provider fields into this contract; arbitrary provider state cannot flow through.

## Mathematical and modelling policy

### Resolved for the first canonical identity subset

- **Identity authority:** opaque canonical IDs are not derived from display names. Effective-dated aliases resolve only from one exact evidence-backed source/provider/external-key candidate with matching entity and sport/competition/event-time context. Similarity is evidence only; ambiguity quarantines without a winner.
- **Observation corrections:** facts are append-only. An explicit parent and exact source/provider/event/market/identity scope are mandatory; different hashes alone are insufficient. Missing parents, cycles, reused references and equal-hash metadata disagreement fail closed.
- **Ordering:** comparable integer source sequence precedes observation time, receipt time and opaque reference; sequence/time disagreement is retained in the decision.
- **Hash verification:** supplied bytes use Web Crypto SHA-256 under a 1 MiB pre-hash limit; strings are UTF-8; object serialization is undefined. Missing retained bytes are `not_verifiable`.

Still open: persistence constraints and retention duration, provider/result sources, sport-specific event revision tolerances, review workflow for quarantine, and production-scale graph/payload limits.

| ID | Decision needed | Proposed starting point / experiment |
| --- | --- | --- |
| O-20 | De-vig methods | Proportional baseline; compare power/odds-ratio and source-specific treatments out of sample. |
| O-21 | Consensus construction | Define operator eligibility, quote synchronisation, weighting, outliers and minimum source count without circularly training the independent model. |
| O-22 | Forecast family/features | Start simple/interpretable per sport; decide only after point-in-time data audit. |
| O-23 | Calibration method | No post-hoc method until nested time-based validation compares no recalibration, isotonic/logistic or suitable alternatives. |
| O-24 | Uncertainty semantics | Choose posterior/predictive, bootstrap or ensemble representation and validate coverage; reject an ungrounded 0–1 “confidence” score. |
| O-25 | Graduation thresholds | Predeclare minimum sample, Brier/log-loss/calibration and stability criteria by sport/market/horizon. |
| O-26 | Closing line | Define eligible operators, timestamp relative to start, aggregation/de-vig and unavailable-close handling. |
| O-27 | Kelly fraction and caps | Simulate quarter Kelly as a candidate; approve exact single/event/cluster/sport/period/drawdown caps only from paper evidence and safety review. |
| O-28 | Correlation | Begin conservative exposure groups; determine evidence threshold for joint scenarios/covariance and constrained portfolio Kelly. |
| O-29 | Arbitrage buffer | Define freshness, slippage, commission, currency, partial-fill, minimum-return and unknown-limit rules by source/ruleset. |

### Resolved for the deterministic odds slice

- **Numeric representation:** ADR-0004 controls. Decimal odds are canonical strings at `1e-6`; probabilities/rates are scaled at `1e-9`; calculations use exact integer/rational arithmetic and half-even division rounding.
- **O-20 first baseline:** proportional normalization is method `proportional` version `1`. It is a reproducible market baseline, not market truth; alternative methods remain future evaluation work.
- **Completeness:** market calculations require at least two caller-declared exhaustive, mutually exclusive outcomes with unique IDs and active, current, present prices. This slice validates the declaration; canonical event/market equivalence remains future work.
- **Expected value:** version 1 is the binary unit-stake formula `EV = pd - 1`, excluding pushes, voids, commission, fees and execution effects. General payoff states remain unresolved.
- **Probability-vector rounding:** exact proportional shares use largest-remainder apportionment at `1e9`, with original outcome order as the deterministic exact-tie breaker, so the output sums to exactly one.
- **Arithmetic replay boundary:** the current slice replays supplied canonical values but is not a complete factual-lineage record. A future observation/derived-fact contract must carry observed time, calculation as-of time, freshness-policy version and complete immutable parent references.

## Sport boundaries

| ID | Decision needed | Dependency |
| --- | --- | --- |
| O-30 | AFL competition/market sequence | Men’s AFL premiership head-to-head proposed; decide AFLW, finals/draw semantics and line timing. |
| O-31 | MMA promotions/jurisdictions | UFC is not identical to the sport; select promotions and applicable commission/rules versions. |
| O-32 | Boxing scope | Select competitions/sanctioning contexts, record source and acceptable verification standard for fragmented data. |
| O-33 | Fighter/team availability | Define what is knowable by cutoff and how late replacement, lineup, weigh-in and injury information invalidates forecasts. |
| O-34 | Future sport admission ranking | Measure event frequency, usable history, market quality, rule stability, data rights and out-of-sample predictability; do not rank by intuition alone. |

## Engineering/governance (future implementation only)

- Canonical decimal/probability scale tolerance and API representation consistent with ADR-0004.
- Artifact storage/retention, executable model format, deterministic replay tolerance and random-seed policy.
- Exact module-to-table ownership and event transport; this phase deliberately defines neither schema nor jobs.
- Approval roles, independent reviewer availability, incident severity and automatic suspension thresholds.
- Privacy classification for source artifacts, user paper records and exported provenance bundles.
