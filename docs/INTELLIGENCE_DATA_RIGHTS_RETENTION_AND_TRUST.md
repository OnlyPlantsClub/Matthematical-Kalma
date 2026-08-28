# Intelligence data rights, retention and durable trust

Status: approved architecture decisions; documentation only (2026-08-29)

This document records the approved outcome of TASK-17. It authorises no provider account, subscription, purchase, credential, live ingestion, scraping, persistence implementation, deployment or infrastructure change. It is not legal advice and does not conclude that any provider use is licensed.

The controlling ADRs are [ADR-0015](adr/0015-provider-rights-and-intelligence-retention.md) and [ADR-0016](adr/0016-authenticated-intelligence-record-rehydration.md).

## Approved product and source boundary

- The MVP is private to two named adults aged 18 or older. It provides analysis and paper betting only.
- It does not execute wagers, hold bookmaker credentials, handle deposits or withdrawals, provide affiliate links or public registration, or describe any outcome as guaranteed or risk-free.
- Synthetic fixtures and evidence-backed manual fixtures are the only approved source modes now.
- The Odds API is the first candidate for written rights clarification. Sportradar is the enterprise comparator. Neither provider is selected, subscribed to, purchased or activated.
- Bookmaker consumer websites and accounts are prohibited data sources unless bespoke written permission expressly covers the intended automated use.
- Live provider ingestion remains blocked until written rights cover acquisition, display, internal analysis, transformation, storage, retention, derived/model use, audit, deletion, termination and backup treatment.
- Public access, paid access, affiliates, wager execution, bookmaker-account integration or material expansion beyond the private MVP requires Australian and Western Australian legal review. No legal service is purchased or engaged by this decision.

## Rights schedule and fail-closed disposition

Every provider-derived record must identify a versioned rights schedule and one disposition: `retain_per_schedule`, `delete_at`, `delete_on_termination` or `not_permitted`.

Unknown, missing, expired or ambiguous rights fail closed as `not_permitted`. Technical availability, public visibility, a paid subscription, or a retained hash does not establish a right.

A rights schedule must state, at minimum:

- provider, product, agreement/order-form and terms versions;
- permitted acquisition method, Australian use, property and audience;
- display, internal analytics, transformation and redistribution rights;
- raw payload, cache, normalized-fact, hash, locator and historical retention rights;
- dataset, model-training, derived probability and trained-parameter rights;
- attribution, trademark, user-count, audit and rate-limit obligations;
- deletion deadline, backups, termination and post-termination survival; and
- approval evidence and unresolved questions.

## `intelligence-retention/1`

Retention periods are provisional maximums, never automatic minimums. The applied duration is the shortest of the policy maximum, provider contract or rights schedule, legal/privacy necessity and the period genuinely required for the recorded purpose.

Indefinite retention requires an explicit lawful and contractual basis. Provider termination never automatically permits hashes, normalized facts, derivatives, datasets or model parameters to survive.

| Class | Provisional maximum | Default exit treatment |
| --- | --- | --- |
| Raw provider payload | zero after successful validation; quarantine no more than 7 days when permitted | delete |
| Canonical payload hash | 7 years only when expressly permitted | delete unless survival is explicit |
| Retrieval locator | source term plus 30 days when permitted | delete or invalidate |
| Source envelope | 7 years or shorter rights period | minimize/delete provider-restricted fields |
| Alias and identity evidence | canonical entity life plus 7 years | retain only when licensed |
| Mapping decision | 7 years after last dependent fact | retain project decision; remove restricted evidence |
| Canonical event/participant | while lawful and genuinely required | revalidate or quarantine |
| Market observation | 2 years | delete unless retained use is explicit |
| Result observation, correction and settlement fact | 7 years | retain only to granted extent |
| Derived probability or odds calculation | 3 years | delete unless derivative survival is explicit |
| Model-training dataset | 2 years after model retirement | delete/rebuild unless explicit |
| Trained model parameters | model life plus 7-year governance record | delete/retrain unless survival is explicit |
| Provider/security audit metadata | 7 years, minimized | retain only permitted non-content evidence |
| Quarantine record | 30 days; raw bytes no more than 7 days | resolve or delete |

Corrections append and supersede; they never overwrite. Contractual deletion is distinct from ordinary product deletion and may deliberately remove replay evidence. Audit proof must not retain prohibited samples.

## Shared and user-owned separation

Shared intelligence facts and user-owned private records are separate ownership domains with separate storage, authorization, exports, deletion workflows and audit scopes. User betting and financial records do not enter shared datasets or model training by default.

Future user-owned records must support governed access, export, correction and deletion. Their proposed retention periods must be reconsidered during legal/privacy review. User financial records are excluded from the approved persistence slice.

## Backup and provider exit

- Long-lived exports of provider-derived data are prohibited unless the rights schedule expressly permits them.
- Deletion dispositions must be maintained outside restorable application state.
- Any restore is followed by rights reconciliation and a deletion sweep before service resumes.
- Provider exit stops ingestion first, revokes credentials, inventories every direct and derived class, applies written dispositions, accounts for backups, records minimal audit evidence and revalidates any retained facts.
- Contractual deletion cannot be rolled back. A technical restore does not restore an expired right.

## `mk-intelligence-record-jcs/1`

Durable intelligence records use RFC 8785 JSON Canonicalization Scheme over I-JSON-compatible values and UTF-8; SHA-256 over canonical payload bytes; HMAC-SHA-256 over a domain-separated, length-delimited canonical envelope and payload; environment-separated keys supplied only through Cloudflare secret bindings; strict schema, contract, rights, parent/correction, environment, key and timestamp checks; and full current domain revalidation before runtime use.

The domain separator is `MKALMA\0INTELLIGENCE_RECORD\0HMAC_SHA256\0v1\0`.

The authenticated header binds `recordType`, `recordId`, `schemaVersion`, `contractVersion`, `environmentId`, ordered parent/correction references, `issuedAt`, `validatedAt`, `issuer` and `keyId`. Hash and authentication tag are excluded from their own inputs. Exact byte framing and conformance vectors belong to the implementation contract and must not be improvised.

SHA-256 alone does not authenticate a record. D1 storage alone does not authenticate a record. HMAC authenticates project issuance to a holder of the environment key; it does not prove provider truth or prevent a valid old record from being replayed as current.

## Rehydration

A persisted record never regains a module-private capability directly. Rehydration must:

1. enforce its rights disposition and deletion ledger;
2. strictly parse a supported envelope;
3. verify environment, key, canonical bytes, SHA-256 and HMAC;
4. verify identity, complete parents, correction graph, current-head/rollback constraints and timestamps;
5. run the current approved canonical domain validator over the complete required snapshot; and
6. let that validator issue a new current-runtime capability.

Any failure quarantines the record and prevents authoritative display, forecasting or settlement. The persisted object is never inserted into a private registry. Raw source evidence is required only when the rights schedule and operation require it; a hash alone verifies later-supplied bytes but is not evidence of their content.

## Approved next slice after review

After these documents receive independent documentation and architecture review, a separate implementation may build provider-neutral persistence for synthetic and explicitly user-owned manual fixtures only. Live providers, network ingestion, scraping, subscriptions, user financial records, deployment and infrastructure changes remain excluded.
