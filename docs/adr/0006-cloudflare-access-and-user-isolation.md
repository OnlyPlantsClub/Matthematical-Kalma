# ADR-0006: Cloudflare Access and strict user isolation

- Status: Accepted for the private MVP
- Date: 2026-08-27
- Supersedes: ADR-0002 authentication-provider details

## Context

The private MVP needs Oliver and Matthew to have distinct authenticated identities and strictly isolated personal records. Sites identity/SIWC will no longer be present after direct Cloudflare deployment.

## Decision

Protect production and preview Workers with Cloudflare Access. Initially use One-Time PIN with an allow policy containing exactly the administrator address and Matthew’s confirmed address. Use Worker-native validated Access context where available; otherwise validate the Access JWT signature, issuer, audience and expiry before creating an `OwnerContext`. Map the stable issuer/subject pair to an opaque internal user ID. Email is allowlist/contact metadata, never the application ownership key.

Every personal repository operation requires the server-derived owner context and scopes reads and writes by `owner_user_id`. Jobs require an explicit service capability and audit reason. Step 2 must test isolation across direct IDs, lists, search, pagination, aggregates, jobs, export and deletion for two users.

## Consequences

- Both intended users must be admitted in the Cloudflare Access policy before Step 2 acceptance.
- Authentication and data authorization remain separate layers.
- A later public/product-managed identity provider can add mappings without changing domain ownership.
- Access configuration, JWT validation and two-user isolation are deployment-blocking tests.
- Step 2 authentication implementation cannot begin until the Access team domain/application, audience, exact two-email allowlist, OTP delivery and session duration are confirmed.

## Alternatives considered

- **External managed auth (Clerk, Auth0 or WorkOS):** defer until public self-service accounts, passkeys or richer recovery are required.
- **Custom magic-link/passkey auth:** reject for MVP because credential, recovery, abuse and session security would become application responsibilities.
- **Cloudflare account membership:** reject as product identity because infrastructure administrators and product users are different roles.
- **Domain-wide Access allow rule:** reject; only exact identities are admitted.

## Official references

- [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [Access application tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/)
- [One-Time PIN login](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
