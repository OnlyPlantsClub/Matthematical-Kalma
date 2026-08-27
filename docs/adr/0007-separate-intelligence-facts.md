# ADR-0007: Separate observed, derived, forecast and decision facts

Status: accepted for intelligence architecture (2026-08-28)

## Context

A quoted implied probability, a de-vigged market baseline, an independent model forecast, a recommendation, a user choice, a paper position and its settlement answer different questions. Collapsing them destroys provenance, permits hindsight edits and makes evaluation circular.

## Decision

Represent observed bookmaker data, deterministic market derivations, model forecasts, policy recommendations, user decisions, paper bets, results and settlements/corrections as separate immutable or append-corrected facts. Every derived fact names exact versioned parents and as-of times. Recommendation replay never follows mutable “latest” records.

## Consequences

- UI/API consumers must label the origin and meaning of each probability/price.
- A user modification cannot rewrite a recommendation; a correction cannot rewrite a forecast or original settlement.
- More identifiers and joins are required, but leakage audits, attribution and forensic replay become possible.
- This refines and is consistent with ADR-0003.

## Alternatives considered

- One mutable “opportunity/bet” aggregate: rejected because it conflates belief, advice, intent, simulation and outcome.
- Copy fields without parent references: rejected because copied values alone do not prove their lineage.
