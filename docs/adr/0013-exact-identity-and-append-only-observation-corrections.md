# ADR-0013: Exact identity resolution and append-only observation corrections

Status: accepted for the first provider-neutral identity slice (2026-08-28)

## Context

Provider keys, names, event times and corrected payloads can disagree. Guessing a canonical entity or treating every changed payload as a correction would corrupt lineage. The existing architecture requires quarantine, exact parents, versioned policies and append-only facts but did not define the first executable policy.

## Decision

Use opaque caller-owned canonical IDs and effective-dated provider aliases. Version 1 resolves only a single evidence-backed exact source/provider/external-key candidate whose entity and sport/competition/event-time context agrees. Similarity never resolves. Multiple exact candidates quarantine without a winner. Supersession preserves the prior mapping and reason.

Classify observation duplicates/corrections from immutable source-envelope references and canonical SHA-256 hashes. Corrections require an explicit existing parent, append rather than mutate, and remain within one source/provider/event/market/identity version. Equal hashes with conflicting metadata are conflicts; different hashes alone are not corrections. Validate correction graphs for missing parents and cycles.

When comparable integer source sequences differ, they order facts; otherwise observation time, receipt time and opaque reference are deterministic tie-breakers. Sequence/time disagreement is recorded. Verify supplied retained bytes with Web Crypto SHA-256 under a 1 MiB pre-hash limit; strings mean UTF-8 and objects have no canonical serialization. Missing bytes are `not_verifiable`.

## Consequences

- False merges are preferred over false resolution; operations must review quarantined aliases.
- Corrections and supersessions require more immutable facts but preserve forensic replay.
- The 16-entry in-memory graph/evidence limits and 1 MiB payload boundary require future versioning for larger approved workloads.
- Persistence constraints, provider/result ingestion and sport-specific revision policy remain separate decisions.

## Alternatives considered

- Name similarity or first-candidate wins: rejected because it silently creates identity errors.
- Upsert observations by provider key: rejected because it erases what was originally observed.
- Treat every changed hash as a correction: rejected because scope and intent are unproven.
- Canonical JSON hashing: deferred because no cross-provider serialization standard is accepted.
