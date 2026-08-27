import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const migrationDirectory = path.resolve('migrations');
const entries = await readdir(migrationDirectory, { withFileTypes: true });
const migrationNames = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
  .map((entry) => entry.name)
  .sort();

if (migrationNames.length === 0) {
  throw new Error('At least one ordered D1 migration is required.');
}

const sequenceNumbers = new Set();

for (const [index, migrationName] of migrationNames.entries()) {
  const match = /^(\d{4})_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/.exec(migrationName);
  if (!match) {
    throw new Error(`Invalid migration filename: ${migrationName}`);
  }

  const sequence = Number(match[1]);
  if (sequenceNumbers.has(sequence)) {
    throw new Error(`Duplicate migration sequence: ${match[1]}`);
  }
  sequenceNumbers.add(sequence);

  if (index > 0) {
    const previous = Number(/^\d{4}/.exec(migrationNames[index - 1])[0]);
    if (sequence <= previous) {
      throw new Error('Migration filenames are not strictly ordered.');
    }
  }

  const sql = await readFile(path.join(migrationDirectory, migrationName), 'utf8');
  if (sql.trim().length === 0) {
    throw new Error(`Migration is empty: ${migrationName}`);
  }
  if (/\r\n/.test(sql)) {
    throw new Error(`Migration must use LF line endings: ${migrationName}`);
  }
}

console.log(`Validated ${migrationNames.length} ordered D1 migration(s).`);
