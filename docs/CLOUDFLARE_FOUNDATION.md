# Cloudflare foundation and admission runbook

Status: **Cloudflare foundation, protected deployment pipeline and production-domain cutover complete — 28 August 2026.** See the accepted [production cutover and rollback record](PRODUCTION_CUTOVER.md). The legacy Sites deployment is **Superseded — rollback only**.

## Service and environment map

| Environment | Worker | D1 database | D1 binding | Deployment state |
| --- | --- | --- | --- | --- |
| Development | `matthematical-kalma-dev` | `matthematical-kalma-dev` | `DB` | Deployed and administrator-validated |
| Staging | `matthematical-kalma-staging` | `matthematical-kalma-staging` | `DB` | Deployed and administrator-validated at `cc5cad37507bf97c5794ec65c3b0f8da3361cbde` |
| Production | `matthematical-kalma-production` | `matthematical-kalma-production` | `DB` | Deployed at `e128273c27569094878af0a668db9cce284089c8`; apex and `www` validated |

The Vinext application builds to one Worker plus Workers Static Assets. The Worker is the modular-monolith trust boundary. Assets use binding `ASSETS`; API paths run through the Worker. R2, Cron Triggers, Queues and Workflows remain unbound until a concrete use case is implemented. The Cloudflare Vite plugin selects an environment at build time: the default build is development, while `pnpm build:staging` and `pnpm build:production` flatten the corresponding environment into the generated deployment config. A production build is not a production deployment.

## Current readiness

- Cloudflare authoritative DNS is active for `matthematicalkalma.com`.
- Microsoft MX, SPF, DMARC, domain verification and autodiscover resolve from the replacement authoritative zone; inbound and outbound email tests passed.
- The Cloudflare infrastructure administrator signs in as `cloudflare@matthematicalkalma.com`; email verification, authenticator 2FA and recovery-code capture are complete.
- `Admin@matthematicalkalma.com` remains the initial application identity admitted by Cloudflare Access. Infrastructure administration and application admission are deliberately separate.
- The superseded Cloudflare account and its zone remain untouched during the propagation/rollback window. They must never be used for new Matthematical Kalma resources or deployment credentials.
- The replacement account ID is deployment configuration, not source documentation. Store it only as `CLOUDFLARE_ACCOUNT_ID` in protected Matthematical Kalma GitHub environments when non-production deployment credentials are created.
- Development and staging use separate deployment tokens and protected GitHub environments. Both Workers have `DB` and `ASSETS` bindings and are protected by exact-email Cloudflare Access admission.
- Staging workflow run [33097678453](https://github.com/OnlyPlantsClub/Matthematical-Kalma/actions/runs/33097678453) deployed commit `cc5cad37507bf97c5794ec65c3b0f8da3361cbde`. It found no pending migrations, validated schema contract version 1, reported the staging `DB` and `ASSETS` bindings, and passed the unauthenticated Access redirect check.
- Administrator-driven staging OTP and visual acceptance passed: mobile presentation, navigation, empty states and refresh worked; no demo betting/financial records, infrastructure-validation page or application error appeared.
- Production workflow [33101680003](https://github.com/OnlyPlantsClub/Matthematical-Kalma/actions/runs/33101680003) deployed commit `e128273c27569094878af0a668db9cce284089c8`; pending source-controlled migrations only were allowed and `DB`/`ASSETS` bindings were validated.
- The Worker Custom Domain is live at [https://matthematicalkalma.com](https://matthematicalkalma.com). `www` permanently redirects to the equivalent apex path/query without a loop.
- Cloudflare Access protects the apex, `www` and temporary Worker destination with One-Time PIN only, the exact administrator email allowlist and one-month sessions.
- Microsoft 365 MX, SPF, DMARC, verification and autodiscover categories remained unchanged; post-cutover inbound and outbound mail tests passed.
- Production D1 contains only `0001_platform_foundation.sql`, schema-contract metadata and platform tables. A pre-cutover Time Travel bookmark was captured but its value is excluded from public documentation and expires with the platform retention window.
- No demo betting, financial, user, fixture or recommendation records exist.

## Cloudflare Access configuration

The platform admission layer is operational. Step 2 still implements application identity and authorization:

1. One-Time PIN is the only configured login method; the allow policy matches exactly `Admin@matthematicalkalma.com`, never an email domain.
2. Global/application/policy sessions use one month rather than an unlimited session.
3. Development, staging, production Worker destination, apex and `www` are protected; administrator OTP acceptance passed.
4. Never put tokens, account IDs, audiences, cookies or deployment credentials in source or Notion.
5. Step 2 must validate Access context, map `(issuer, subject)` to an opaque internal user and derive `OwnerContext` server-side. Email is admission/contact metadata, not ownership authority.
6. Synthetic distinct subjects—not Matthew—must prove fail-closed and cross-user isolation before personal features are enabled.

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

Run every future remote migration/deployment through its matching protected GitHub environment and approved workflow. Never commit the account ID or dedicated environment token, and never reuse Sowstead or superseded-account credentials. Always use the explicit D1 database name for remote migration commands, take a D1 Time Travel bookmark before a material remote migration, review the pending list, apply forward-only migrations, and run `PRAGMA foreign_key_check`, a schema-contract read and domain reconciliation afterwards. D1 rejects `PRAGMA integrity_check` through its SQL authorizer; use an approved export-and-SQLite procedure when a full file-level integrity check is required.

Production passed its separate approval gates: protected GitHub environment, dedicated least-privilege token, recovery verification, D1/Worker creation, migration approval, temporary-address deployment, Access validation, apex attachment and `www` redirect checks. Dashboard bootstrap changes are recorded in [PRODUCTION_CUTOVER.md](PRODUCTION_CUTOVER.md).

## Non-production GitHub deployment gate

The manual `Deploy non-production` workflow accepts exactly `development` or `staging` and runs only from `main` in `OnlyPlantsClub/Matthematical-Kalma`. A source-controlled guard maps those inputs to only `matthematical-kalma-dev` and `matthematical-kalma-staging`. It rejects missing or malformed D1 identifiers, unexpected Worker/database names, missing `DB` or `ASSETS` bindings, and any route configuration before deployment credentials are used.

Each GitHub environment must have its own Cloudflare API token. Cloudflare scopes these permissions to the replacement account, not to an individual Worker or D1 database. Grant only:

- Account — Workers Scripts — Edit
- Account — D1 — Edit

Do not grant zone, DNS, Access, R2, email, membership, token-management or account-administration permissions. Configure the following directly in the matching protected GitHub environment; never commit them or put their values in Notion:

| GitHub environment | Secrets | Non-secret variables |
| --- | --- | --- |
| `matthematical-kalma-dev` | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_WORKER_URL` |
| `matthematical-kalma-staging` | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_WORKER_URL` |

The workflow builds and validates first, creates an ignored deployment configuration containing the selected D1 identifier, reviews and applies only pending source-controlled migrations, validates the schema anchor, and deploys the Worker plus Static Assets. It then makes a fresh unauthenticated request and requires an Access redirect. It never creates an Access service token and cannot perform the administrator OTP test.

Development and staging are deployed and validated. Staging has a required GitHub user reviewer with repository permission; each new staging run requires separate approval. Production uses its own manual-only workflow and protected GitHub environment, accepts an exact `main` SHA, and allowlists only `matthematical-kalma-production`. The accepted domain, Access, Microsoft 365 preservation and rollback evidence is in [the production cutover record](PRODUCTION_CUTOVER.md).
