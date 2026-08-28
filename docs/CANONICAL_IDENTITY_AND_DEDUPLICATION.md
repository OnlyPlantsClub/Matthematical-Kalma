# Canonical identity, alias quarantine and observation deduplication

Status: implemented as a pure, provider-neutral in-memory domain slice (2026-08-28)

The implementation is split across [`canonical-identity.ts`](../src/domain/intelligence/canonical-identity.ts), [`observation-deduplication.ts`](../src/domain/intelligence/observation-deduplication.ts), [`payload-hash.ts`](../src/domain/intelligence/payload-hash.ts), and the shared bounded validation helpers in [`domain-validation.ts`](../src/domain/intelligence/domain-validation.ts). It adds no provider, storage, route, UI, migration or deployment behaviour.

## Canonical identity model

`canonical-identity-v2` represents sport, competition, participant and event identities. IDs use a versioned runtime tag—`sport:`, `competition:`, `participant:`, `event:` or `role:`—followed by an opaque identifier of no implied human meaning. The tag prevents cross-entity substitution; the suffix is never generated from a name. Competition requires a typed sport parent; participant requires a typed sport and may declare a typed competition; event requires typed sport and competition parents, a canonical UTC-millisecond start, and 2–16 unique participant/role-ID records. Every identity and role carries a version and evidence.

Display names are deliberately absent from identity authority. They may appear in separately retained evidence, but editing a display name cannot alter a canonical ID. Event time is identity context in this bounded contract; a changed source time therefore conflicts or requires a newly reviewed version/mapping rather than silently moving an event.

## Alias lifecycle and quarantine

`provider-alias-v2` has an explicit state machine. `resolved` requires only its active `canonicalId`; `unresolved` forbids a winner; `ambiguous` requires at least two sorted viable candidate references and forbids a winner; `quarantined` requires evidence and a reason and forbids a winner; `superseded` forbids active `canonicalId` and requires `historicalCanonicalId`, successor reference and reason. Stored state and resolution result must agree or `alias_state_contradiction` fails closed.

Resolution uses policy `exact-evidence-only-alias-set` version `2` and a validated `provider-alias-set-v1`:

- unique references and exact scope agreement are mandatory across at most 16 aliases;
- effective intervals may touch at `[from,to)` boundaries but never overlap;
- supersession targets must exist, begin exactly at the predecessor end, and form no self-link, cycle or chain beyond 16;
- resolved/unresolved/ambiguous stored state is confirmed against the exact candidate set; candidate input order never implies preference;
- duplicate candidates, mismatched entity/source/provider/key, or conflicting sport/competition/event-time context fail closed;
- effective start is inclusive and effective end is exclusive.

All decisions retain the alias, policy, reason, candidate references and combined evidence references. Nothing mutates or persists an alias.

## Deduplication and corrections

`observation-fact-v2` includes `observation-identity-scope-v1`: typed sport, competition and event IDs; market ID; a unique strictly lexicographically ordered outcome-ID set; and identity-contract version. Optional source sequence and `correctsObservationRef` remain provenance.

Policy `append-only-observation-deduplication` version `2` classifies an incoming fact as:

- `new`: no exact duplicate and no explicit correction parent;
- `exact_duplicate`: the same reference/fact, or equal payload and observation/identity metadata under a different ingestion reference;
- `correction`: a different payload explicitly names an existing unsuperseded parent in the same source/provider/event/market/identity scope;
- `conflict`: a reference is reused, an equal hash has conflicting metadata, a correction crosses scope, or a correction does not change payload;
- `already_superseded`: the incoming fact or its requested parent already has an appended correction.

The exact-fact identity tuple is source-envelope reference, source/provider, complete structured identity scope, payload hash, observation/receipt times, optional sequence and optional correction parent; observation reference may differ on an idempotent re-import. Any tuple disagreement with an equal hash is a conflict. The classifier validates the whole supplied graph before considering the incoming fact: duplicate references, missing parents, cycles, forks/multiple successors, cross-scope parents, unchanged-payload corrections and chains beyond 16 fail even when the incoming fact is unrelated.

When both source sequences are canonical non-negative integers and differ, sequence orders the facts. Otherwise canonical `observedAt`, then `receivedAt`, then opaque observation reference provides a total deterministic order. A sequence/time disagreement is recorded rather than hidden. This policy does not claim which provider fact is substantively correct.

## Payload-hash boundary

`retained-payload-sha256` version `1` verifies the existing lowercase `sha256:<64 hex>` format using platform Web Crypto SHA-256. Raw `Uint8Array` (including Node Buffer) is preferred. Strings are explicitly UTF-8 encoded. Objects are not accepted and no canonical JSON format is invented.

The maximum is 1,048,576 bytes (1 MiB). Strings receive an allocation-free UTF-8 byte-count pass (including surrogate handling), then exactly one encoding. Byte views are validated before one defensive copy so async caller mutation cannot alter the digest. The validated buffer is passed directly to Web Crypto; any additional copying inside the platform is outside application control. Empty, multibyte exact-limit and subview payloads are valid; one byte over is rejected before encoding/copying/hashing.

When bytes are absent, every replay mode returns `not_verifiable`; in particular, hash-only and non-fully-replayable modes are never reported as successful verification. A supplied byte/string payload can be verified even for hash-only mode. The result states expected/actual hashes, byte length, input kind, replay mode and policy. It never accepts or returns credentials.

## Runtime safety, limits and immutability

All JSON-compatible contracts first pass `untrusted-json-inspection-v2`, inheriting its protection against getters, proxies, exotic prototypes, cycles, repeated references, sparse arrays, unknown/credential fields, depth and aggregate budgets. Domain IDs are at most 128 characters; references 256; versions 128; reasons 512; evidence, candidate, event-participant, existing-fact and correction-chain counts are each bounded at 16. Canonical instants are the existing 24-character UTC millisecond form.

Successes, decisions, errors, metadata, arrays, parents and policies are recursively frozen. Functions use only caller-supplied time and facts; there is no system clock, randomness or network access. These are application-level in-memory guarantees, not database immutability claims.

## Relationship and deferrals

Normalized market observations still own price/state/freshness validation and deterministic odds owns arithmetic. This slice supplies the missing catalogue mapping, duplicate/correction decision and optional upstream-byte integrity check before or around that normalization flow. It does not change the existing `market-observation-v1` or odds APIs.

Deferred under TASK-04: provider selection and live acquisition, canonical display-name/history models, sport-specific event revision rules beyond exact context, results and settlement ingestion, persistence/unique constraints/transactions, long-chain archival traversal, retention/licensing decisions, APIs and operational reconciliation.
