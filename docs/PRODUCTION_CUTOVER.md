# Production cutover and rollback record

Status: **Complete — Cloudflare production accepted on 28 August 2026 (Australia/Perth)**

## Completion record

Matthematical Kalma completed its controlled Sites-to-Cloudflare production migration on 28 August 2026. GitHub remains the canonical technical record and source repository.

| Evidence | Accepted result |
| --- | --- |
| Production URL | [https://matthematicalkalma.com](https://matthematicalkalma.com) |
| Production Worker | `matthematical-kalma-production` |
| Deployed application commit | [`e128273c27569094878af0a668db9cce284089c8`](https://github.com/OnlyPlantsClub/Matthematical-Kalma/commit/e128273c27569094878af0a668db9cce284089c8) |
| Deployment workflow | [GitHub Actions run 33101680003](https://github.com/OnlyPlantsClub/Matthematical-Kalma/actions/runs/33101680003) |
| Bindings | Production `DB` and `ASSETS` validated |
| Access | Apex, `www`, and temporary Worker destination protected; One-Time PIN only; exact `Admin@matthematicalkalma.com` allowlist; one-month session |
| Runtime data | No demo betting, bankroll, recommendation, settlement, fixture, user, or financial records |
| Legacy Sites deployment | **Superseded — rollback only** |

The apex is attached as a Worker Custom Domain. `www.matthematicalkalma.com` uses a proxied placeholder `A` record (`192.0.2.1`, TTL Auto) and one active Cloudflare Single Redirect matching `http*://www.matthematicalkalma.com/*`, targeting `https://matthematicalkalma.com/${2}` with status `301` and query-string preservation enabled. HTTP/HTTPS root, nested path, query preservation, TLS, loop prevention, unauthenticated Access denial, authenticated application load, assets, refresh and empty states passed.

Microsoft 365 MX, SPF, DMARC, domain-verification and autodiscover categories were preserved. No DKIM selector existed in the recorded pre-cutover nine-record inventory, so no DKIM record was changed. Post-cutover outbound mail from `Admin@matthematicalkalma.com` was received externally and the external reply was received successfully.

Production D1 contains only migration `0001_platform_foundation.sql`, schema-contract metadata version 1 and platform migration/system tables. Foreign-key validation passed during preparation/deployment; no application or demo rows were inserted. A D1 Time Travel bookmark was captured on 28 August 2026 at approximately 02:17 Australia/Perth, immediately before cutover. Its value is intentionally excluded from source and Notion; the bookmark is usable only within Cloudflare D1's applicable Time Travel retention window, so it is not a durable backup.

## Environment and delivery structure

| Environment | Worker and D1 | Deployment control |
| --- | --- | --- |
| Development | `matthematical-kalma-dev` | Separate protected GitHub environment and least-privilege deployment token |
| Staging | `matthematical-kalma-staging` | Separate protected GitHub environment, token and required deployment review |
| Production | `matthematical-kalma-production` | Manual dispatch from protected `main`, exact full-SHA guard, valid required reviewer and production-only resource allowlist |

All deployment tokens are scoped to the Matthematical Kalma Cloudflare account with only Workers Scripts Edit and D1 Edit. Cloudflare enforces those permissions account-wide; source guards fail closed unless the exact environment Worker/D1 names and `DB`/`ASSETS` bindings match. Deployment workflows do not manage DNS, Access, custom domains, API tokens or Microsoft 365 records.

## Current rollback

- **Application:** use the last known-good Worker version without changing D1.
- **Apex:** detach the Worker Custom Domain and restore the recorded pre-cutover apex A records only after separate explicit approval.
- **`www`:** disable `Redirect www to apex`, replace the proxied placeholder A record with the original proxied `www` CNAME to the apex, and remove only the `www` Access destination if restoring the exact prior state.
- **D1:** do not restore for presentation or routing failures. A destructive Time Travel restore requires separate explicit approval and a fresh in-window bookmark.
- **Sites:** retain the old deployment temporarily as rollback evidence. Review its retirement on 4 September 2026; deletion requires separate explicit approval.

## Remaining operational follow-ups

1. Observe production stability and review whether to retire the Sites rollback deployment on 4 September 2026.
2. Decide whether the protected temporary `workers.dev` destination remains available for diagnostics.
3. Rotate deployment credentials on the approved schedule and retain required-reviewer/branch protections.
4. Begin Step 2 separately: implement validated Access identity mapping, internal users and synthetic two-subject owner-isolation tests. Cloudflare admission is complete; application authentication/authorization is not.

## Historical controlling runbook

This is the production change plan for Matthematical Kalma. It records the exact intended sequence and controls; it does not authorise creating resources, credentials, DNS records, routes, custom domains, Access applications, or deployments. GitHub remains the canonical source. Production work must stop at every approval gate below unless the administrator explicitly approves the exact operation.

## Accepted baseline

Preparation evidence and the immutable DNS baseline are recorded in [PRODUCTION_PREPARATION_EVIDENCE.md](PRODUCTION_PREPARATION_EVIDENCE.md).

- Canonical commit: `cc5cad37507bf97c5794ec65c3b0f8da3361cbde`.
- Development and staging Workers and D1 databases exist only in the replacement Matthematical Kalma Cloudflare account.
- Staging deployment workflow run [33097678453](https://github.com/OnlyPlantsClub/Matthematical-Kalma/actions/runs/33097678453) passed source validation, build, deployment dry run, D1 migration review, schema validation, Worker/Static Assets deployment, and unauthenticated Access redirect verification.
- Administrator OTP login and visual acceptance passed on staging: branding, mobile navigation, empty states, refresh handling, and absence of demo betting/financial records were confirmed.
- Production remains absent from the non-production workflow and source allowlist.

## Target production service map

| Capability | Production target | Control |
| --- | --- | --- |
| Application | Worker `matthematical-kalma-production` with Static Assets binding `ASSETS` | Created and deployed only after explicit approval |
| Persistence | D1 `matthematical-kalma-production`, location hint `oc`, binding `DB` | Empty except ordered source-controlled migrations |
| Temporary test address | Production Worker's generated `workers.dev` hostname | Protected by Access before test data or personal data exists |
| Primary address | `https://matthematicalkalma.com` as a Worker Custom Domain | Attached only at the cutover gate |
| `www` | `https://www.matthematicalkalma.com/*` redirects to the same path/query on the apex | Separate proxied redirect hostname; never a second application origin |
| Admission | Cloudflare Access, One-Time PIN, exact allow for `Admin@matthematicalkalma.com` only | One-month global/application/policy sessions; deny by default |
| Deployment | Protected GitHub environment `matthematical-kalma-production` | Manual dispatch from an exact `main` SHA with required reviewer |
| Recovery | Worker version rollback, Custom Domain/redirect rollback, D1 Time Travel | Evidence captured before every mutation |

R2, Queues, Cron Triggers, Workflows, external feeds, modelling jobs, and Matthew's beta identity are out of scope for this cutover.

## Approval gates

Production execution requires separate explicit approval for:

1. Production Worker/D1 resource creation.
2. Production Access application and exact-email policy creation.
3. Production token creation and direct GitHub secret entry.
4. Initial production migration and temporary-address deployment.
5. Apex Custom Domain and `www` redirect/DNS changes.
6. Any rollback that restores D1 or changes live routing.

Approval of one gate does not approve later gates. Never use credentials from development, staging, Sowstead, or the superseded Cloudflare account.

## Phase 0 — freeze, inventory, and evidence

Before the first production mutation:

1. Fetch `origin/main`; require a clean worktree and exact equality of `HEAD`, `main`, and `origin/main`. Record the approved full SHA.
2. Require green CI for that SHA. Re-run typecheck, Worker type check, lint, tests, build, migration validation, and secret scanning in the production preparation workflow.
3. Record the authenticated Cloudflare account alias and independently confirm it is the replacement Matthematical Kalma account. Do not print or commit the account ID.
4. Export a redacted inventory of existing Workers, D1 databases, Access applications, Worker routes/custom domains, Redirect Rules, and zone DNS record names/types. Confirm no proposed production name conflicts.
5. Capture the complete Microsoft 365 DNS baseline by owner name, type, target/value hash, priority, TTL, and proxy state. It must include MX, SPF TXT, DMARC TXT, DKIM CNAMEs if present, Microsoft domain-verification TXT, and autodiscover CNAME. Store no secret mailbox data.
6. Record the existing apex and `www` DNS/routing state and its rollback target. Confirm there is no apex CNAME that would block a Worker Custom Domain.
7. Confirm Cloudflare administrator 2FA/recovery remains operational and designate the cutover operator, verifier, maintenance window, and rollback authority.

**Gate A:** present the inventory, exact SHA, proposed resource list, DNS diff, and rollback targets. Obtain approval before creating production resources.

## Phase 1 — create isolated production resources

Create only in the replacement Matthematical Kalma account:

1. D1 database `matthematical-kalma-production` using location hint `oc`.
2. Worker `matthematical-kalma-production` with a harmless no-data validation response if a Worker must exist before Access protection.

The D1 database must contain no fixtures, betting records, financial records, or user records. Do not attach the apex, `www`, a route, or another custom domain. Record resource identifiers only in protected environment configuration, never source or Notion.

## Phase 2 — protect the temporary production address

Before deploying the application to the temporary address:

1. Confirm the production Worker's generated `workers.dev` hostname.
2. Create a dedicated self-hosted Cloudflare Access application for that hostname and record its audience as protected configuration.
3. Enable One-Time PIN exclusively; use a single Allow policy matching exactly `Admin@matthematicalkalma.com`, case-insensitively. Do not use a domain-wide rule and do not add Matthew.
4. Set global, application, and policy sessions to one month. Keep deny-by-default behavior and do not create an Access service token.
5. Verify a fresh unauthenticated request redirects to the expected Access team domain. The administrator then completes OTP privately and confirms successful admission. Test a non-allowlisted synthetic identity through the agreed negative method without sending an OTP to a real unrelated person.

Do not store OTPs, Access cookies, JWTs, or identity-provider data in logs or documentation.

## Phase 3 — production credentials and GitHub environment

Create a dedicated Cloudflare API token named for Matthematical Kalma production deployment. Restrict it to the replacement account and grant only:

- Account — Workers Scripts — Edit
- Account — D1 — Edit

These permissions are account-wide; Cloudflare does not technically restrict them to individual Worker/D1 names. Do not grant DNS, zone, Access, R2, email, membership, token-management, billing, or other permissions.

Create protected GitHub environment `matthematical-kalma-production` with:

- Required reviewer: a verified GitHub user or team with repository permission to approve deployments.
- Deployment branch policy: `main` only.
- Secrets entered directly by the administrator: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`.
- Non-secret variables: `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_WORKER_URL`.

Never display, copy into chat, commit, or place credentials/account identifiers in Notion. Test missing/malformed-token failure locally or with mocked process state; do not make a live invalid-token call.

## Phase 4 — production workflow change

Add a separate production workflow; do not add `production` to the existing non-production workflow. The production workflow must:

1. Be manual-dispatch only and accept an explicit expected full commit SHA.
2. Run only in `OnlyPlantsClub/Matthematical-Kalma`, only on `refs/heads/main`, and fail unless `GITHUB_SHA` equals the supplied SHA and current `origin/main` policy.
3. Hard-code an exact production allowlist containing only Worker/D1 name `matthematical-kalma-production`; reject routes and custom domains during the temporary-address phase.
4. Require exactly one D1 `DB` binding, Static Assets `ASSETS`, `APP_ENVIRONMENT=production`, `workers_dev=true`, and a valid environment-scoped D1 identifier.
5. Run install, typecheck, Worker type check, lint, tests, production build, migration validation, secret scan, and Wrangler dry run before credentials can mutate Cloudflare.
6. List pending source-controlled migrations and persist their reviewed names as run evidence.
7. Stop for the production environment reviewer immediately before migration/deployment.
8. Apply only pending migrations, validate the D1 schema, deploy Worker/Static Assets, report the Worker version, report bindings, and require an unauthenticated Access redirect.

No workflow may create DNS records, Access resources, custom domains, production routes, or API tokens.

## Phase 5 — database migration and temporary-address validation

Immediately before migration:

1. Confirm D1 reports the production storage backend and retrieve a Time Travel bookmark. Store the bookmark as restricted deployment evidence, not in source or Notion.
2. Confirm the database is empty except for the D1 migration ledger, if present.
3. Review the pending migration list against the approved SHA. Any unexpected, edited, missing, or out-of-order migration aborts the run.
4. Apply only the pending ordered source-controlled migrations.
5. Run `PRAGMA foreign_key_check`, read `platform_schema_metadata`, verify expected tables/indexes/constraints, and run domain reconciliation queries. D1's SQL authorizer does not support `PRAGMA integrity_check`; use an approved export-and-local-SQLite check if full file verification is required.

After deployment to `workers.dev`:

- Confirm the deployed version message references the exact GitHub SHA.
- Confirm `DB` points to `matthematical-kalma-production`, `ASSETS` exists, and `APP_ENVIRONMENT` is `production`.
- Confirm no route/custom-domain configuration exists yet.
- Confirm unauthenticated redirect, administrator OTP success, refresh/deep-link behavior, mobile layout, navigation, empty states, security headers, no demo data, and no application/infrastructure-validation errors.
- Confirm the Worker never returns production content when Access is absent.

**Gate B:** present temporary-address validation, version/binding evidence, D1 validation, and rollback bookmark. Obtain explicit domain-cutover approval.

## Phase 6 — apex and `www` cutover

The sequence minimises public exposure and protects the application before routing traffic:

1. Create or update a hostname-based Access application for `matthematicalkalma.com` with the same OTP-only exact-email policy and one-month sessions. Verify its audience and policy before attaching the hostname. Keep the protected `workers.dev` application until post-cutover acceptance.
2. Re-run the DNS inventory and compare every Microsoft 365 record with the Phase 0 baseline. Abort on unexplained drift.
3. Attach `matthematicalkalma.com` to `matthematical-kalma-production` as a Worker **Custom Domain**, not a Worker Route. Cloudflare will manage the necessary apex DNS record and certificate. Do not delete or alter any mail-related records.
4. Wait for Custom Domain certificate/status readiness. From a fresh unauthenticated client, require an Access redirect before any authenticated test.
5. For `www`, choose the canonical apex behavior: create the minimum proxied DNS record required for Cloudflare Redirect Rules, then create a permanent redirect from `www` to the apex preserving path and query. Do not attach `www` as a second application Custom Domain. Ensure the redirect cannot bypass Access or expose application content.
6. Verify HTTP-to-HTTPS and `www`-to-apex behavior. Avoid redirect loops and preserve deep links/query strings.

Expected intentional DNS changes are limited to records needed for the apex Custom Domain and the proxied `www` redirect hostname. MX, SPF, DMARC, DKIM, Microsoft verification, autodiscover, and unrelated records must be byte-for-byte or semantically unchanged as applicable.

## Phase 7 — post-cutover checks

Run from independent/fresh sessions and record timestamps:

- `https://matthematicalkalma.com/` returns an unauthenticated Access redirect.
- The Access login offers One-Time PIN only and admits exactly the administrator email.
- Administrator OTP login succeeds without exposing the OTP to automation.
- Root, refresh, deep links, navigation, mobile viewport, static assets, favicon/OG asset, and empty states work.
- No demo betting, bankroll, recommendation, settlement, or financial data appears.
- API paths reject missing/invalid Access context and do not accept client-supplied owner IDs.
- Production `DB`, `ASSETS`, and environment bindings match the approved production resources.
- D1 foreign-key/schema/reconciliation checks still pass and no unexpected rows exist.
- `http://`, `www`, and canonical redirects preserve path/query and have no loop.
- TLS certificate is valid for the apex; browser and Worker logs show no material errors.
- DNS checks confirm MX, SPF, DMARC, DKIM, verification, and autodiscover still resolve as before. Repeat Microsoft 365 inbound, outbound, and Cloudflare-alias delivery checks.
- Development and staging remain reachable and unchanged behind their own Access applications.
- No production resource exists in the superseded or Sowstead accounts.

Keep the temporary `workers.dev` hostname protected during the observation window. Decide later whether to leave it protected for emergency diagnostics or disable it; do not leave an unprotected alternate origin.

## Rollback procedure

Rollback is triggered by Access bypass, wrong-account/resource evidence, failed authentication, material application errors, data/schema inconsistency, incorrect bindings, broken mail DNS, redirect loops, or unacceptable post-cutover behavior.

### Before domain attachment

1. Stop the workflow; do not attach the domain.
2. Roll the Worker back to the last known safe version or deploy the harmless no-data validation version.
3. If a migration changed production D1 incorrectly, obtain explicit destructive-restore approval, stop writes, and restore to the captured Time Travel bookmark. Record the restore's returned previous bookmark so the restore can itself be undone.
4. Re-run schema and reconciliation checks before retrying.

### After domain attachment

1. Preserve incident evidence and stop writes where data integrity is uncertain.
2. Detach/disable the apex Custom Domain from the production Worker, or restore the exact recorded pre-cutover apex routing state. Disable the `www` redirect and restore its prior DNS state if it contributes to the incident.
3. Restore only the intentional apex/`www` changes; do not touch Microsoft 365 or unrelated DNS records. If mail records drifted, restore each record from the Phase 0 inventory and re-test mail.
4. Roll back the Worker version independently from D1. Do not restore D1 merely for a presentation/routing failure.
5. For confirmed destructive/schema data failure, use the explicitly approved D1 Time Travel bookmark restore, then validate and reconcile.
6. Verify the public host is safely denied or restored, temporary production address remains Access-protected, and development/staging remain unchanged.

Deletion of failed production resources is not part of immediate rollback. Quarantine them, retain evidence, and request a separate deletion approval after the rollback is stable.

## Completion evidence

Production is ready only when the change record contains:

- Approved full GitHub SHA and green CI/deployment run links.
- Resource names, Worker version, binding names, and redacted account-boundary confirmation.
- Reviewed migration list, pre-migration bookmark reference, schema/reconciliation results.
- Access application hostname/audience reference, exact-email policy evidence, session settings, unauthenticated redirect, and administrator-driven OTP result.
- Before/after apex and `www` DNS/routing evidence plus unchanged Microsoft 365 DNS comparison.
- Functional/mobile/empty-state acceptance and absence of demo data.
- Rollback targets and observation-window outcome.

## Official references

- [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Workers routing best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Cloudflare Access self-hosted applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
- [Cloudflare Access application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [D1 Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/)
