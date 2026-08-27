import assert from 'node:assert/strict';
import test from 'node:test';

import { createProductionDeploymentConfig, resolveProductionTarget } from '../scripts/prepare-cloudflare-production-deploy.mjs';

const databaseId = '11111111-1111-4111-8111-111111111111';
const sourceConfig = () => ({
  name: 'matthematical-kalma-production',
  main: 'index.js',
  workers_dev: true,
  preview_urls: false,
  vars: { APP_ENVIRONMENT: 'production' },
  assets: { binding: 'ASSETS', directory: '../client' },
  d1_databases: [{ binding: 'DB', database_name: 'matthematical-kalma-production', migrations_dir: 'migrations' }],
});

test('allowlists only the exact production target and resources', () => {
  assert.equal(resolveProductionTarget('production').workerName, 'matthematical-kalma-production');
  for (const invalid of ['', 'development', 'staging', 'matthematical-kalma-production']) {
    assert.throws(() => resolveProductionTarget(invalid), /exactly production/);
  }
});

test('injects only a valid environment-scoped D1 identifier', () => {
  const result = createProductionDeploymentConfig(sourceConfig(), 'production', databaseId, {
    inputPath: 'dist/server/wrangler.json', outputPath: '.wrangler/deploy/wrangler.production.json',
  });
  assert.equal(result.name, 'matthematical-kalma-production');
  assert.equal(result.d1_databases[0].database_name, 'matthematical-kalma-production');
  assert.equal(result.d1_databases[0].database_id, databaseId);
  assert.equal(result.assets.binding, 'ASSETS');
});

test('fails closed for malformed configuration and routing', () => {
  assert.throws(() => createProductionDeploymentConfig(sourceConfig(), 'production', ''), /missing or malformed/);
  assert.throws(() => createProductionDeploymentConfig({ ...sourceConfig(), name: 'other' }, 'production', databaseId), /unexpected Worker/);
  assert.throws(() => createProductionDeploymentConfig({ ...sourceConfig(), routes: ['example.com/*'] }, 'production', databaseId), /routes or custom domains/);
  assert.throws(() => createProductionDeploymentConfig({ ...sourceConfig(), workers_dev: false }, 'production', databaseId), /requires workers.dev/);
  assert.throws(() => createProductionDeploymentConfig({ ...sourceConfig(), d1_databases: [] }, 'production', databaseId), /exactly one D1/);
  assert.throws(() => createProductionDeploymentConfig({ ...sourceConfig(), assets: undefined }, 'production', databaseId), /Static Assets/);
});
