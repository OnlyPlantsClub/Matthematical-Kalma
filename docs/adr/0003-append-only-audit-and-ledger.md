# ADR-0003: Append-only audit and ledger facts

- Status: Accepted
- Date: 2026-08-27

## Context

The product must avoid hindsight bias, reconcile bankroll changes, reproduce recommendations and correct results/settlements without erasing what users saw.

## Decision

Source observations, sealed inputs, completed runs, forecasts, published recommendations, ledger postings, settlements, corrections and audit events are immutable. A correction appends invalidation, reversal or superseding facts with actor/source, reason and time. Bankroll balance derives from balanced transaction groups and is never an editable field.

## Consequences

- Recommendations cannot be silently rewritten.
- Settlement correction reverses the original before replacement.
- Read models/metrics are rebuildable.
- Privacy deletion explicitly erases or anonymises personal facts while retaining only non-identifying completion evidence where necessary.
