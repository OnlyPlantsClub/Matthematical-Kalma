# Authenticated intelligence persistence

Status: TASK-22 feature-branch implementation awaiting independent read-only review and integration.

## Boundary and public contracts

This slice persists only project-owned synthetic fixtures and explicitly authorised, user-authored manual fixtures. It adds no provider, acquisition, network, credentials, scheduling, betting records, UI, binding or deployment change. A manual ownership attestation is not permission to copy bookmaker or other third-party datasets.

`canonical-json.ts` exports the bounded `rfc8785-jcs/1` canonicalizer and stable typed failures. It first snapshots data-only JSON through the hostile-input inspector, rejecting accessors, sparse arrays, unsafe prototypes, symbols, unsupported values, cycles and aliases. It rejects lone Unicode surrogates, sorts object properties by ECMAScript UTF-16 code-unit order, uses ECMAScript JSON number serialization as required by RFC 8785, and emits UTF-8. Domain decimal values remain strings. The canonical representation is capped at 65,536 bytes; record payloads are capped at 49,152 bytes.

`authenticated-record.ts` exports issuance and verification for `mk-intelligence-record-jcs/1` / `authenticated-intelligence-record/1`. Identifiers, versions, timestamps and parent counts are bounded before canonical allocation. Timestamps are strict UTC milliseconds. Parent references are unique and lexicographically ordered. Unknown, absent and contradictory fields fail closed.

## Authentication framing and keys

The content hash is lowercase `sha256:` plus SHA-256 of the exact canonical payload bytes. HMAC input is:

```text
UTF8("MKALMA\0INTELLIGENCE_RECORD\0HMAC_SHA256\0v1\0")
|| uint32be(header_length) || canonical_header_utf8
|| uint32be(payload_length) || canonical_payload_utf8
```

The tag is lowercase `hmac-sha256:` hexadecimal. Header canonicalization binds record/type identity, all schema and contract versions, environment, stream, ordered parents/correction, issue and validation times, issuer/key, rights/retention disposition, legal-hold value and replay mode. Hash and tag exclude themselves. Verification uses a length-insensitive constant-work comparator for functional equality; Web Crypto performs HMAC-SHA-256 in Workers and Node.

Signing and verification key providers are separate interfaces. Lookup is explicitly scoped by environment, key ID and time. Exactly one active key per environment is reinforced by a partial D1 index; verify-only keys can validate historical records. Unknown, unavailable, revoked, cross-environment or out-of-period keys fail closed. D1 stores metadata only. Test key material is labelled non-production and no production key or arbitrary process-global lookup exists. A future composition root may adapt Cloudflare secret bindings without changing domain code.

## Rights and retention

`intelligence-retention/1` accepts only `synthetic_project_owned` and `manual_user_owned`. A schedule binds permitted record types, owner/source class, basis, maximum duration or approved project-synthetic indefinite basis, raw and derivative policy, replay, backup/export, exit/deletion, and legal-hold handling. Manual fixtures require an explicit authorization evidence reference and a maximum of 730 days; applications must choose a shorter maximum whenever another applicable rule requires it. Provider-derived or ambiguous sources fail closed.

Deletion planning is distinct from normal append operations. `ExternalDeletionLedger` deliberately sits outside D1/restorable application state. `PostRestoreReconciliationPort` must block service until restored records are checked against that ledger. Backup expiry is explicit. A contractual deletion is not an ordinary reversible rollback.

## D1 schema and append transaction

Migration `0002_authenticated_intelligence.sql` advances `platform_schema_metadata` from 1 to 2 and adds rights schedules, non-secret key metadata, authenticated records, parent edges, stream heads, retention dispositions, quarantine records and append-only audit events. Foreign keys scope identities by environment. Unique constraints cover record IDs, idempotency keys, content identity, parent ordinals and the first-parent successor. Checks bound known enums and stored canonical text. There is intentionally no trigger preventing governed future deletion.

`D1IntelligenceRecordRepository.append()` pre-reads an idempotency key: an exact authenticated duplicate returns the existing identity without another audit event; changed content conflicts. One D1 `batch()` writes record, parent edges, head, retention and audit. Cloudflare documents `batch()` statements as sequential and transactional, rolling the sequence back on failure. A head guard and unique successor constraint reject missing old heads and forks inside the transaction. This implementation does not claim general serializable isolation. A concurrent exact-idempotency race can surface as a stable duplicate failure and be retried to obtain the idempotent result.

The first ordered parent is the prior current head; all other parents are authenticated dependencies. Corrections must include their target as that prior head in this initial linear-stream contract. Old valid records cannot become current because reads require the stored stream head to equal the requested record.

## Governed read and rehydration

The read path verifies strict shape, environment, canonical payload hash, key status/period and HMAC; then checks the external deletion ledger, versioned rights schedule and current retention disposition, every parent, and current stream head. Only `market_observation` is currently rehydrated: its payload is passed through `normalizeMarketObservation`, which snapshots and validates it and returns a newly allocated, recursively frozen runtime value. Persisted objects and JSON clones never become authority directly. Canonical result observations return `unsupported_record_type` until their resolver-issued identity evidence can be reconstructed honestly.

Every failure produces a bounded quarantine plan containing only environment, optional opaque record ID, stable reason, failure code/path and time. Payload, authentication tag and key material are excluded. History is never auto-repaired. Successful audit output is similarly minimal.

## Threat model and limitations

The MAC authenticates project issuance by an environment key holder; it does not establish truth, ownership, provider permission or freshness. Compromise of an active key permits forged records in that environment. D1 and SHA-256 alone provide no issuance authority. Availability, rollback of the whole database, external-ledger durability, operational legal-hold authorization and secret rotation remain composition/operations concerns. The repository depends on D1 transaction and constraint behavior and supports a linear current-head stream, not an arbitrary merge DAG. Canonicalization deliberately inherits RFC 8785/ECMAScript binary64 number semantics; domain contracts should continue using canonical decimal strings.

## Local validation

Use Node 22.13.0, then run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm worker:types:check`, `pnpm migrations:validate`, `pnpm security:secrets`, and `git diff --check`. Apply migrations only to a disposable local database with `wrangler d1 migrations apply DB --local --persist-to <temporary-directory>`, then run `PRAGMA foreign_key_check` and verify schema contract version 2. No remote migration is part of TASK-22.
