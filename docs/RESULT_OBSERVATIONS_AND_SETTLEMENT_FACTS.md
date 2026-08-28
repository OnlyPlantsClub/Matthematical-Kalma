# Result observations and settlement facts

Status: TASK-21 implementation candidate; incomplete until independent review and integration (2026-08-28)

## Domain separation and public API

`result-observation.ts` deliberately exposes three records rather than one mutable result:

- `normalizeSourceResultObservation` validates `source-result-observation-v1`: exactly what a provider reported, `source-envelope-v1`, payload hash/replay declaration, provider event/participant/role references and optional source sequence. It survives unresolved canonical identity and cannot produce a settlement fact itself.
- `normalizeCanonicalResultObservation` validates `canonical-result-observation-v1`: one exact `canonical-identity-v2` event, a one-to-one evidence-backed source-participant mapping, normalized lifecycle, sport-neutral outcomes/placements/scores, immutable provenance and explicit correction parent.
- `validateResultCorrectionLineage` validates a bounded current-to-root collection of complete immutable observations and returns `validated-result-lineage-v1`.
- `deriveSettlementFact` now receives complete `ancestors`, validates them, and emits `settlement-fact-v1` retaining the exact observations and participant mappings. Bare correction-reference lists are not accepted.
- `classifyResultObservationHistory` classifies an append-only candidate as new, exact duplicate, unchanged lifecycle transition, correction, reversion, conflict or already superseded. Structural graph errors remain typed failures.

All functions accept `unknown`, inspect it with `untrusted-json-inspection-v2`, reject unknown/credential-bearing fields, and return recursively frozen success or failure trees. They do not read the clock, random state, network or storage.

## Lifecycle and eligibility

| State | Completion | Result fields | Correction fields | Settlement fact |
| --- | --- | --- | --- | --- |
| `scheduled` | forbidden | every participant `unresolved`; no placement/score | forbidden | no |
| `in_progress` | forbidden | every participant `unresolved`; no placement/score | forbidden | no |
| `postponed` | forbidden | every participant `unresolved`; no placement/score | forbidden | no |
| `provisional` | required | complete, non-`unresolved` result | forbidden | no |
| `official` | required | complete, non-`unresolved` result | forbidden | yes |
| `corrected` | required | complete, changed result | parent and correction time required | yes |
| `abandoned` | required | every participant `void` | forbidden | yes, policy-level void fact |
| `cancelled` | optional | every participant `void` | forbidden | yes, policy-level void fact |

`strict-result-matrix/1` validates the participant collection as one fact:

- A decisive result has exactly one winner at unique placement 1, every other participant is a loser, and all placements are present, unique and contiguous from 1.
- A draw declares every participant `draw` at the same explicit canonical draw placement. It cannot mix with any other outcome.
- A special result declares every participant the same one of `void`, `push` or `no_contest`, with no placements.
- Pending states are uniformly `unresolved` without placements or scores. `unresolved` cannot mix with settlement-eligible outcomes.
- Cancelled and abandoned states are uniformly `void` without placements.

Multiple winners, mixed outcomes, partial placements, shared decisive placements, dead heats and ambiguous multi-participant interpretations fail closed. Ties/dead heats other than the uniform draw representation are deferred until a governed ruleset policy exists.

## Settlement vocabulary

The bounded participant outcome vocabulary is `winner`, `loser`, `draw`, `void`, `push`, `no_contest`, and `unresolved`. Draw and no contest are distinct. `unresolved` is a preservation state, never an eligible settlement fact outcome. Outcomes describe facts, not sportsbook payout rules. Placement is optional and supports more than two participants; score components are opaque canonical IDs with bounded decimal strings.

No source result, canonical result, or settlement fact permits stake, payout, profit, bankroll, Kelly sizing, or recommendation fields.

## Corrections and conflicts

Corrections append a new immutable `corrected` observation with `correctsObservationRef` and `correctionAt`; they never overwrite a predecessor. Correction authority requires the same sport, competition, event, identity-contract version, source, provider, provider event, source schema, adapter and provider-participant mapping. Cross-source/provider corrections conflict. The bounded graph validator rejects missing parents, forks, cycles, cross-event links, unchanged corrections and excessive depth. A changed result matching an earlier ancestor is explicitly classified `reversion`.

Exact replay of the same immutable observation is `exact_duplicate`. The same facts with new provenance or lifecycle are `unchanged_transition`. Every unlinked contradictory fact in the same canonical result scope is a conflict, including same-provider winner reversals. The policy never selects a provider by recency, popularity, majority or array order.

## Identity and provenance

Canonical normalization requires exact equality for entity-tagged event, sport and competition IDs; canonical identity contract version; event start; and the complete participant ID, role ID and role-semantic set. Each provider participant and role is uniquely mapped to one canonical participant, role ID and semantic role with an identity-evidence reference and the exact source/provider/event scope. Every source and canonical participant appears exactly once; unrelated, missing, duplicate, ambiguous and cross-event mappings fail closed. Source schema and adapter lineage are retained with the prior provenance fields.

Settlement facts retain the exact validated lineage observations, mapping records, canonical/source references, evidence and event identity. This proves only deterministic interpretation of supplied validated observations; it does not prove provider truth, payload availability or persistence.

## Time and ordering

All instants are strict UTC ISO-8601 milliseconds. Offset-bearing, missing-millisecond and invalid calendar values fail. Required ordering is:

`eventStartAt <= completedAt <= effectiveAt <= observedAt <= receivedAt <= evaluationAt`

For every successor, effective, observed and receipt times must not predate the parent; `correctionAt` must be at or after both parent and successor receipt and not after evaluation. Comparable canonical integer source sequences must strictly advance. A decreasing/equal comparable sequence fails even when timestamps advance. Missing or incomparable sequences provide no evidence and therefore require at least one strictly advancing timestamp. Equal source timestamps are accepted only with a strictly advancing comparable sequence (or a later correction time); wholly tied time with incomparable sequence fails as undetermined. `derivedAt` equals injected `evaluationAt`; no system clock is read.

## Versioned limits and input safety

`result-contract-limits-v1` publishes: 16 participants, 16 placements, 16 score components per participant, 16 evidence references, 16 existing observations and correction-chain depth 16. The outer `untrusted-json-inspection-v2` limits apply first (128 containers, 512 properties/entries, 16,384 cumulative string code units, depth 8, 64 object keys, array length 17 and individual string length 1,024). Exact boundaries are accepted where the complete outer shape also fits; one-over fails closed at the earliest boundary.

Inputs may not contain sparse arrays, repeated object aliases, accessors, hostile prototypes, unsupported values, unknown fields or credential-like names. Validation performs outer inspection before domain work and does not expose raw exceptions.

## Audit, replay and sport neutrality

Normalized outputs are canonicalized by participant ID, score-component ID and evidence reference so permutations with the same canonical identity replay identically. Provider participant ordering remains preserved at the source layer because it is reported provenance. SHA-256 values are validated as canonical lowercase digests; byte verification remains the existing payload-hash boundary. Replay claims cover pure deterministic validation and derivation from supplied records, not source truth, locator durability or persistence.

The contract supports AFL win/loss/draw, MMA and boxing win/loss/draw/no-contest, and unambiguous multi-participant unique placements without binary assumptions. Dead heats, partial placement and sport-specific settlement interpretation remain governed policy work.

## Explicit MVP exclusions and open decisions

This slice includes no provider integration, scraping, persistence, D1 migration, route, schedule, automated bet settlement, financial mutation, recommendation, UI or deployment change. Open governance decisions include authoritative result providers, conflict adjudication, sport/ruleset-specific void/push interpretation, partial placements/dead heats, event abandonment thresholds, provider sequence comparison, correction approval, and when provisional facts might become eligible. See the open-decisions register.
