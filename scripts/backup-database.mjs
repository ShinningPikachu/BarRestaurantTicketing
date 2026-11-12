import { createHash } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { PrismaClient } from '@prisma/client';

const repoRoot = resolve(import.meta.dirname, '..');
const input = process.argv.find((arg) => arg.startsWith('--dir='))?.slice('--dir='.length)
  || process.env.POS_BACKUP_DIR;
if (!input || !isAbsolute(input)) {
  throw new Error('Provide an existing absolute backup folder with --dir=/external/backups or POS_BACKUP_DIR.');
}
const destination = resolve(input);
const relativePath = relative(repoRoot, destination);
if (!relativePath.startsWith('..' + sep) && relativePath !== '..' || !existsSync(destination) || !statSync(destination).isDirectory()) {
  throw new Error('Backup folder must be an existing directory outside the application directory.');
}
const source = resolve(repoRoot, 'packages/backend/prisma/dev.db');
if (!existsSync(source)) throw new Error('Operational SQLite database does not exist.');

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const filename = resolve(destination, `BarRestaurantTicketing-${stamp}-${process.pid}.db`);
if (existsSync(filename)) throw new Error('Backup destination already exists.');
const client = new PrismaClient();

try {
  // SQLite creates a consistent database snapshot while sales may continue.
  // Never copy only the main file when a WAL or rollback journal could be live.
  await client.$executeRawUnsafe(`VACUUM INTO '${filename.replaceAll("'", "''")}'`);
  chmodSync(filename, 0o600);
  const verify = new PrismaClient({ datasources: { db: { url: `file:${filename}` } } });
  try {
    const health = await verify.$queryRawUnsafe('PRAGMA integrity_check');
    if (!Array.isArray(health) || !health.some((row) => Object.values(row).includes('ok'))) {
      throw new Error('Backup SQLite integrity check failed.');
    }
    const foreignKeys = await verify.$queryRawUnsafe('PRAGMA foreign_key_check');
    if (!Array.isArray(foreignKeys) || foreignKeys.length) throw new Error('Backup foreign key check failed.');
  } finally {
    await verify.$disconnect();
  }
  const bytes = readFileSync(filename);
  console.log(JSON.stringify({
    file: filename, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }));
} catch (error) {
  rmSync(filename, { force: true });
  throw error;
} finally {
  await client.$disconnect();
}
