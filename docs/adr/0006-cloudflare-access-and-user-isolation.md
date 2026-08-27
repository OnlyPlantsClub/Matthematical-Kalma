# ADR-0006: Cloudflare Access and strict user isolation

- Status: Accepted for the private MVP
- Date: 2026-08-27
- Supersedes: ADR-0002 authentication-provider details

## Context

The private MVP initially admits one administrator and later adds Matthew as a beta tester. Every admitted person must have a distinct authenticated identity and strictly isolated personal records. Sites identity/SIWC will no longer be present after direct Cloudflare deployment.

## Decision

Protect production and non-production Workers with Cloudflare Access. Initially use One-Time PIN with an allow policy containing only `Admin@matthematicalkalma.com` (normalised case-insensitively). Set the global, application and policy session durations to one month, Cloudflare Access’s longest currently supported duration, rather than using an unlimited session. Use Worker-native validated Access context where available; otherwise validate the Access JWT signature, issuer, audience and expiry before creating an `OwnerContext`. Map the stable issuer/subject pair to an opaque internal user ID. Email is allowlist/contact metadata, never the application ownership key.

Every personal repository operation requires the server-derived owner context and scopes reads and writes by `owner_user_id`. Jobs require an explicit service capability and audit reason. Step 2 tests isolation across direct IDs, lists, search, pagination, aggregates, jobs, export and deletion using two synthetic subjects. Matthew’s identity is not a Step 2 prerequisite.

## Consequences

- Only the administrator is initially admitted. Matthew is added later by exact address, signs in to establish a different Access subject and receives a separate internal user.
- Authentication and data authorization remain separate layers.
- A later public/product-managed identity provider can add mappings without changing domain ownership.
- Access configuration, JWT validation and synthetic two-subject isolation are Step 2 acceptance tests.
- Step 2 is **Not started — awaiting infrastructure readiness**: administrator 2FA/recovery, pending email verification/OTP delivery, Access application/audience confirmation and a non-production Worker deployment.
- Adding Matthew is a later beta-admission procedure, not a prerequisite.

## Alternatives considered

- **External managed auth (Clerk, Auth0 or WorkOS):** defer until public self-service accounts, passkeys or richer recovery are required.
- **Custom magic-link/passkey auth:** reject for MVP because credential, recovery, abuse and session security would become application responsibilities.
- **Cloudflare account membership:** reject as product identity because infrastructure administrators and product users are different roles.
- **Domain-wide Access allow rule:** reject; only exact identities are admitted.

## Official references

- [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [Access application tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/)
- [One-Time PIN login](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
- [Access session management](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/)
