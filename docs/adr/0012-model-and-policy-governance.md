# ADR-0012: Immutable model and policy governance

Status: accepted for intelligence architecture (2026-08-28)

## Context

Reproducibility requires more than a model filename. Data, code, features, calibration, de-vig, freshness, eligibility, staking and settlement policies all change the output. Silent promotion or mutation prevents audit and safe rollback.

## Decision

Version and hash datasets, input manifests, feature definitions, model artifacts, code/configuration and every material decision policy. Use candidate, shadow, approved and retired lifecycle states with named owner/reviewer, scoped model card, evaluation evidence, limitations, promotion event, monitoring thresholds and rollback criteria. Artifacts are immutable after approval. Threshold breach, replay mismatch, provenance loss, incompatible schema/rules or source-right withdrawal suspends output to a prior approved version or no forecast.

## Consequences

- Promotion is a reviewed routing change; models and policies never self-promote.
- Historic recommendations remain reproducible after retirement.
- Governance overhead is accepted in exchange for accountability, monitoring and fail-closed rollback.
- Human approval does not replace quantitative testing; both are required.

## Alternatives considered

- Mutable “current model” configuration: rejected because it erases evidence and makes replay ambiguous.
- Automatic champion/challenger promotion: rejected until governance and safety evidence justify a separately reviewed mechanism.

## Primary references

- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- [Australian Government guidance for AI adoption](https://www.ai.gov.au/staying-safe-and-responsible/essential-ai-practices/guidance-ai-adoption-implementation-guidance)
