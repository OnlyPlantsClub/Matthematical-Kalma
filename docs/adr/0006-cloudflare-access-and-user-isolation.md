# ADR-0006: Cloudflare Access and strict user isolation

- Status: Accepted for the private MVP
- Date: 2026-08-27
- Supersedes: ADR-0002 authentication-provider details

## Context

The private MVP needs Oliver and Matthew to have distinct authenticated identities and strictly isolated personal records. Sites identity/SIWC will no longer be present after direct Cloudflare deployment.

## Decision

Protect the private application with Cloudflare Access. The Worker validates the Access JWT signature, issuer, audience and expiry before creating an `OwnerContext`, then maps the stable issuer/subject pair to an opaque internal user ID. Email is display/contact metadata and may assist Access admission, but is never the application authorization key.

Every personal repository operation requires the server-derived owner context and scopes reads and writes by `owner_user_id`. Jobs require an explicit service capability and audit reason. Step 2 must test isolation across direct IDs, lists, search, pagination, aggregates, jobs, export and deletion for two users.

## Consequences

- Both intended users must be admitted in the Cloudflare Access policy before Step 2 acceptance.
- Authentication and data authorization remain separate layers.
- A later public/product-managed identity provider can add mappings without changing domain ownership.
- Access configuration, JWT validation and two-user isolation are deployment-blocking tests.
