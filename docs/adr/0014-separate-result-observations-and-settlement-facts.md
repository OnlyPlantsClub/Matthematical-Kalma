# ADR-0014: Separate result observations from settlement facts

Status: proposed; TASK-21 requires independent review and integration (2026-08-28)

## Context

Provider result reports, canonical sporting truth and sportsbook settlement interpretation change for different reasons. Combining them would erase source evidence, make corrections appear mutable and leak payout policy into factual lineage.

## Decision

Adopt separate versioned, immutable source-result, canonical-result and settlement-fact contracts. Canonical results require an exact reviewed event and participant/role set. Corrections append one explicitly linked successor. Settlement facts derive only from official, corrected, abandoned or cancelled canonical observations under a versioned eligibility policy; provisional and unresolved observations fail closed.

Use a participant-level sport-neutral vocabulary and optional placement instead of a binary winner field. Keep draw, no contest, push and void distinct. Treat provider disagreement as conflict unless a future governed policy supplies authority. Require caller-injected evaluation time and exact source/correction lineage.

## Consequences

- Source evidence survives quarantine and later identity resolution.
- Corrections and reversions are replayable without rewriting history.
- Downstream bet settlement can consume facts without result ingestion owning financial rules.
- Some apparently obvious outcomes remain unresolved until exact identity, lifecycle and governance prerequisites exist.
- A future storage design must preserve all three records and their references append-only.

## Alternatives considered

- One mutable event result: rejected because it loses provenance and correction history.
- Provider-majority or newest-report wins: rejected because neither establishes authority.
- Binary winner/loser only: rejected because it cannot faithfully model draws, no contests, voids or multi-participant sports.
- Emit sportsbook settlement instructions now: rejected because payout rules and bankroll mutation are outside the factual domain.
