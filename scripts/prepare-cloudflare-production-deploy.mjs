import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PRODUCTION = Object.freeze({
  workerName: 'matthematical-kalma-production',
  databaseName: 'matthematical-kalma-production',
  githubEnvironment: 'matthematical-kalma-production',
  appEnvironment: 'production',
  buildScript: 'build:production',
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveProductionTarget(targetName) {
  if (targetName !== 'production') {
    throw new Error('Deployment target must be exactly production.');
  }
  return PRODUCTION;
}

export function createProductionDeploymentConfig(sourceConfig, targetName, databaseId, paths = {}) {
  const target = resolveProductionTarget(targetName);
  if (!UUID_PATTERN.test(databaseId ?? '')) {
    throw new Error('CLOUDFLARE_D1_DATABASE_ID is missing or malformed.');
  }
  if (sourceConfig.name !== target.workerName) {
    throw new Error(`Refusing unexpected Worker name: ${sourceConfig.name ?? '<missing>'}`);
  }
  if (sourceConfig.workers_dev !== true || sourceConfig.preview_urls !== false) {
    throw new Error('Production preparation requires workers.dev and disables preview URLs.');
  }
  if ('routes' in sourceConfig || 'route' in sourceConfig || 'custom_domain' in sourceConfig) {
    throw new Error('Production deployment must not define routes or custom domains.');
  }
  if (sourceConfig.vars?.APP_ENVIRONMENT !== target.appEnvironment) {
    throw new Error('Generated APP_ENVIRONMENT must be exactly production.');
  }
  if (sourceConfig.assets?.binding !== 'ASSETS' || !sourceConfig.assets?.directory) {
    throw new Error('Generated Worker is missing the required Static Assets binding.');
  }
  if (!Array.isArray(sourceConfig.d1_databases) || sourceConfig.d1_databases.length !== 1) {
    throw new Error('Generated Worker must have exactly one D1 binding.');
  }
  const [database] = sourceConfig.d1_databases;
  if (database.binding !== 'DB' || database.database_name !== target.databaseName) {
    throw new Error('Generated D1 binding is outside the production allowlist.');
  }

  const inputDirectory = path.dirname(path.resolve(paths.inputPath ?? 'dist/server/wrangler.json'));
  const outputDirectory = path.dirname(path.resolve(paths.outputPath ?? '.wrangler/deploy/wrangler.production.json'));
  const relativeToOutput = (sourcePath) => {
    const relativePath = path.relative(outputDirectory, path.resolve(inputDirectory, sourcePath));
    return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
  };

  return {
    ...sourceConfig,
    main: relativeToOutput(sourceConfig.main),
    assets: { ...sourceConfig.assets, directory: relativeToOutput(sourceConfig.assets.directory) },
    d1_databases: [{
      ...database,
      database_id: databaseId,
      migrations_dir: relativeToOutput(path.relative(inputDirectory, path.resolve(database.migrations_dir))),
    }],
  };
}

function parseArguments(arguments_) {
  const values = {};
  for (let index = 0; index < arguments_.length; index += 2) {
    const key = arguments_[index];
    const value = arguments_[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error('Arguments must be supplied as --name value pairs.');
    values[key.slice(2)] = value;
  }
  return values;
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const target = resolveProductionTarget(arguments_.target);
  if (arguments_['github-output']) {
    const output = [
      `github_environment=${target.githubEnvironment}`,
      `worker_name=${target.workerName}`,
      `database_name=${target.databaseName}`,
      `app_environment=${target.appEnvironment}`,
      `build_script=${target.buildScript}`,
    ].join('\n');
    await writeFile(arguments_['github-output'], `${output}\n`, { flag: 'a' });
  }
  if (arguments_['validate-only'] === 'true') return;

  const inputPath = path.resolve(arguments_.input ?? 'dist/server/wrangler.json');
  const outputPath = path.resolve(arguments_.output ?? '.wrangler/deploy/wrangler.production.json');
  const sourceConfig = JSON.parse(await readFile(inputPath, 'utf8'));
  const deploymentConfig = createProductionDeploymentConfig(sourceConfig, arguments_.target, arguments_['database-id'], { inputPath, outputPath });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(deploymentConfig, null, 2)}\n`, { mode: 0o600 });
  console.log('Prepared allowlisted production deployment configuration.');
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) await main();
