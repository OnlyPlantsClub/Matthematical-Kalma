# Canonical identity, alias quarantine and observation deduplication

Status: implemented as a pure, provider-neutral in-memory domain slice (2026-08-28)

The implementation is split across [`canonical-identity.ts`](../src/domain/intelligence/canonical-identity.ts), [`observation-deduplication.ts`](../src/domain/intelligence/observation-deduplication.ts), [`payload-hash.ts`](../src/domain/intelligence/payload-hash.ts), and the shared bounded validation helpers in [`domain-validation.ts`](../src/domain/intelligence/domain-validation.ts). It adds no provider, storage, route, UI, migration or deployment behaviour.

## Canonical identity model

`canonical-identity-v1` represents sport, competition, participant and event identities. Canonical IDs are validated opaque identifiers supplied by the catalogue owner. They are never generated from names. Competition requires a sport parent; participant requires a sport and may declare a competition; event requires sport, competition, a canonical UTC-millisecond start, and 2–16 unique participant/role records. Home, away and draw are singleton roles; competitor may repeat. Every identity and role carries a version and one or more evidence references.

Display names are deliberately absent from identity authority. They may appear in separately retained evidence, but editing a display name cannot alter a canonical ID. Event time is identity context in this bounded contract; a changed source time therefore conflicts or requires a newly reviewed version/mapping rather than silently moving an event.

## Alias lifecycle and quarantine

`provider-alias-v1` binds an entity type, source ID, provider reference and external key to an effective `[from, to)` interval, version and evidence. Its states are `resolved`, `unresolved`, `ambiguous`, `quarantined` and `superseded`. A resolved stored alias requires a canonical ID. A superseded alias preserves its previous canonical ID, successor alias reference and bounded reason.

Resolution uses policy `exact-evidence-only` version `1`:

- zero exact candidates is unresolved; display-name similarity is retained as evidence but cannot resolve;
- one exact source-key candidate resolves;
- multiple exact candidates return a quarantined result with sorted candidate references and no canonical winner;
- duplicate candidates, mismatched entity/source/provider/key, or conflicting sport/competition/event-time context fail closed;
- effective start is inclusive and effective end is exclusive.

All decisions retain the alias, policy, reason, candidate references and combined evidence references. Nothing mutates or persists an alias.

## Deduplication and corrections

`observation-fact-v1` is an immutable reference to a source envelope, canonical source/provider/event/market/identity version, upstream payload hash and observation/receipt times. Optional source sequence and `correctsObservationRef` are provenance, not update instructions.

Policy `append-only-observation-deduplication` version `1` classifies an incoming fact as:

- `new`: no exact duplicate and no explicit correction parent;
- `exact_duplicate`: the same reference/fact, or equal payload and observation/identity metadata under a different ingestion reference;
- `correction`: a different payload explicitly names an existing unsuperseded parent in the same source/provider/event/market/identity scope;
- `conflict`: a reference is reused, an equal hash has conflicting metadata, a correction crosses scope, or a correction does not change payload;
- `already_superseded`: the incoming fact or its requested parent already has an appended correction.

The classifier validates the whole supplied in-memory graph. Missing parents and cycles fail with typed errors. Original facts are never changed or deleted. A valid correction decision includes its immutable parent, full chain, source-envelope evidence and ordering decision.

When both source sequences are canonical non-negative integers and differ, sequence orders the facts. Otherwise canonical `observedAt`, then `receivedAt`, then opaque observation reference provides a total deterministic order. A sequence/time disagreement is recorded rather than hidden. This policy does not claim which provider fact is substantively correct.

## Payload-hash boundary

`retained-payload-sha256` version `1` verifies the existing lowercase `sha256:<64 hex>` format using platform Web Crypto SHA-256. Raw `Uint8Array` (including Node Buffer) is preferred. Strings are explicitly UTF-8 encoded. Objects are not accepted and no canonical JSON format is invented.

The maximum is 1,048,576 bytes (1 MiB). Byte length is checked before copying or hashing. Unsupported prototypes, hostile/detached views and malformed payloads return frozen errors. Expected and computed digest bytes are compared without digest-dependent early exit where practical. Empty and exact-limit payloads are valid; one byte over is rejected before hashing.

When bytes are absent, every replay mode returns `not_verifiable`; in particular, hash-only and non-fully-replayable modes are never reported as successful verification. A supplied byte/string payload can be verified even for hash-only mode. The result states expected/actual hashes, byte length, input kind, replay mode and policy. It never accepts or returns credentials.

## Runtime safety, limits and immutability

All JSON-compatible contracts first pass `untrusted-json-inspection-v2`, inheriting its protection against getters, proxies, exotic prototypes, cycles, repeated references, sparse arrays, unknown/credential fields, depth and aggregate budgets. Domain IDs are at most 128 characters; references 256; versions 128; reasons 512; evidence, candidate, event-participant, existing-fact and correction-chain counts are each bounded at 16. Canonical instants are the existing 24-character UTC millisecond form.

Successes, decisions, errors, metadata, arrays, parents and policies are recursively frozen. Functions use only caller-supplied time and facts; there is no system clock, randomness or network access. These are application-level in-memory guarantees, not database immutability claims.

## Relationship and deferrals

Normalized market observations still own price/state/freshness validation and deterministic odds owns arithmetic. This slice supplies the missing catalogue mapping, duplicate/correction decision and optional upstream-byte integrity check before or around that normalization flow. It does not change the existing `market-observation-v1` or odds APIs.

Deferred under TASK-04: provider selection and live acquisition, canonical display-name/history models, sport-specific event revision rules beyond exact context, results and settlement ingestion, persistence/unique constraints/transactions, long-chain archival traversal, retention/licensing decisions, APIs and operational reconciliation.
