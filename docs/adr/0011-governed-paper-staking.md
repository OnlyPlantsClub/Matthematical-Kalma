# ADR-0011: Conservative, governed paper staking

Status: accepted for intelligence architecture (2026-08-28)

## Context

Kelly sizing is sensitive to probability error and can create unacceptable concentration. A positive point-estimate EV does not account for uncertainty, correlated positions, aggregate exposure or responsible-use limits.

## Decision

The engine sizes paper positions only. A versioned fractional-Kelly/uncertainty policy proposes a non-negative fraction, then the strictest single-position, event, correlation-group, sport, period, loss/drawdown, cooling-off and bankroll constraint applies. Rounding is conservative. Missing/invalid/stale inputs or failed eligibility yield zero. Start-fraction and cap values remain proposals until paper simulation and safety approval. Portfolio Kelly is deferred until validated joint return scenarios exist.

## Consequences

- Kelly is an input to a risk policy, not a direct recommendation.
- Correlated exposure is conservatively grouped before covariance modelling is trusted.
- Product limits cannot be overridden by a model and every exposure evaluation is reproducible.
- The existing UI helper is not the governed engine implementation.

## Alternatives considered

- Full Kelly: rejected because forecast error and drawdown sensitivity conflict with conservative paper-first goals.
- Flat stakes only: retained as an evaluation baseline but rejected as the sole architecture because it ignores bankroll/exposure context.

## Primary reference

- [Kelly (1956), “A New Interpretation of Information Rate”](https://doi.org/10.1002/j.1538-7305.1956.tb03809.x)
