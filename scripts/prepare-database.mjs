import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  chmodSync,
  constants,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const prismaDir = resolve(repoRoot, 'packages/backend/prisma');
const migrationsDir = resolve(prismaDir, 'migrations');
const schemaPath = resolve(prismaDir, 'schema.prisma');
const databasePath = resolve(prismaDir, 'dev.db');
const backupsDir = resolve(prismaDir, 'backups');
const prismaCommand = resolve(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const initializeNewDatabase = process.argv.includes('--initialize-new-database');

function run(command, args, label, environment = process.env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: environment,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${label} failed${signal ? ` after ${signal}` : ` with exit code ${code ?? 'unknown'}`}`));
    });
  });
}

function removeDatabaseSidecars(filePath = databasePath) {
  for (const suffix of ['-journal', '-wal', '-shm']) {
    rmSync(`${filePath}${suffix}`, { force: true });
  }
}

function protectDatabaseFile(filePath) {
  try {
    chmodSync(filePath, 0o600);
  } catch (error) {
    if (process.platform !== 'win32') throw error;
  }
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

async function openDatabase(filePath) {
  const { PrismaClient } = await import('@prisma/client');
  const client = new PrismaClient({
    datasources: { db: { url: `file:${filePath}` } },
  });
  await client.$connect();
  return client;
}

async function validateDatabase(filePath, { checkpoint = false } = {}) {
  const client = await openDatabase(filePath);
  try {
    if (checkpoint) {
      const checkpointRows = await client.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)');
      const checkpointResult = Array.isArray(checkpointRows) ? checkpointRows[0] : undefined;
      const values = checkpointResult && typeof checkpointResult === 'object'
        ? Object.values(checkpointResult).map(Number)
        : [];
      if (values.length < 3 || values[0] !== 0 || values[2] < values[1]) {
        throw new Error('SQLite WAL checkpoint did not complete; stop every application process before migration');
      }
    }

    const integrityRows = await client.$queryRawUnsafe('PRAGMA integrity_check(1)');
    const integrityOk = Array.isArray(integrityRows)
      && integrityRows.some((row) => row && typeof row === 'object' && Object.values(row).includes('ok'));
    if (!integrityOk) {
      throw new Error(`SQLite integrity_check failed for ${filePath}`);
    }

    const foreignKeyRows = await client.$queryRawUnsafe('PRAGMA foreign_key_check');
    if (!Array.isArray(foreignKeyRows) || foreignKeyRows.length > 0) {
      throw new Error(`SQLite foreign_key_check failed for ${filePath}`);
    }
  } finally {
    await client.$disconnect();
  }
}

async function recoverAndValidateDatabase() {
  await validateDatabase(databasePath, { checkpoint: true });
  // A successful connection recovers a hot rollback journal. A completed WAL
  // checkpoint makes the main file self-contained before any copy is taken.
  removeDatabaseSidecars();
}

function migrationNames() {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(migrationsDir, entry.name, 'migration.sql')))
    .map((entry) => entry.name)
    .sort();
}

async function pendingMigrations() {
  const client = await openDatabase(databasePath);
  try {
    const tables = await client.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations'",
    );
    if (!Array.isArray(tables) || tables.length === 0) return migrationNames();

    const rows = await client.$queryRawUnsafe(
      'SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations',
    );
    const failed = rows.filter((row) => !row.finished_at && !row.rolled_back_at);
    if (failed.length > 0) {
      throw new Error(
        `Database contains an unfinished migration (${failed.map((row) => row.migration_name).join(', ')}); investigate it before retrying.`,
      );
    }
    const applied = new Set(
      rows.filter((row) => row.finished_at && !row.rolled_back_at).map((row) => row.migration_name),
    );
    return migrationNames().filter((name) => !applied.has(name));
  } finally {
    await client.$disconnect();
  }
}

function requestedBackupOutput() {
  const equalsArgument = process.argv.find((argument) => argument.startsWith('--backup-output='));
  if (equalsArgument) return equalsArgument.slice('--backup-output='.length).trim();
  const argumentIndex = process.argv.indexOf('--backup-output');
  if (argumentIndex >= 0) return process.argv[argumentIndex + 1]?.trim() || '';
  return process.env.BAR_TICKETING_BACKUP_OUTPUT?.trim() || '';
}

function validateBackupOutput(value) {
  if (!value) {
    throw new Error(
      'Pending migrations require a verified external backup. Retry with: npm run db:migrate:deploy -- --backup-output=/absolute/path/dev-before-upgrade.db',
    );
  }
  if (!isAbsolute(value)) throw new Error('--backup-output must be an absolute path');

  const backupPath = resolve(value);
  const pathFromRepository = relative(repoRoot, backupPath);
  if (pathFromRepository === '' || (!pathFromRepository.startsWith('..') && !isAbsolute(pathFromRepository))) {
    throw new Error('--backup-output must be outside the application/repository directory');
  }
  if (existsSync(backupPath)) throw new Error(`Refusing to overwrite existing backup: ${backupPath}`);
  if (!existsSync(dirname(backupPath)) || !statSync(dirname(backupPath)).isDirectory()) {
    throw new Error(`Backup parent directory does not exist: ${dirname(backupPath)}`);
  }
  return backupPath;
}

function makeInternalBackup() {
  mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = resolve(backupsDir, `dev-before-migrate-${stamp}.db`);
  copyFileSync(databasePath, backupPath, constants.COPYFILE_EXCL);
  protectDatabaseFile(backupPath);
  return backupPath;
}

async function makeAndVerifyExternalBackup(outputPath, sourcePath) {
  copyFileSync(sourcePath, outputPath, constants.COPYFILE_EXCL);
  protectDatabaseFile(outputPath);
  if (statSync(sourcePath).size !== statSync(outputPath).size || sha256(sourcePath) !== sha256(outputPath)) {
    throw new Error('External backup verification failed: copied bytes do not match the source database');
  }
  await validateDatabase(outputPath);
}

async function assertMigrationPreconditions(pending) {
  const client = await openDatabase(databasePath);
  try {
    if (pending.includes('20260718120000_backend_integrity')) {
      const invalidTables = await client.$queryRawUnsafe(`
        SELECT id, number, zone
        FROM "Table"
        WHERE number <= 0 OR (zone IS NOT NULL AND zone NOT IN ('outside', 'floor1', 'floor2'))
        ORDER BY id
        LIMIT 20
      `);
      if (invalidTables.length > 0) {
        throw new Error(`Resolve invalid table numbers/zones before migration: ${JSON.stringify(invalidTables)}`);
      }
      const collisions = await client.$queryRawUnsafe(`
        SELECT number, COALESCE(zone, 'outside') AS normalizedZone, COUNT(*) AS rowCount
        FROM "Table"
        GROUP BY number, COALESCE(zone, 'outside')
        HAVING COUNT(*) > 1
        LIMIT 20
      `);
      if (collisions.length > 0) {
        throw new Error(`Resolve table collisions before migration: ${JSON.stringify(collisions, bigintReplacer)}`);
      }
    }

    if (pending.includes('20260718130000_remove_dead_workflow_models')) {
      const duplicateDrafts = await client.$queryRawUnsafe(`
        SELECT tableId, COUNT(*) AS sessionCount
        FROM "PreOrderSession"
        WHERE status = 'draft'
        GROUP BY tableId
        HAVING COUNT(*) > 1
        LIMIT 20
      `);
      if (duplicateDrafts.length > 0) {
        throw new Error(`Resolve duplicate draft sessions before migration: ${JSON.stringify(duplicateDrafts, bigintReplacer)}`);
      }
    }

    if (pending.includes('20260718150000_unique_menu_sku')) {
      const duplicateSkus = await client.$queryRawUnsafe(`
        SELECT sku, COUNT(*) AS itemCount, GROUP_CONCAT(id) AS itemIds
        FROM "MenuItem"
        WHERE sku IS NOT NULL
        GROUP BY sku
        HAVING COUNT(*) > 1
        LIMIT 20
      `);
      if (duplicateSkus.length > 0) {
        throw new Error(`Resolve duplicate menu SKUs before migration: ${JSON.stringify(duplicateSkus, bigintReplacer)}`);
      }
    }
  } finally {
    await client.$disconnect();
  }
}

function bigintReplacer(_key, value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

async function preservationSnapshot(filePath) {
  const client = await openDatabase(filePath);
  try {
    const tableRows = await client.$queryRawUnsafe(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        AND name <> '_prisma_migrations'
      ORDER BY name
    `);
    const rowCounts = {};
    for (const { name } of tableRows) {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) throw new Error(`Unsafe SQLite table name: ${name}`);
      const rows = await client.$queryRawUnsafe(`SELECT COUNT(*) AS rowCount FROM "${name}"`);
      rowCounts[name] = Number(rows[0]?.rowCount ?? -1);
    }

    const aggregates = {};
    const aggregateQueries = {
      Order: 'SELECT COALESCE(SUM(totalCents), 0) AS total FROM "Order"',
      OrderItem: 'SELECT COALESCE(SUM(qty), 0) AS qty, COALESCE(SUM(totalPriceCents), 0) AS total FROM "OrderItem"',
      MenuItem: 'SELECT COALESCE(SUM(priceCents), 0) AS price, COALESCE(SUM(COALESCE(costCents, 0)), 0) AS cost FROM "MenuItem"',
      Payment: 'SELECT COALESCE(SUM(amountCents), 0) AS total FROM "Payment"',
      PaidTicket: 'SELECT COALESCE(SUM(totalCents), 0) AS total, COALESCE(SUM(vatCents), 0) AS vat FROM "PaidTicket"',
      PaidTicketItem: 'SELECT COALESCE(SUM(qty), 0) AS qty, COALESCE(SUM(totalPriceCents), 0) AS total FROM "PaidTicketItem"',
      PreOrderItem: 'SELECT COALESCE(SUM(qty), 0) AS qty, COALESCE(SUM(totalPriceCents), 0) AS total FROM "PreOrderItem"',
    };
    for (const [tableName, query] of Object.entries(aggregateQueries)) {
      if (Object.hasOwn(rowCounts, tableName)) {
        aggregates[tableName] = await client.$queryRawUnsafe(query);
      }
    }
    return JSON.parse(JSON.stringify({ rowCounts, aggregates }, bigintReplacer));
  } finally {
    await client.$disconnect();
  }
}

function assertPreserved(before, after, label) {
  for (const [tableName, rowCount] of Object.entries(before.rowCounts)) {
    if (!Object.hasOwn(after.rowCounts, tableName)) {
      throw new Error(`${label} removed existing table ${tableName}`);
    }
    if (after.rowCounts[tableName] !== rowCount) {
      throw new Error(`${label} changed ${tableName} row count from ${rowCount} to ${after.rowCounts[tableName]}`);
    }
  }
  if (JSON.stringify(before.aggregates) !== JSON.stringify(after.aggregates)) {
    throw new Error(`${label} changed protected quantity or financial aggregates`);
  }
}

async function testMigrationsOnRestoredCopy(sourcePath, beforeSnapshot) {
  const stagingRoot = mkdtempSync(join(tmpdir(), 'bar-ticketing-migration-test-'));
  const stagingPrismaDir = join(stagingRoot, 'prisma');
  const stagingDatabasePath = join(stagingPrismaDir, 'dev.db');
  try {
    mkdirSync(stagingPrismaDir, { recursive: true });
    cpSync(migrationsDir, join(stagingPrismaDir, 'migrations'), { recursive: true });
    copyFileSync(schemaPath, join(stagingPrismaDir, 'schema.prisma'));
    copyFileSync(sourcePath, stagingDatabasePath);

    await run(
      prismaCommand,
      ['migrate', 'deploy', '--schema', join(stagingPrismaDir, 'schema.prisma')],
      'Restored-copy migration test',
    );
    await validateDatabase(stagingDatabasePath);
    const afterSnapshot = await preservationSnapshot(stagingDatabasePath);
    assertPreserved(beforeSnapshot, afterSnapshot, 'Restored-copy migration test');
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

const databaseExisted = existsSync(databasePath) && statSync(databasePath).size > 0;
let internalBackupPath;
let externalBackupPath;
try {
  console.log('Preparing Prisma client...');
  await run(npmCommand, ['run', '-w', 'backend', 'prisma:generate'], 'Prisma client generation');

  let pending = migrationNames();
  let beforeSnapshot;
  if (databaseExisted) {
    console.log('Recovering and validating the existing SQLite database...');
    await recoverAndValidateDatabase();
    pending = await pendingMigrations();

    if (pending.length > 0) {
      console.log(`Pending migrations: ${pending.join(', ')}`);
      await assertMigrationPreconditions(pending);
      beforeSnapshot = await preservationSnapshot(databasePath);
      externalBackupPath = validateBackupOutput(requestedBackupOutput());
      internalBackupPath = makeInternalBackup();
      await makeAndVerifyExternalBackup(externalBackupPath, internalBackupPath);
      console.log(`Verified external backup: ${externalBackupPath}`);
      console.log('Testing migrations against a restored temporary copy...');
      await testMigrationsOnRestoredCopy(internalBackupPath, beforeSnapshot);
      console.log('Restored-copy migration test passed.');
    }
  }

  console.log('Applying committed database migrations...');
  if (!databaseExisted && !existsSync(databasePath)) {
    writeFileSync(databasePath, '', { flag: 'wx', mode: 0o600 });
  }
  await run(
    prismaCommand,
    ['migrate', 'deploy', '--schema', relative(repoRoot, schemaPath)],
    'Database migration',
  );

  if (initializeNewDatabase) {
    console.log('Running explicitly requested empty-database menu initialization...');
    await run(
      npmCommand,
      ['run', '-w', 'backend', 'seed'],
      'Database seed',
      { ...process.env, BAR_TICKETING_ALLOW_INITIAL_SEED: '1' },
    );
  }

  await validateDatabase(databasePath);
  if (beforeSnapshot) {
    const afterSnapshot = await preservationSnapshot(databasePath);
    assertPreserved(beforeSnapshot, afterSnapshot, 'Production migration');
  }
  protectDatabaseFile(databasePath);
  if (internalBackupPath) console.log(`Guarded local backup: ${relative(repoRoot, internalBackupPath)}`);
  console.log('Local database is ready.');
} catch (error) {
  if (internalBackupPath) {
    removeDatabaseSidecars();
    copyFileSync(internalBackupPath, databasePath);
    protectDatabaseFile(databasePath);
    console.error(`Database preparation failed; restored ${relative(repoRoot, internalBackupPath)}.`);
  } else if (!databaseExisted) {
    removeDatabaseSidecars();
    rmSync(databasePath, { force: true });
    console.error('Database preparation failed; removed the incomplete new database.');
  } else {
    console.error('Database preparation stopped before migration; the existing database was left in place.');
  }
  if (externalBackupPath && existsSync(externalBackupPath)) {
    console.error(`Verified external backup retained at ${externalBackupPath}.`);
  }
  throw error;
}
