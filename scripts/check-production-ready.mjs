import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { assertProductionBuildCurrent } from './production-manifest.mjs';
import { auditMigrationHistoryRows, migrationChecksums } from './migration-history.mjs';

assertProductionBuildCurrent();
const prismaDir = resolve('packages/backend/prisma');
if (!existsSync(resolve(prismaDir, 'dev.db'))) {
  throw new Error('Operational SQLite database is missing. Run the installer to initialize it.');
}

const client = new PrismaClient();
try {
  const rows = await client.$queryRawUnsafe(
    'SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"'
  );
  const checksums = migrationChecksums(resolve(prismaDir, 'migrations'));
  const audit = auditMigrationHistoryRows(rows, checksums);
  const pending = [...checksums.keys()].filter((name) => !audit.applied.has(name));
  if (pending.length) {
    throw new Error(`Database has ${pending.length} pending migration(s). Run the guarded installer and create an external backup before upgrading.`);
  }
  const integrity = await client.$queryRawUnsafe('PRAGMA quick_check(1)');
  if (!Array.isArray(integrity) || !integrity.some((row) => Object.values(row).includes('ok'))) {
    throw new Error('SQLite quick_check failed; investigate the database before serving customers.');
  }
  const invalidReferences = await client.$queryRawUnsafe('PRAGMA foreign_key_check');
  if (!Array.isArray(invalidReferences) || invalidReferences.length > 0) {
    throw new Error('SQLite foreign_key_check failed.');
  }
  console.log('Production assets and database are current; no installation or migration required.');
} finally {
  await client.$disconnect();
}
