# ADR-0015: Permission-gated provider rights and intelligence retention

Status: accepted, independently reviewed and integrated; implementation not started (2026-08-29)

## Context

Provider availability does not establish acquisition, storage, transformation, model-use or post-termination rights. Raw artifacts, hashes, normalized facts, derivatives, datasets and model parameters may have different contractual dispositions. A single fixed retention period would also conflict with privacy minimisation and purpose limitation.

TASK-17 reviewed the private two-user product boundary, provider categories, Australian/Western Australian legal gates and provider-exit requirements. No provider contract was accepted and no legal conclusion was made.

## Decision

Adopt `intelligence-retention/1` and require a versioned rights schedule plus fail-closed disposition on every provider-derived record.

Raw provider payloads have zero retention after successful validation by default. A rights schedule may permit a longer, purpose-bound period, but the applied duration is always the shortest of the policy maximum, provider right, legal/privacy necessity and genuine purpose need. Indefinite retention requires an explicit lawful and contractual basis.

Hashes, normalized facts, derivatives, datasets and trained model parameters do not automatically survive provider termination. Unknown rights are `not_permitted`.

Keep shared intelligence and user-owned private records in separate ownership/storage domains. User betting and financial records do not enter shared datasets or training by default. Future user records require governed access, export and deletion.

Do not create long-lived provider-derived exports unless expressly permitted. Maintain deletion dispositions outside restorable application state and run a post-restore deletion sweep before service resumes.

Synthetic and evidence-backed manual fixtures are approved now. The Odds API is only the first written-rights clarification candidate and Sportradar only the enterprise comparator. Neither is selected or activated. Bookmaker consumer websites/accounts are prohibited sources without bespoke written automated-use permission.

## Consequences

- Provider ingestion and persistence cannot accept a record without a current rights disposition.
- Replay may be deliberately incomplete when raw evidence cannot be retained; replay limitations must be explicit.
- Provider exit inventories and applies dispositions to raw and derived classes, models and backups; technical rollback cannot restore contractual rights.
- Retention jobs must be provider-, class-, purpose- and rights-aware rather than global TTL jobs.
- The approved persistence slice is limited to synthetic and explicitly user-owned manual fixtures until provider rights are confirmed.
- Public/paid access, affiliates, execution, bookmaker integration or material expansion requires Australian/Western Australian legal review.

## Alternatives considered

- Treat public or paid data as freely reusable: rejected because access and reuse rights are distinct.
- Retain hashes and normalized facts indefinitely: rejected because they remain provider-derived and survival is contract-dependent.
- Keep raw payloads for forensic replay by default: rejected because it prejudges storage rights and increases privacy/security exposure.
- Use one retention period for all classes: rejected because ownership, purpose, sensitivity and contractual obligations differ.
