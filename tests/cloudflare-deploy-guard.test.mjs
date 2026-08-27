import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDeploymentConfig,
  resolveTarget,
} from '../scripts/prepare-cloudflare-deploy.mjs';

const databaseId = '11111111-1111-4111-8111-111111111111';

function sourceConfig(name = 'matthematical-kalma-dev', databaseName = name) {
  return {
    name,
    workers_dev: true,
    vars: { APP_ENVIRONMENT: name.endsWith('-dev') ? 'development' : 'staging' },
    assets: { binding: 'ASSETS', directory: '../client' },
    d1_databases: [{ binding: 'DB', database_name: databaseName, migrations_dir: 'migrations' }],
  };
}

test('allowlists only development and staging targets', () => {
  assert.equal(resolveTarget('development').workerName, 'matthematical-kalma-dev');
  assert.equal(resolveTarget('staging').workerName, 'matthematical-kalma-staging');
  for (const invalid of ['', 'production', 'dev', 'matthematical-kalma-production']) {
    assert.throws(() => resolveTarget(invalid), /exactly development or staging/);
  }
});

test('injects only a valid environment-scoped D1 identifier', () => {
  const result = createDeploymentConfig(sourceConfig(), 'development', databaseId);
  assert.equal(result.d1_databases[0].database_id, databaseId);
  assert.equal(result.d1_databases[0].binding, 'DB');
});

test('fails closed for missing credentials, unexpected resources, routes, and bindings', () => {
  assert.throws(() => createDeploymentConfig(sourceConfig(), 'development', ''), /missing or malformed/);
  assert.throws(
    () => createDeploymentConfig(sourceConfig('matthematical-kalma-production'), 'development', databaseId),
    /unexpected Worker name/,
  );
  assert.throws(
    () => createDeploymentConfig(sourceConfig('matthematical-kalma-dev', 'other-db'), 'development', databaseId),
    /outside the approved target allowlist/,
  );
  assert.throws(
    () => createDeploymentConfig({ ...sourceConfig(), routes: ['example.com/*'] }, 'development', databaseId),
    /must not define routes/,
  );
  assert.throws(
    () => createDeploymentConfig({ ...sourceConfig(), assets: undefined }, 'development', databaseId),
    /Static Assets binding/,
  );
});

