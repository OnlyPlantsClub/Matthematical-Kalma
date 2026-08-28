# Result observations and settlement facts

Status: TASK-21 implementation candidate; incomplete until independent review and integration (2026-08-28)

## Domain separation and public API

`result-observation.ts` deliberately exposes three records rather than one mutable result:

- `normalizeSourceResultObservation` validates `source-result-observation-v1`: exactly what a provider reported, `source-envelope-v1`, payload hash/replay declaration, provider event/participant/role references and optional source sequence. It survives unresolved canonical identity and cannot produce a settlement fact itself.
- `normalizeCanonicalResultObservation` validates `canonical-result-observation-v1`: one exact `canonical-identity-v2` event and complete participant/role set, normalized lifecycle, sport-neutral outcomes/placements/scores, immutable provenance and explicit correction parent.
- `deriveSettlementFact` validates and emits `settlement-fact-v1`: the immutable, versioned interpretation of one eligible accepted canonical observation under `accepted-terminal-result/1`, retaining the source observation and exact correction chain.
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

Competitive terminal results require explicit winner(s), draw, or a uniform bounded special outcome. Missing data never implies a winner. Winner and draw cannot coexist. A winner's supplied placement must be 1; a loser cannot be placed first. Same placement is allowed for ties.

## Settlement vocabulary

The bounded participant outcome vocabulary is `winner`, `loser`, `draw`, `void`, `push`, `no_contest`, and `unresolved`. Draw and no contest are distinct. `unresolved` is a preservation state, never an eligible settlement fact outcome. Outcomes describe facts, not sportsbook payout rules. Placement is optional and supports more than two participants; score components are opaque canonical IDs with bounded decimal strings.

No source result, canonical result, or settlement fact permits stake, payout, profit, bankroll, Kelly sizing, or recommendation fields.

## Corrections and conflicts

Corrections append a new immutable `corrected` observation with `correctsObservationRef` and `correctionAt`; they never overwrite a predecessor. The bounded graph validator rejects missing parents, forks, cycles, cross-event links, unchanged corrections and excessive depth. A changed result matching an earlier ancestor is explicitly classified `reversion` rather than hidden as an ordinary correction.

Exact replay of the same immutable observation is `exact_duplicate`. A provisional-to-official change with unchanged participant facts is `unchanged_transition`. An unlinked same fact with different provenance is a conflict, as are disagreeing providers for the same canonical scope. The policy never selects a provider by recency, popularity or array order. Future governance may resolve quarantined conflicts outside this contract.

## Identity and provenance

Canonical normalization requires exact equality for entity-tagged event, sport and competition IDs; canonical identity contract version; event start; and the complete participant ID, role ID and role-semantic set. Missing, additional, ambiguous or cross-event identities fail closed. Canonical source ID, provider reference, provider event reference, payload hash, source observation reference, observation/effective/receipt timestamps and sequence must exactly match the source observation.

Settlement facts retain both the exact canonical and source observation references, correction chain, evidence references and accepted event identity. Source observations remain valid evidence even if canonical normalization or fact derivation fails.

## Time and ordering

All instants are strict UTC ISO-8601 milliseconds. Offset-bearing, missing-millisecond and invalid calendar values fail. Required ordering is:

`eventStartAt <= completedAt <= effectiveAt <= observedAt <= receivedAt <= evaluationAt`

Equal adjacent timestamps are allowed. For corrections, `observedAt <= correctionAt <= evaluationAt`. `derivedAt` must equal the caller-injected `evaluationAt`; no system clock is read. Optional source sequence is preserved as an opaque ordering reference. Result history requires explicit correction links; timestamp or sequence ties never invent a parent, and ambiguity fails closed.

## Versioned limits and input safety

`result-contract-limits-v1` publishes: 16 participants, 16 placements, 16 score components per participant, 16 evidence references, 16 existing observations and correction-chain depth 16. The outer `untrusted-json-inspection-v2` limits apply first (128 containers, 512 properties/entries, 16,384 cumulative string code units, depth 8, 64 object keys, array length 17 and individual string length 1,024). Exact boundaries are accepted where the complete outer shape also fits; one-over fails closed at the earliest boundary.

Inputs may not contain sparse arrays, repeated object aliases, accessors, hostile prototypes, unsupported values, unknown fields or credential-like names. Validation performs outer inspection before domain work and does not expose raw exceptions.

## Audit, replay and sport neutrality

Normalized outputs are canonicalized by participant ID, score-component ID and evidence reference so permutations with the same canonical identity replay identically. Provider participant ordering remains preserved at the source layer because it is reported provenance. SHA-256 values are validated as canonical lowercase digests; byte verification remains the existing payload-hash boundary. Replay claims cover pure deterministic validation and derivation from supplied records, not source truth, locator durability or persistence.

The contract supports AFL win/loss/draw, MMA and boxing win/loss/draw/no-contest, and multi-participant placements without binary assumptions. Sport-specific rules and sportsbook settlement interpretation remain plug-in/policy work.

## Explicit MVP exclusions and open decisions

This slice includes no provider integration, scraping, persistence, D1 migration, route, schedule, automated bet settlement, financial mutation, recommendation, UI or deployment change. Open governance decisions include authoritative result providers, conflict adjudication, sport/ruleset-specific void/push interpretation, partial placements/dead heats, event abandonment thresholds, provider sequence comparison, correction approval, and when provisional facts might become eligible. See the open-decisions register.
