# ADR-0009: Sport-specific models behind a common plug-in contract

Status: accepted for intelligence architecture (2026-08-28)

## Context

AFL teams/seasons, MMA bouts and boxing contests have different identities, feature timing, rules, sparsity, outcomes and settlement semantics. A universal feature/model abstraction would hide rather than solve these differences.

## Decision

Each sport implements a versioned plug-in covering canonical event/result semantics, supported markets, point-in-time feature assembly, training/inference, evaluation plan and settlement profile. Core modules own the common forecast/provenance contract, eligibility, paper risk and governance. AFL, MMA and boxing graduate independently. Future sports pass an explicit admission gate.

## Consequences

- Common tooling and provenance are reusable without sharing inappropriate features or rules.
- A plug-in can abstain when its sport-specific inputs or rules are ambiguous.
- Some duplication is accepted to preserve semantic correctness.
- Model success in one sport provides no approval evidence for another.

## Alternatives considered

- One universal sports model: rejected for the first phase because data and rules are not shown to be exchangeable.
- Separate end-to-end services per sport: rejected as premature; a modular-monolith plug-in boundary is sufficient.
