import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));

test('uses the approved Worker and D1 names in every environment', () => {
  const environments = [
    [config, 'matthematical-kalma-dev'],
    [config.env.staging, 'matthematical-kalma-staging'],
    [config.env.production, 'matthematical-kalma-production'],
  ];

  for (const [environment, expectedName] of environments) {
    assert.equal(environment.name, expectedName);
    assert.equal(environment.d1_databases.length, 1);
    assert.equal(environment.d1_databases[0].binding, 'DB');
    assert.equal(environment.d1_databases[0].database_name, expectedName);
    assert.equal(environment.d1_databases[0].migrations_dir, 'migrations');
    assert.equal('database_id' in environment.d1_databases[0], false);
  }
});

test('configures Static Assets and permits only the temporary production workers.dev address', () => {
  assert.equal(config.assets.binding, 'ASSETS');
  assert.deepEqual(config.assets.run_worker_first, ['/api/*']);
  assert.equal(config.env.production.workers_dev, true);
  assert.equal(config.env.production.preview_urls, false);
  assert.equal('routes' in config.env.production, false);
});
