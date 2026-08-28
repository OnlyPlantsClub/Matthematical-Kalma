# Authenticated intelligence persistence

Status: TASK-22 feature-branch implementation awaiting independent read-only review and integration.

## Boundary and public contracts

This slice persists only project-owned synthetic fixtures and explicitly authorised, user-authored manual fixtures. It adds no provider, acquisition, network, credentials, scheduling, betting records, UI, binding or deployment change. A manual ownership attestation is not permission to copy bookmaker or other third-party datasets.

`canonical-json.ts` exports the bounded `rfc8785-jcs/1` canonicalizer and stable typed failures. It first snapshots data-only JSON through the hostile-input inspector, rejecting accessors, sparse arrays, unsafe prototypes, symbols, unsupported values, cycles and aliases. It rejects lone Unicode surrogates, sorts object properties by ECMAScript UTF-16 code-unit order, uses ECMAScript JSON number serialization as required by RFC 8785, and emits UTF-8. Domain decimal values remain strings. The canonical representation is capped at 65,536 bytes; record payloads are capped at 49,152 bytes.

`authenticated-record.ts` exports issuance and verification for `mk-intelligence-record-jcs/1` / `authenticated-intelligence-record/1`. Issuance first snapshots hostile input, selects the exact record adapter, runs the current domain validator, verifies the complete normalized provenance against the rights schedule, and authenticates the newly validated canonical representation rather than caller bytes. Only market observations have an honest adapter; other types fail closed. Identifiers, versions, timestamps and parent counts are bounded before canonical allocation.

Synthetic provenance requires `project-synthetic-provenance/1`, an internal `synthetic-` or `project:` source, a `project:` provider namespace, project manual retrieval, the exact `rights:<scheduleId>` terms reference and full-payload replay. Commercial/provider namespaces and licensed API semantics are rejected. Manual provenance requires `user-owned-manual-provenance/1`, `manual-user-` and `user-owned:` namespaces, the exact schedule/evidence binding, and a module-issued `TrustedManualProvenanceDecision`. File import additionally requires import authorization. That decision is an explicit trusted application-composition boundary, not cryptographic proof of human ownership; a compromised composition root can lie, and this limitation is not presented as source truth.

## Authentication framing and keys

The content hash is lowercase `sha256:` plus SHA-256 of the exact canonical payload bytes. HMAC input is:

```text
UTF8("MKALMA\0INTELLIGENCE_RECORD\0HMAC_SHA256\0v1\0")
|| uint32be(header_length) || canonical_header_utf8
|| uint32be(payload_length) || canonical_payload_utf8
```

The tag is lowercase `hmac-sha256:` hexadecimal. Header canonicalization binds record/type identity, all schema and contract versions, environment, stream, ordered parents/correction, issue and validation times, issuer/key, rights/retention disposition, legal-hold value and replay mode. Hash and tag exclude themselves. Verification uses a length-insensitive constant-work comparator for functional equality; Web Crypto performs HMAC-SHA-256 in Workers and Node.

Signing and verification key providers are separate interfaces. Policy checks require exact metadata algorithm, environment, key ID/status/period, secret `CryptoKey`, HMAC algorithm, SHA-256 hash and the appropriate `sign` or `verify` usage. Verify-only keys cannot sign. Provider and Web Crypto exceptions become frozen sanitized failures. Exactly one active key per environment is reinforced by a partial D1 index; key metadata is immutable history and rotation inserts a new key ID.

## Rights and retention

`intelligence-retention/1` accepts only `synthetic_project_owned` and `manual_user_owned`. Manual schedules bind both a project deletion deadline and a hard source-rights deadline. The effective deadline is the earlier non-overridable deadline. A legal hold comes only from the external `LegalHoldAuthority`, is immutable and scoped by environment/record/schedule/time, and may pause project-controlled deletion only when the schedule permits. It never overrides the hard source deadline, provider exit, prohibited payload policy or deleted status. A boolean D1 field is not legal authority.

Deletion planning is distinct from normal append operations. `ExternalDeletionLedger` deliberately sits outside D1/restorable application state. `PostRestoreReconciliationPort` must block service until restored records are checked against that ledger. Backup expiry is explicit. A contractual deletion is not an ordinary reversible rollback.

## D1 schema and append transaction

Migration `0002_authenticated_intelligence.sql` advances the schema contract to 2. Records are staged, exact parent edges are inserted, and an immutable commit row can be created only when declared parent count and ordered head parent are complete. Only committed records may become heads. Composite foreign keys bind heads and both sides of every edge to the exact environment, stream and record type; triggers bind root/head transitions and prevent post-commit edges.

Authenticated records, edges, commits, rights schedules, key metadata, audit events and retention events reject ordinary updates. Protected deletes require a short-lived immutable `governed_deletion_authorizations` row whose authority class points to an external contractual-deletion decision. This preserves a future governed deletion path without allowing ordinary SQL to erase history. D1 is not the authoritative deletion ledger; authorization must be reconciled with the external ledger before use.

`D1IntelligenceRecordRepository.append()` pre-reads idempotency, then one D1 batch writes stage, edges, commit, guarded head, retention event and audit event. A failed statement rolls the sequence back. The implementation claims only D1's documented batch transaction semantics, not general serializable isolation.

The first ordered parent is the prior current head; all other parents are authenticated dependencies. Corrections must include their target as that prior head in this initial linear-stream contract. Old valid records cannot become current because reads require the stored stream head to equal the requested record.

## Governed read and rehydration

`readAuthoritativeSnapshot()` uses one bounded recursive-CTE statement to return the selected committed record, exact head/revision, rights definition, latest retention event, key metadata, exact edges and up to 16 ancestors from one D1 statement snapshot. The caller may require the derived snapshot ID (`head:<id>:revision:<n>`) to detect bookmark/rollback mismatch. Deployment-level whole-database rollback still requires the external deletion ledger and restore reconciliation; D1 content alone cannot detect a perfectly restored old database.

Rehydration validates snapshot structure, reads external deletion states once, caches each key-provider decision once, and then strictly verifies rights, deadlines, key metadata, envelope/hash/MAC, scope, edges and current market-domain validity for every ancestor. Only after the complete graph passes does the selected record produce a newly validated runtime value. Parent failures map to `parent_invalid`, not generic malformed input.

Quarantine distinguishes hash/MAC/environment/key-period/key-status, rights/deletion, missing or invalid parents, rollback, version/type, domain, port and malformed-envelope failures. Metadata remains limited to stable code/path; payload, exception text, SQL, tags and key material are excluded.

## Threat model and limitations

The MAC authenticates project issuance by an environment key holder; it does not establish truth, ownership, provider permission or freshness. Compromise of an active key permits forged records in that environment. D1 and SHA-256 alone provide no issuance authority. Availability, rollback of the whole database, external-ledger durability, operational legal-hold authorization and secret rotation remain composition/operations concerns. The repository depends on D1 transaction and constraint behavior and supports a linear current-head stream, not an arbitrary merge DAG. Canonicalization deliberately inherits RFC 8785/ECMAScript binary64 number semantics; domain contracts should continue using canonical decimal strings.

## Local validation

Use Node 22.13.0, then run `pnpm test`, `pnpm test:intelligence:d1`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm worker:types:check`, `pnpm migrations:validate`, `pnpm security:secrets`, and `git diff --check`. The real-D1 probe applies fresh migrations and exercises direct mutation, malformed finalization/head, edge, protected deletion and governed-deletion cases. No remote migration is part of TASK-22.
