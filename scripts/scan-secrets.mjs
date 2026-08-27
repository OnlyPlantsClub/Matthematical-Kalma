import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((file) => !file.endsWith('pnpm-lock.yaml'));

const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Cloudflare API token', /\b(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN)\s*[=:]\s*['"]?[A-Za-z0-9_-]{20,}/],
  ['GitHub token', /\bgh[opsu]_[A-Za-z0-9]{30,}\b/],
  ['generic bearer token', /\bAuthorization\s*[=:]\s*['"]?Bearer\s+[A-Za-z0-9._-]{24,}/i],
];

const findings = [];

for (const file of trackedFiles) {
  const extension = path.extname(file);
  if (!['', '.cjs', '.js', '.json', '.jsonc', '.md', '.mjs', '.sql', '.ts', '.tsx', '.yaml', '.yml'].includes(extension)) {
    continue;
  }

  const content = await readFile(file, 'utf8');
  for (const [label, pattern] of patterns) {
    if (pattern.test(content)) findings.push(`${file}: ${label}`);
  }
}

if (findings.length > 0) {
  throw new Error(`Potential secrets found:\n${findings.join('\n')}`);
}

console.log(`Secret scan passed for ${trackedFiles.length} tracked file(s).`);
