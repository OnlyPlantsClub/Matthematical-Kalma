# ADR-0014: Separate result observations from settlement facts

Status: proposed; independent-review corrections in progress (2026-08-28)

## Context

Provider result reports, canonical sporting truth and sportsbook settlement interpretation change for different reasons. Combining them would erase source evidence, make corrections appear mutable and leak payout policy into factual lineage.

## Decision

Adopt separate versioned, immutable source-result, canonical-result and settlement-fact contracts. Canonical results require an exact reviewed event and participant/role set. Corrections append one explicitly linked successor. Settlement facts derive only from official, corrected, abandoned or cancelled canonical observations under a versioned eligibility policy; provisional and unresolved observations fail closed.

Use `strict-result-matrix/1`: one winner with complete unique placements, a uniform draw with one shared draw placement, or a uniform placement-free void/push/no-contest. Dead heats and partial placements fail closed. Cancelled/abandoned results are uniform voids.

Require a one-to-one evidence-backed mapping from every provider participant/role to every canonical participant/role in exact source/provider/event scope. Corrections remain within the exact source, provider, provider-event, schema, adapter, identity and participant-mapping authority boundary. Every unlinked contradictory canonical fact conflicts, including same-provider reports.

Parse one canonical observation directly without synthetic ancestry. Govern unlinked lifecycle progression separately from linked corrections. Provisional→official requires compatible facts and completion; lifecycle regressions and incompatible completion data conflict.

Mappings require a separately supplied opaque decision issued from live exact participant and event resolutions plus an issued canonical event identity. Both resolutions must share one explicit evaluation instant and be effective then. A module-private runtime registry rejects structurally identical fabrications, copies and serialized values. Retained immutable evidence separately binds both resolver/alias contexts and the entire source/provider/canonical scope.

Successful canonical observations and validated graphs are themselves opaque capabilities. Every downstream history, lineage, graph and settlement boundary verifies private registry membership; none falls back to structural parsing. Capability collections are bounded plain dense arrays inspected without cloning their entries.

Settlement derivation internally validates a complete caller-declared authoritative snapshot, not a selected ancestry. The graph must have unique references, complete parents, one scope, no cycles/forks, valid authority and ordering, and a selected current lineage covering the snapshot. Graph inventory, roots, successor-map keys and successor lists use an explicit observation-reference code-unit order; selected lineage is current-to-root, making graph and settlement replay invariant to input permutation. Its claim is fork freedom within that snapshot only. Successor `correctionAt` cannot predate a corrected parent's correction time. Injected evaluation time establishes what is available for this validation, not historical ordering between evaluations.

## Consequences

- Source evidence survives quarantine and later identity resolution.
- Corrections and reversions are replayable without rewriting history.
- Downstream bet settlement can consume facts without result ingestion owning financial rules.
- Some apparently obvious outcomes remain unresolved until exact identity, lifecycle and governance prerequisites exist.
- Same-state/same-fact new provenance is unchanged; governed progression is distinct, while regression and incompatible completion conflict. Linked corrections remain the only correction path.
- A future storage design must preserve all three records and their references append-only.
- Replay proves deterministic interpretation of the supplied immutable observations, not provider truth or persistence.
- Snapshot authority and completeness must ultimately be enforced by governed persistence; an in-memory declaration cannot prove the caller omitted nothing.
- Private registries are instance-local. Module duplication, hot reload, separate bundles/Worker isolates, restarts and serialization all lose authority. Operational persistence requires governed authentication and rehydration; the current design is intentionally an in-memory domain boundary.

## Alternatives considered

- One mutable event result: rejected because it loses provenance and correction history.
- Provider-majority or newest-report wins: rejected because neither establishes authority.
- Binary winner/loser only: rejected because it cannot faithfully model draws, no contests, voids or multi-participant sports.
- Emit sportsbook settlement instructions now: rejected because payout rules and bankroll mutation are outside the factual domain.
