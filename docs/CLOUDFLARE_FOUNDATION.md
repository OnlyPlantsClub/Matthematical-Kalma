# Cloudflare foundation and admission runbook

Status: preparatory configuration committed; no Cloudflare resources or secrets provisioned by this change.

## Service and environment map

| Environment | Worker | D1 database | D1 binding | Deployment state |
| --- | --- | --- | --- | --- |
| Development | `matthematical-kalma-dev` | `matthematical-kalma-dev` | `DB` | Local-ready; remote resource not created here |
| Staging | `matthematical-kalma-staging` | `matthematical-kalma-staging` | `DB` | Configured; remote resource not created here |
| Production | `matthematical-kalma-production` | `matthematical-kalma-production` | `DB` | Configuration only; provisioning/deployment prohibited until approved |

The Vinext application builds to one Worker plus Workers Static Assets. The Worker is the modular-monolith trust boundary. Assets use binding `ASSETS`; API paths run through the Worker. R2, Cron Triggers, Queues and Workflows remain unbound until a concrete use case is implemented. The Cloudflare Vite plugin selects an environment at build time: the default build is development, while `pnpm build:staging` and `pnpm build:production` flatten the corresponding environment into the generated deployment config. A production build is not a production deployment.

## Current readiness

- Cloudflare authoritative DNS is active for `matthematicalkalma.com`.
- Microsoft has verified MX, SPF and autodiscover and reports email ready.
- Cloudflare administrator 2FA/recovery is in progress and email verification is pending.
- No production resources, credentials, secrets or deployment may be created until administrator 2FA and recovery are confirmed.

## Initial Cloudflare Access configuration

After the account-security gate passes:

1. Create a self-hosted Access application for the non-production Worker hostname.
2. Enable One-Time PIN and create an Allow policy for exactly `Admin@matthematicalkalma.com`. Do not use an email-domain rule.
3. Set global, application and policy session durations to **one month**. This is the longest currently supported Access duration; there is no unlimited session.
4. Record the team domain and application audience as non-secret environment configuration. Never put tokens, account IDs or deployment credentials in source or Notion.
5. Verify OTP delivery, then verify the Worker rejects missing, expired, wrong-issuer, wrong-audience and non-allowlisted tokens.
6. In Step 2, map validated `(issuer, subject)` to an opaque internal user and derive `OwnerContext` on the server. Email is not the ownership key.

## Later Matthew beta admission

Matthew is not a Step 2 prerequisite. When the administrator approves beta admission:

1. Obtain and independently confirm Matthew’s exact email address.
2. Add only that address to the Access Allow policy; do not broaden to the domain.
3. Have Matthew complete OTP sign-in, capture the resulting distinct `(issuer, subject)` mapping and provision a new internal user. Never attach it to the administrator row.
4. Run the complete two-user isolation regression matrix for direct IDs, lists, pagination, search, aggregates, jobs, exports and deletion.
5. Remove the allow entry and revoke the identity mapping if beta access ends; retain only the audit/privacy evidence permitted by policy.

## Migration and validation sequence

Local preparation is safe now:

```sh
pnpm migrations:validate
pnpm migrations:apply:local
pnpm migrations:list:local
pnpm d1:validate:local
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm security:secrets
```

After the security gate, provision and deploy development/staging only. Always use the explicit D1 database name for remote migration commands, take a D1 Time Travel bookmark before a material remote migration, review the pending list, apply forward-only migrations, and run `PRAGMA foreign_key_check`, a schema-contract read and domain reconciliation afterwards. D1 rejects `PRAGMA integrity_check` through its SQL authorizer; use an approved export-and-SQLite procedure when a full file-level integrity check is required.

Production requires a separate approval gate: protected GitHub environment, least-privilege Cloudflare token, recovery verification, production D1/Worker creation, migration approval, custom-domain/Access validation and smoke/reconciliation checks. Dashboard changes made during bootstrap or incident recovery must be reconciled back into GitHub.
