# Production preparation evidence

Status: **Historical preparation evidence — superseded by the completed [production cutover record](PRODUCTION_CUTOVER.md) on 28 August 2026**

Captured: 2026-08-28 (Australia/Perth)

Controlling runbook baseline: `5072954af87413bdd7e01fc907be0abdb978b464`

## DNS baseline (read-only)

Cloudflare displayed nine records for `matthematicalkalma.com`. No DNS record was created, edited, proxied/unproxied, or deleted during this gate.

| Owner | Type | Target/value | Priority | Proxy | TTL |
| --- | --- | --- | ---: | --- | --- |
| `@` | A | `13.248.243.5` | — | Proxied | Auto |
| `@` | A | `76.223.105.230` | — | Proxied | Auto |
| `autodiscover` | CNAME | `autodiscover.outlook.com` | — | DNS only | Auto |
| `_domainconnect` | CNAME | `_domainconnect.gd.domaincontrol.com` | — | Proxied | Auto |
| `www` | CNAME | `matthematicalkalma.com` | — | Proxied | Auto |
| `@` | MX | `matthematicalkalma-com.mail.protection.outlook.com` | 0 | DNS only | Auto |
| `_dmarc` | TXT | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` | — | DNS only | Auto |
| `@` | TXT | `MS=ms31883449` | — | DNS only | Auto |
| `@` | TXT | `v=spf1 include:spf.protection.outlook.com -all` | — | DNS only | Auto |

No DKIM selector CNAME/TXT record was present in the nine-record inventory. This records absence; it does not assert that DKIM is required or disabled. Microsoft 365 MX, SPF, DMARC, domain verification and autodiscover records were otherwise present and unchanged.

## Resources prepared

- Worker `matthematical-kalma-production`: created from Cloudflare's harmless Hello World template solely so Access could protect its temporary `workers.dev` destination. It contains no personal, financial, fixture or demo data. The Matthematical Kalma application bundle has not been deployed.
- D1 `matthematical-kalma-production`: created with the `oc` location hint. Only the ordered source migration `0001_platform_foundation.sql` was applied.
- Access application `matthematical-kalma-production - Cloudflare Workers`: targets only the production Worker's production/preview URLs, uses One-Time PIN only, the reusable exact-email Allow policy `Matthematical Kalma Administrator Only`, and one-month application/policy sessions.
- GitHub environment `matthematical-kalma-production`: restricted to `main`, protected by a valid repository reviewer, and intentionally contains zero secrets.

Internal Cloudflare resource IDs, the account ID, credentials, Access audience and session material are intentionally excluded from GitHub and Notion.

## D1 validation

- Migration history: one row, `0001_platform_foundation.sql`.
- Schema contract: singleton `1`, version `1`, established at `2026-08-27T00:00:00.000Z`.
- Foreign keys: `PRAGMA foreign_key_check` returned no violations.
- Tables: Cloudflare system `_cf_KV`, Wrangler `d1_migrations`, application `platform_schema_metadata`, and SQLite `sqlite_sequence` only.
- Application data: no users, bets, fixtures, recommendations, financial records or demo records exist.

## Deployment safeguards

The separate manual-only `Deploy production` workflow accepts an exact 40-character commit SHA, runs only from `main` in the canonical repository, and rejects any SHA mismatch. A dedicated source guard allowlists only Worker/D1 `matthematical-kalma-production`, requires `DB`, `ASSETS`, `APP_ENVIRONMENT=production`, `workers_dev=true`, disables preview URLs, and rejects routes/custom domains. The workflow cannot create DNS, Access, API tokens or custom domains.

The production environment has no secrets, so deployment fails closed until a later approved direct-entry credential gate supplies the environment-scoped account ID and API token. No production workflow has been dispatched.

## Explicitly untouched

Production application deployment, custom domains, Worker routes, apex/`www` DNS, Microsoft 365 records, API tokens, GitHub secrets, development, staging, Sowstead and the superseded Cloudflare account were not modified.
