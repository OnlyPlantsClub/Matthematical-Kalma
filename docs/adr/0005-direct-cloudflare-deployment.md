# ADR-0005: Direct Cloudflare deployment

- Status: Accepted
- Date: 2026-08-27
- Supersedes: ADR-0001 platform-hosting details

## Context

The product now has a dedicated Cloudflare account and `matthematicalkalma.com`. GitHub is the canonical source repository. The previously accepted Sites-managed deployment and D1 assumptions would leave production ownership and the delivery pathway ambiguous.

## Decision

Keep the Vinext modular monolith, but deploy it directly as one Cloudflare Worker with Workers Static Assets. Pages is not the production target. Bind environment-specific Cloudflare D1 databases directly to the Worker. Deploy from the GitHub repository through Workers Builds or a tested, gated GitHub Actions/Wrangler workflow. Add private R2, Queues, Cron Triggers or Workflows only behind existing module/application-service boundaries when their use cases are proven.

Cloudflare authoritative DNS is now active for `matthematicalkalma.com` in the verified replacement account. Microsoft MX, SPF, DMARC, domain verification and autodiscover resolve correctly, and inbound/outbound mail tests passed after migration. The Cloudflare administrator alias has authenticator 2FA and retained recovery codes. The approved Worker/D1 names are `matthematical-kalma-dev`, `matthematical-kalma-staging` and `matthematical-kalma-production`, with `DB` as the D1 binding. Production secrets and account identifiers remain in Cloudflare/GitHub environment configuration, not source or documentation.

Source may contain non-secret, non-provisioning configuration for all environments. The administrator security gate has passed, so scoped development/staging environment configuration may now be created. Production resource creation, credentials, secrets, migrations and deployment remain separately gated.

## Consequences

- The MVP retains one application, deployment and primary transaction boundary.
- GitHub history describes every reproducible application and infrastructure change.
- D1 migrations stay ordered, immutable and environment-specific.
- DNS, Microsoft email readiness and administrator account security are complete; protected non-production credentials and deployment proof remain prerequisites.
- Pages is not an additional frontend tier; the Vinext output deploys as a Worker with static assets.
- GitHub CI validates the application and local migrations but has no deployment job until the security gate is complete.

## Official references

- [Workers best practices and Static Assets](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Full-stack applications on Workers](https://developers.cloudflare.com/workers/static-assets/routing/full-stack-application/)
- [Workers Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
