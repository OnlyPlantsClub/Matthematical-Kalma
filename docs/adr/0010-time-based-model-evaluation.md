# ADR-0010: Point-in-time, baseline-relative model evaluation

Status: accepted for intelligence architecture (2026-08-28)

## Context

Sports data changes over time, and odds/results published after a forecast can leak target information. Random cross-validation and realised profit alone can overstate usefulness. Probability quality requires calibration and proper scoring as well as discrimination.

## Decision

Train and evaluate from sealed as-of manifests with rolling-origin/walk-forward splits, appropriate purge/embargo, training-only transforms/tuning/calibration, and a held-out final period. Compare every model to simple base-rate/rating and same-horizon de-vigged market baselines. Report Brier and log loss, calibration/reliability, uncertainty coverage, cohort stability, sample size and CLV coverage. Include passes and all eligible forecasts. Promotion thresholds are predeclared and approval is versioned.

## Consequences

- Dataset records require `knownAt` semantics and reproducible split manifests.
- Evaluation is slower and effective sample sizes may be smaller, but estimates better match intended use.
- Insufficient evidence results in shadow/no-forecast rather than relaxed gates.
- Market-informed experiments must be labelled separately from independent forecasts.

## Alternatives considered

- Random train/test split: rejected because it ignores chronology and related-event leakage.
- ROI-only approval: rejected because selection, price, sizing and variance confound probability quality.

## Primary references

- [Brier (1950), probability forecast verification](https://doi.org/10.1175/1520-0493%281950%29078%3C0001%3AVOFEIT%3E2.0.CO%3B2)
- [Gneiting, Balabdaoui and Raftery (2007), calibration and sharpness](https://doi.org/10.1111/j.1467-9868.2007.00587.x)
