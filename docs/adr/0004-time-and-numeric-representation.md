# ADR-0004: Time and numeric representation

- Status: Accepted
- Date: 2026-08-27

## Context

Binary floating point, ambiguous local time and ad hoc “latest” prices would undermine money reconciliation and historical replay.

## Decision

Store money as signed ISO-currency minor units, decimal odds at 1e-6 scale, and probability/rates at 1e-9. APIs expose authoritative decimal strings plus scale. Store instants in UTC ISO-8601 milliseconds and IANA zones separately. Keep observation, receipt, effective, start, publication and settlement times distinct. Version freshness, rounding, closing-price and pre-start policies.

## Consequences

- Calculations use exact decimal/integer arithmetic and deterministic rounding.
- UI rounding is never authority.
- Offset-free source times are rejected/quarantined.
- Late or start-time-corrected facts remain auditable but cannot retroactively qualify.
