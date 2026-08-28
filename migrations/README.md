# D1 migrations

This directory is the ordered, forward-only schema history for every Matthematical Kalma D1 environment. GitHub is the canonical source.

- Name files `NNNN_lowercase_description.sql` using the next four-digit number.
- Never edit a migration after it has been applied remotely. Add a forward fix instead.
- `0001` is the harmless platform anchor. `0002` deliberately advances the schema contract to version 2 for authenticated shared-intelligence persistence; it contains no user betting, financial or provider data and no secret material.
- Migrations are forward-only. There is no destructive down migration; compatibility is verified from a fresh database and from the immediately preceding schema contract.
- Apply and validate locally before review:

  ```sh
  pnpm migrations:validate
  pnpm migrations:apply:local
  pnpm migrations:list:local
  pnpm d1:validate:local
  ```

- For staging, use the explicit database name and environment after the resource exists:

  ```sh
  pnpm exec wrangler d1 migrations list matthematical-kalma-staging --remote --env staging
  pnpm exec wrangler d1 migrations apply matthematical-kalma-staging --remote --env staging
  pnpm exec wrangler d1 execute matthematical-kalma-staging --remote --env staging --command "PRAGMA foreign_key_check"
  pnpm exec wrangler d1 execute matthematical-kalma-staging --remote --env staging --command "SELECT singleton_id, schema_contract_version FROM platform_schema_metadata"
  ```

Production migration commands are deliberately not automated yet. They require confirmed Cloudflare administrator 2FA and recovery, protected GitHub deployment environments, a D1 Time Travel bookmark, explicit approval, and post-apply foreign-key/schema-read/reconciliation checks. Wrangler/D1 rejects `PRAGMA integrity_check` through its SQL authorizer; use an approved export-and-SQLite verification procedure if a full file-level integrity check is required.
