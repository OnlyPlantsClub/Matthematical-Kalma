# ADR-0002: Sites identity and strict user isolation

- Status: Accepted
- Date: 2026-08-27

## Context

The Site has platform identity and is owner-only. The product needs durable private records for at least two separate users. Site admission and record authorization are different concerns.

## Decision

Map the authenticated Sites issuer/subject from trusted server headers to an opaque internal user ID. Do not use email as an authorization key or store app passwords. Every user-owned aggregate has one `owner_user_id`; every server operation derives its owner context from the request and scopes storage server-side. Site policy controls admission; application checks control record access.

## Consequences

- Step 2 admits the second user through supported access/SIWC and proves isolation.
- Client owner IDs are ignored; repositories require an owner context.
- Another future identity provider only adds a mapping.
- Shared bankrolls/workspaces need a separate future model and cannot weaken user scoping.
