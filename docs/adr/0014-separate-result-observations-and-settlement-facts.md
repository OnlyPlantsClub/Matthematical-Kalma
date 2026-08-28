# ADR-0014: Separate result observations from settlement facts

Status: proposed; independent-review corrections in progress (2026-08-28)

## Context

Provider result reports, canonical sporting truth and sportsbook settlement interpretation change for different reasons. Combining them would erase source evidence, make corrections appear mutable and leak payout policy into factual lineage.

## Decision

Adopt separate versioned, immutable source-result, canonical-result and settlement-fact contracts. Canonical results require an exact reviewed event and participant/role set. Corrections append one explicitly linked successor. Settlement facts derive only from official, corrected, abandoned or cancelled canonical observations under a versioned eligibility policy; provisional and unresolved observations fail closed.

Use `strict-result-matrix/1`: one winner with complete unique placements, a uniform draw with one shared draw placement, or a uniform placement-free void/push/no-contest. Dead heats and partial placements fail closed. Cancelled/abandoned results are uniform voids.

Require a one-to-one evidence-backed mapping from every provider participant/role to every canonical participant/role in exact source/provider/event scope. Corrections remain within the exact source, provider, provider-event, schema, adapter, identity and participant-mapping authority boundary. Every unlinked contradictory canonical fact conflicts, including same-provider reports.

Settlement derivation accepts complete immutable ancestors, not bare references. The chain must connect current-to-root without gaps, reordering, extras, duplicates, cycles or forks. Successor times cannot predate parents; comparable integer sequences strictly advance, and incomparable sequences require advancing time. Require caller-injected evaluation time.

## Consequences

- Source evidence survives quarantine and later identity resolution.
- Corrections and reversions are replayable without rewriting history.
- Downstream bet settlement can consume facts without result ingestion owning financial rules.
- Some apparently obvious outcomes remain unresolved until exact identity, lifecycle and governance prerequisites exist.
- A future storage design must preserve all three records and their references append-only.
- Replay proves deterministic interpretation of the supplied immutable observations, not provider truth or persistence.

## Alternatives considered

- One mutable event result: rejected because it loses provenance and correction history.
- Provider-majority or newest-report wins: rejected because neither establishes authority.
- Binary winner/loser only: rejected because it cannot faithfully model draws, no contests, voids or multi-participant sports.
- Emit sportsbook settlement instructions now: rejected because payout rules and bankroll mutation are outside the factual domain.
