# Intelligence engine roadmap

Status: proposed; sequencing and exit gates, not an implementation commitment (2026-08-28)

Each phase produces paper-only, replayable evidence. A later phase does not begin merely because code exists; its predecessor’s exit gate must pass. Infrastructure/deployment and existing migrations remain outside this roadmap.

## Phase 0 — Governance and fixtures

- Approve terminology, provenance minimum, model/policy lifecycle, source review checklist and sport plug-in contract.
- Create versioned synthetic/golden fixtures for two-way, three-way, line, push/void, commission, correction and stale/ambiguous cases.
- Define the evaluation report template and leakage checklist before model selection.

Exit: ADRs accepted, formula conventions and reason-code catalogue frozen for the first implementation slice.

## Phase 1 — Deterministic odds mathematics

**Status:** implemented; independent validation passed on `agent/deterministic-odds-core`; approved for integration but not deployed or released. This status does not imply that forecasting or recommendations exist.

- Implement strict decimal-odds parsing, implied probability, proportional de-vig baseline, EV/payoff-state calculation, fair-price display, line equivalence and pure arbitrage allocation.
- Use scaled decimals/integer money and property/golden tests. Do not issue recommendations.

Delivered in this first executable slice: strict odds validation, implied probability, market overround, proportional de-vig with exact-sum probability apportionment, simple binary unit-stake EV, explicit incomplete/suspended/stale/missing failures, audit detail and invariant tests. Fair-price conversion, line equivalence, generalized payoff states and pure arbitrage allocation remain later Phase 1 increments.

Exit: passed — boundary, invariant, precision and replay tests pass; independent review signed off the formula and rounding conventions.

## Phase 2 — Manual/sample ingestion

**Status:** the provider-neutral canonical identity subset passed independent review and was approved for integration into canonical `main`. TASK-21 independent-review corrections are in progress: outcome-matrix, complete-lineage, conflict, correction-authority, ordering and participant-mapping blockers have an implementation candidate awaiting another independent read-only review. Phase 2, TASK-04 and TASK-21 remain incomplete; no persistence, live provider ingestion or deployment exists.

- Implement the adapter contract for approved manual/file fixtures only.
- Normalise source, event, participant, market, outcome, quote and result candidates; quarantine ambiguity.
- Build append-only snapshots, movement and provenance inspection. No automated retrieval.

Exit: two independent imports deduplicate deterministically; correction, staleness and full-lineage replays pass.

## Phase 3 — Historical evaluation harness

- Seal point-in-time datasets and rolling-origin splits.
- Add base-rate, simple rating and de-vigged market baselines; Brier/log loss, reliability, uncertainty, CLV and cohort reporting.
- Run synthetic leakage traps and reproduce reports from manifests.

Exit: known future features fail ingestion; a frozen run reproduces; baseline comparison and missing-data coverage are visible.

## Phase 4 — First AFL forecast model

- Begin with pre-match AFL head-to-head and a deliberately simple, interpretable candidate.
- Evaluate by season/round/horizon and venue/team cohorts; shadow only.
- Add line modelling only after market/settlement semantics and sample sufficiency pass review.

Exit: model card and independent leakage review complete; out-of-sample calibration and proper scores meet predeclared thresholds versus simple baselines. Otherwise retain baseline/no-forecast.

## Phase 5 — Combat-sports modelling

- Implement MMA and boxing plug-ins separately, initially winner markets.
- Verify fighter/bout identities, replacements, weigh-in/weight/round/title revisions, draws and no-contests.
- Use wider uncertainty/abstention for sparse or shifted cohorts; boxing data remains manual until reviewed.

Exit: sport-specific fixtures, leakage audit, subgroup stability and calibration evidence pass separately. One sport’s success cannot graduate the other.

## Phase 6 — Value recommendations

- Add immutable opportunity and eligibility evaluations, conservative uncertainty/sensitivity gates, reason codes and complete audit bundle.
- Publish `pass/watch/eligible` in shadow/paper mode; do not size or place wagers.

Exit: golden replay matches; stale/incomplete/ambiguous cases never qualify; recommendation-volume incentives are absent; product copy passes safety review.

## Phase 7 — Paper-bankroll sizing

- Add balanced paper ledger, fractional Kelly policy, rounding, single/event/sport/period/drawdown caps, cooling-off and conservative correlation groups.
- Simulate alternative Kelly fractions and cap regimes under parameter uncertainty.

Exit: all constraints hold under property/stress tests; stake is zero on any failed prerequisite; drawdown/risk evidence and responsible-use review approve the default.

## Phase 8 — Arbitrage monitoring

- Scan only coherent pre-match snapshots and simulate allocations after fees, limits, liquidity, timing, rounding and execution buffers.
- Revalidate and expire aggressively; unknown executability remains watch-only.

Exit: complete-outcome, equivalence and time-overlap tests pass; historical simulation includes leg failure/partial-fill stress; UI consistently says simulated/no guarantee.

## Phase 9 — Automated acquisition after provider review

- Evaluate providers against legal permission, licence/terms, coverage/history, timestamp semantics, corrections, limits/liquidity, retention, SLA, attribution, cost and exit portability.
- Implement only approved APIs/files behind the existing adapter contract; begin shadow ingestion with quality monitoring.

Exit: signed provider/product/legal review; data processing/retention approval; adapter conformance, reconciliation, rate/backoff, outage and exit tests; explicit production approval in its own workstream.

## Continuous gates

- Record every forecast and pass; never backfill a forecast as though it existed earlier.
- Re-evaluate calibration, drift, coverage, source health and CLV by version/cohort.
- Suspend automatically on replay mismatch, provenance gaps, schema/rules changes or threshold breach.
- Promotion and rollback are explicit, reviewed routing changes. No model or policy self-promotes.
