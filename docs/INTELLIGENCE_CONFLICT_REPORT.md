# Intelligence architecture conflict and overlap report

Baseline reviewed: `origin/main` at `e128273` (`Prepare guarded production deployment foundation`) on 2026-08-28.

This is a read-only reconciliation of the proposed intelligence architecture with the repository. No source, configuration, migration or infrastructure file was changed.

## Summary

The accepted [canonical architecture](ARCHITECTURE.md) already anticipates most required records and safety boundaries. The new architecture supplies mathematical semantics, sport plug-in gates, adapter constraints, evaluation requirements and a staged evidence plan. There is no blocker to documentation acceptance, but current implementation claims and several product-scope statements need reconciliation before any intelligence code is treated as production-ready.

## Alignment

- `docs/ARCHITECTURE.md` already separates market data, modelling, recommendation, bankroll/risk, bets, settlement, evaluation and arbitrage modules.
- ADR-0003’s append-only corrections/ledger and ADR-0004’s scaled numeric/time conventions are compatible and remain normative.
- Existing architecture already requires raw/canonical separation, exact provenance, immutable recommendation bundles, freshness, pre-match-only handling, provider neutrality and no automatic placement.
- `docs/FEATURES.md` already calls for walk-forward evaluation, calibration, de-vigged baselines, CLV, correlation caps and arbitrage friction validation.
- UI/README language already makes paper mode, pass decisions, uncertainty and honest empty states central.

## Conflicts or semantic risks

| Area | Current repository | Proposed resolution before implementation |
| --- | --- | --- |
| Priority sports | README/features/UI include tennis alongside AFL/UFC/boxing; request prioritises AFL/MMA/boxing | Keep tennis as a deferred existing product scope item; require its own plug-in/admission decision (O-05). Do not remove UI/docs in this branch. |
| Implemented odds helper | `src/domain/betting/odds.ts` uses JS `number`, treats invalid decimal odds as implied probability `1`, and embeds recommendation policy | Treat as unvalidated UI/demo helper only. Future deterministic engine must use strict errors/scaled semantics and separate math from eligibility. No code change in this phase. |
| Confidence | Helper multiplies Kelly by a scalar `confidence`; types expose an unexplained 0–1 value and UI labels it `/100` | Replace only in a future implementation with a versioned, empirically validated uncertainty representation/discount. Do not claim the current scalar is calibrated confidence. |
| Recommendation status | Helper returns `bet/watch/pass`; requested product is paper-first and no guaranteed outcomes | Future domain should prefer `eligible/watch/pass/unavailable` plus a separately recorded paper stake/user decision. UI wording can remain until implementation work is authorised. |
| “Domain calculation implemented” | FEATURES says arbitrage domain calculation is implemented, but the helper only computes `1-Σ1/d` | Narrow this claim later: it is only a frictionless necessary-condition calculation, not operational arbitrage validation. |
| “Current slice” claims | README says fair-price, Kelly sizing and arbitrage calculation exist | Accurate only for a presentation helper; none is validated engine logic. Existing warning partly mitigates this. |
| Bankroll modes | Accepted architecture leaves paper-only versus optional manual-real-money safely deferred | This intelligence workstream decides engine-controlled mode is paper-only. Manual external tracking remains O-04 and must never imply placement. |
| API/object detail | Canonical architecture proposes many tables and endpoints | New names/contracts are conceptual overlays, not schema changes. Reconcile naming in a later schema ADR rather than duplicating entities. |
| Provider runtime | Canonical architecture describes future Cron/Queues/R2/Workflows | This branch makes no infrastructure choice or activation. Automated ingestion is Roadmap Phase 9 after provider review. |
| Existing migrations | `migrations/0001_platform_foundation.sql` exists | Untouched by design. Future intelligence persistence requires new forward-only migrations in another approved workstream. |

## File-level overlap

| Existing file | Overlap | Action in this branch |
| --- | --- | --- |
| `docs/ARCHITECTURE.md` | canonical platform/domain boundary | Referenced; not edited, avoiding conflict with concurrent cutover work |
| `docs/FEATURES.md` | intended models, pricing, staking, arbitrage and evaluation | Referenced; not edited because status wording should change only with implementation agreement |
| `docs/PRODUCTION_CUTOVER.md`, `docs/CLOUDFLARE_FOUNDATION.md`, `docs/PRODUCTION_PREPARATION_EVIDENCE.md` | deployment and infrastructure | Explicitly out of scope; untouched |
| `docs/adr/0003-*`, `0004-*` | immutability, ledger, time/numeric representation | Retained and relied upon |
| `src/domain/betting/odds.ts` | prototype math and combined policy | Audited only; no changes |
| `src/domain/betting/types.ts` | UI-facing collapsed opportunity type | Audited only; future refactor needed after domain-contract approval |
| `src/features/position-builder/*`, bankroll/market UI | paper calculator/presentation | No changes; future integration must preserve fact separation and stale states |
| `migrations/*`, `wrangler.jsonc`, deployment scripts/tests | persistence/infrastructure | No changes |

## Concurrent-work conflict posture

This branch starts at current `origin/main` and adds documentation under `docs/` plus ADR index links only. It deliberately does not edit `docs/ARCHITECTURE.md`, production cutover/foundation documents, config, runtime source or migrations, minimising overlap with the concurrent Cloudflare/domain work. A future merge should still check whether `origin/main` has added ADR numbers or changed the canonical product scope; renumber new ADRs or update this baseline report rather than overwriting concurrent decisions.

## Required follow-up before code

1. Resolve O-01/O-02 and source permission/retention questions.
2. Approve the math and uncertainty conventions, especially de-vig, confidence and correlation.
3. Reconcile FEATURES/README “implemented” wording with validated-versus-prototype status.
4. Define an implementation ADR mapping conceptual objects to the accepted canonical entities before adding schemas/APIs.
5. Replace or quarantine the UI helper only in a separately authorised implementation branch with tests and migration review.
