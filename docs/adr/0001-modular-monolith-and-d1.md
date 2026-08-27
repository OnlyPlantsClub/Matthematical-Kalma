# ADR-0001: Sites-hosted modular monolith and D1

- Status: Superseded by [ADR-0005](0005-direct-cloudflare-deployment.md)
- Date: 2026-08-27

## Context

The existing Vinext/React Site needs durable relational personal records, strict ownership, joins, transactions, migrations and audit history. It has no independent scaling or deployment requirement.

## Decision

Run one modular monolith as the existing Site/Worker. Separate capability code and table ownership; communicate through typed application services and recorded domain events. Use Sites-managed D1 as the system of record. Leave R2 unbound until large immutable artifacts or exports require blob storage.

This historical decision is superseded. The modular-monolith and D1 principles remain; ADR-0005 replaces hosting, resource ownership and deployment with direct Cloudflare services.

## Consequences

- One deployment and transaction boundary keep MVP operations and audit simple.
- Code review must enforce capability boundaries in the shared database.
- Background jobs reuse application services and idempotency rules.
- R2, a broker, warehouse or service extraction can later sit behind stable module contracts.
