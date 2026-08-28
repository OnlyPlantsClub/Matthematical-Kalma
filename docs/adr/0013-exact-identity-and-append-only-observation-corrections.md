# ADR-0013: Exact identity resolution and append-only observation corrections

Status: accepted for the first provider-neutral identity slice (2026-08-28)

## Context

Provider keys, names, event times and corrected payloads can disagree. Guessing a canonical entity or treating every changed payload as a correction would corrupt lineage. The existing architecture requires quarantine, exact parents, versioned policies and append-only facts but did not define the first executable policy.

## Decision

Use entity-tagged opaque caller-owned canonical IDs and a bounded effective-dated alias-set state machine. Resolution confirms stored resolved, unresolved, ambiguous, quarantined or superseded state against exact evidence; it never derives preference from input order. Supersession uses a distinct historical mapping field and a validated non-overlapping, target-complete, acyclic chain.

Classify observations from their source-envelope parent and explicit typed sport/competition/event/market/ordered-outcome identity scope. Corrections require an explicit existing parent and append rather than mutate. Equal hashes with any exact-fact tuple disagreement conflict. Validate the complete existing graph for missing parents, cycles, forks, cross-scope links, contradictory successors and depth before classification.

When comparable integer source sequences differ, they order facts; otherwise observation time, receipt time and opaque reference are deterministic tie-breakers. The exported comparator validates untrusted facts first. Supplied retained bytes are verified with Web Crypto SHA-256 under a 1 MiB limit; UTF-8 strings use a preflight count and one encoding, byte views one defensive copy. Missing bytes are `not_verifiable`. Provider trust, canonical payload production, retention, locator durability and production workflow remain unresolved.

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
