# Result observations and settlement facts

Status: TASK-21 implementation candidate; incomplete until independent review and integration (2026-08-28)

## Domain separation and public API

`result-observation.ts` deliberately exposes three records rather than one mutable result:

- `normalizeSourceResultObservation` validates `source-result-observation-v1`: exactly what a provider reported, `source-envelope-v1`, payload hash/replay declaration, provider event/participant/role references and optional source sequence. It survives unresolved canonical identity and cannot produce a settlement fact itself.
- `normalizeCanonicalResultObservation` validates `canonical-result-observation-v1`: one exact `canonical-identity-v2` event, a one-to-one evidence-backed source-participant mapping, normalized lifecycle, sport-neutral outcomes/placements/scores, immutable provenance and explicit correction parent.
- `normalizeCanonicalResultValue` parses and validates one canonical observation directly. It never fabricates a parent or invokes history classification.
- `validateResultCorrectionLineage` validates a bounded current-to-root collection of complete immutable observations and returns `validated-result-lineage-v1`.
- `validateResultObservationGraph` validates one declared authoritative snapshot, its selected current observation and complete graph, then issues an opaque current-runtime `validated-result-graph-v1` capability.
- `deriveSettlementFact` accepts only that exact graph capability, verifies membership in the current runtime's private registry rather than structurally revalidating a caller-authored graph, and emits `settlement-fact-v1` retaining it. Copies, serialization round-trips and capabilities from another registry instance are rejected; durable or cross-runtime rehydration remains deferred. Bare references or a selected ancestry alone are not accepted.
- `classifyResultObservationHistory` classifies an append-only candidate as new, exact duplicate, unchanged lifecycle transition, correction, reversion, conflict or already superseded. Structural graph errors remain typed failures.

All functions accept `unknown`, inspect it with `untrusted-json-inspection-v2`, reject unknown/credential-bearing fields, and return recursively frozen success or failure trees. They do not read the clock, random state, network or storage.

Successful canonical normalization also issues an opaque current-runtime observation capability. History, lineage and graph APIs accept only these capabilities in defensively inspected plain dense arrays; structural fixtures, copies, spreads, clones, JSON round-trips and proxies fail with `untrusted_canonical_observation`. Successful graph validation similarly issues an opaque graph capability, and settlement accepts only that exact graph object. Raw normalization inputs remain fully subject to `untrusted-json-inspection-v2`; capability wrappers are inspected separately without cloning away identity.

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

Exact replay of the same immutable observation is `exact_duplicate`. A same-state, same-fact observation with equal completion data but new provenance is `unchanged_transition`; a governed lifecycle progression is `lifecycle_transition`. Lifecycle regression, incompatible completion facts and every other unlinked contradiction conflict, including same-provider winner reversals. A linked, authority-preserving fact change is a correction. The policy never selects a provider by recency, popularity, majority or array order.

`result-lifecycle-transition/1` permits only scheduled→in-progress/postponed, in-progress→provisional/official/abandoned/cancelled, and provisional→official when participant facts and completion time agree. Same-state, same-fact observations require equal completion data to be unchanged. Official→provisional, terminal→non-terminal, unlinked corrected states and incompatible completion data conflict. Corrections use only the linked governed correction path.

## Identity and provenance

Canonical normalization requires exact equality for entity-tagged event, sport and competition IDs; canonical identity contract version; event start; and the complete participant ID, role ID and role-semantic set. Each provider participant and role is uniquely mapped to one canonical participant, role ID and semantic role. Every mapping must be backed through the separate trusted argument by an opaque `resolver-issued-result-mapping-v1` decision created from a live exact participant resolution in the canonical alias module. A module-private `WeakSet` makes fabricated, copied, spread, serialized or foreign-runtime decisions non-authoritative. Retained `result-mapping-evidence-v1` provenance binds the resolver/alias versions and lifecycle interval, source/provider/event/participant/role scope, canonical identities and supporting evidence. Unresolved, ambiguous, rejected, expired, superseded, similarity-based, out-of-period or scope-mismatched decisions fail closed.

`resolver-issued-result-mapping-v1` uses one explicit strict UTC millisecond `mappingEvaluatedAt`. Its participant and event resolutions must both have been evaluated at that exact instant and both half-open alias intervals must contain it. The retained decision includes separate participant/event resolution and alias references, versions, lifecycle intervals, evaluated times, source/provider/external/canonical scope, exact status/kind and supporting evidence. Substitution of either nested resolution fails exact authority comparison during normalization.

This is in-process authenticity only: it proves issuance by the canonical resolver in the current trusted runtime. Mapping decisions, normalized observations and validated graphs cannot survive serialization or cross an instance boundary. Module duplication, hot reload, separate bundles, separate Worker isolates and process restarts create separate private registries, so a capability from one instance is rejected by another. Durable use requires a governed persistence/signature/keyed-integrity trust boundary and an explicit rehydration process; these capabilities are deliberately unsuitable for persisted or cross-isolate settlement workflows.

Settlement facts retain the exact validated lineage observations, mapping records, canonical/source references, evidence and event identity. This proves only deterministic interpretation of supplied validated observations; it does not prove provider truth, payload availability or persistence.

## Time and ordering

All instants are strict UTC ISO-8601 milliseconds. Offset-bearing, missing-millisecond and invalid calendar values fail. Required ordering is:

`eventStartAt <= completedAt <= effectiveAt <= observedAt <= receivedAt <= evaluationAt`

For every successor, effective, observed and receipt times must not predate the parent; `correctionAt` must be at or after both parent and successor receipt and, when the parent is corrected, must not predate the parent's `correctionAt`. Comparable canonical integer source sequences strictly advance. A decreasing/equal comparable sequence fails even when timestamps advance. Missing or incomparable sequences provide no evidence and require at least one strictly advancing timestamp. Equal correction times are permitted with otherwise valid ordering.

Graph `evaluationAt` is injected validation/derivation time, not immutable source-history ordering. Every receipt and correction must exist by that instant, and settlement `derivedAt` equals it. Historical observations' stored evaluation values are not required to be monotonic. No system clock is read.

## Authoritative snapshot graph

`validated-result-graph-v1` requires a caller-declared `snapshotRef`, `authoritative_snapshot` completeness, one canonical result scope, unique observations, complete parents, no cycles or forks, exact correction authority and valid ordering. Authority-verified observations are ordered by `observationRef` with an explicit UTF-16 code-unit comparator before semantic validation. Duplicate, missing-parent, fork, cycle, scope/authority, depth and current-selection witnesses therefore use canonical inventory order rather than caller order; semantic paths, entity references and metadata replay identically under permutation. Structural capability-container failures may remain positional because no canonical inventory exists yet. Graph inventory and references, roots, successor-map keys and each successor list use the same comparator. Selected lineage is separately current-to-root. A fork fails before either branch can settle; multiple unlinked roots quarantine the graph. The selected observation must be a current leaf whose lineage covers the snapshot.

The guarantee is deliberately “fork-free within the validated authoritative snapshot,” not globally fork-free. A `partial_subset` is rejected. Without persistence this contract cannot prove that an authoritative caller omitted data; snapshot authority, storage completeness and governance remain external obligations.

## Versioned limits and input safety

`result-contract-limits-v1` publishes: 16 participants, 16 placements, 16 score components per participant, 16 evidence references, 16 existing observations and correction-chain depth 16. Mapping evidence is capped at 16 records and 16 supporting references by `result-mapping-evidence-limits-v1`. Authoritative graphs are capped at four complete observations and depth four by `result-graph-limits-v1`. The outer `untrusted-json-inspection-v2` limits apply first.

Inputs may not contain sparse arrays, repeated object aliases, accessors, hostile prototypes, unsupported values, unknown fields or credential-like names. Validation performs outer inspection before domain work and does not expose raw exceptions.

## Audit, replay and sport neutrality

Normalized outputs are canonicalized by participant ID, score-component ID and evidence reference so permutations with the same canonical identity replay identically. Provider participant ordering remains preserved at the source layer because it is reported provenance. SHA-256 values are validated as canonical lowercase digests; byte verification remains the existing payload-hash boundary. Replay claims cover pure deterministic validation and derivation from supplied records, not source truth, locator durability or persistence.

The contract supports AFL win/loss/draw, MMA and boxing win/loss/draw/no-contest, and unambiguous multi-participant unique placements without binary assumptions. Dead heats, partial placement and sport-specific settlement interpretation remain governed policy work.

## Explicit MVP exclusions and open decisions

This slice includes no provider integration, scraping, persistence, D1 migration, route, schedule, automated bet settlement, financial mutation, recommendation, UI or deployment change. Open governance decisions include authoritative result providers, conflict adjudication, sport/ruleset-specific void/push interpretation, partial placements/dead heats, event abandonment thresholds, provider sequence comparison, correction approval, and when provisional facts might become eligible. See the open-decisions register.
