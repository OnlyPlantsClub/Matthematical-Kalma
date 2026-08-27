# ADR-0005: Direct Cloudflare deployment

- Status: Accepted
- Date: 2026-08-27
- Supersedes: ADR-0001 platform-hosting details

## Context

The product now has a dedicated Cloudflare account and `matthematicalkalma.com`. GitHub is the canonical source repository. The previously accepted Sites-managed deployment and D1 assumptions would leave production ownership and the delivery pathway ambiguous.

## Decision

Keep the Vinext modular monolith, but deploy it directly as one Cloudflare Worker with Workers Static Assets. Pages is not the production target. Bind environment-specific Cloudflare D1 databases directly to the Worker. Deploy from the GitHub repository through Workers Builds or a tested, gated GitHub Actions/Wrangler workflow. Add private R2, Queues, Cron Triggers or Workflows only behind existing module/application-service boundaries when their use cases are proven.

Cloudflare becomes authoritative DNS only after all Microsoft 365 email records have been captured and reconciled. Production secrets and account identifiers remain in Cloudflare/GitHub environment configuration, not source or documentation.

## Consequences

- The MVP retains one application, deployment and primary transaction boundary.
- GitHub history describes every reproducible application and infrastructure change.
- D1 migrations stay ordered, immutable and environment-specific.
- DNS and email cutover is an explicit operational prerequisite, not an incidental deployment step.
- Pages is not an additional frontend tier; the Vinext output deploys as a Worker with static assets.

## Official references

- [Workers best practices and Static Assets](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Full-stack applications on Workers](https://developers.cloudflare.com/workers/static-assets/routing/full-stack-application/)
- [Workers Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
