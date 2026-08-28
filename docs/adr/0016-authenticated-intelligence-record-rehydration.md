# ADR-0016: Authenticated durable intelligence records and rehydration

Status: accepted, independently reviewed and integrated; implementation not started (2026-08-29)

## Context

Module-private `WeakSet` capabilities prove issuance only within one live module instance. Serialization, process or Worker-isolate restart, hot reload, separate bundles and module duplication lose that authority. D1 rows and unkeyed hashes do not prove that a trusted project runtime issued a structurally valid record.

Persistence must preserve tamper evidence and lineage without allowing stored objects to bypass current domain validation.

## Decision

Adopt `mk-intelligence-record-jcs/1`, a hybrid of RFC 8785 canonical JSON encoded as UTF-8; SHA-256 canonical payload identity; HMAC-SHA-256 over a domain-separated, length-delimited canonical header and payload; environment-separated keys delivered only through Cloudflare secret bindings; append-only transactional record/audit writes; and complete current-domain revalidation on every rehydration.

Use domain separator `MKALMA\0INTELLIGENCE_RECORD\0HMAC_SHA256\0v1\0`. Bind record type/identity, schema and contract versions, environment, ordered parents/correction, issuance/validation timestamps, issuer and key ID into the authentication input.

A persisted record never regains runtime authority directly. After rights, envelope, hash, HMAC, graph, ordering and current-head checks succeed, the current canonical validator validates the complete required snapshot and issues a new module-private capability. Any failure quarantines and fails closed.

Maintain one active signing key per environment and verification-only prior keys through a non-secret key registry. Rotation adds a key and does not rewrite history. Never store key material in GitHub, Notion, D1, logs or decision documents.

## Consequences

- SHA-256 supports deterministic identity/deduplication but is not treated as authenticity.
- HMAC proves project issuance to holders of the symmetric key; it does not prove provider truth, distinguish trusted signers sharing a key or prevent rollback of an otherwise valid old record.
- Parent/correction references, current-head constraints, rights/deletion state and audit events remain necessary for replay and rollback defence.
- Schema migrations require version-aware readers and explicit successor/backfill records; unsupported records quarantine rather than silently coerce.
- Key compromise requires signing suspension, scoped quarantine, key rotation and incident recovery.
- Asymmetric signatures or isolated signing/KMS are the future hardening path for multiple writers, public verification or stronger signer separation.

## Alternatives considered

- Structural revalidation alone: rejected as the sole trust boundary because valid-looking rows can be forged.
- SHA-256 plus revalidation: rejected as the sole trust boundary because an attacker who can replace a row can replace its hash.
- D1 trust alone: rejected because storage authorization is not record authentication and restores can replay old state.
- Digital signatures now: deferred because symmetric authentication is proportionate for one private Worker trust domain; signatures remain the hardening path.
- Rehydrate a persisted object directly into the private registry: rejected because it defeats the capability boundary.
