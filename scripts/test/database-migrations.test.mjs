import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';

const prismaBinary = resolve('node_modules/.bin/prisma');
const sourcePrismaDir = resolve('packages/backend/prisma');
const firstReviewedMigration = '20260718120000_backend_integrity';

function copyMigrationTree(directory, includeReviewedMigrations) {
  const prismaDir = join(directory, 'prisma');
  mkdirSync(join(prismaDir, 'migrations'), { recursive: true });
  cpSync(join(sourcePrismaDir, 'schema.prisma'), join(prismaDir, 'schema.prisma'));
  for (const entry of readdirSync(join(sourcePrismaDir, 'migrations'), { withFileTypes: true })) {
    if (!entry.isDirectory() || (!includeReviewedMigrations && entry.name >= firstReviewedMigration)) continue;
    cpSync(
      join(sourcePrismaDir, 'migrations', entry.name),
      join(prismaDir, 'migrations', entry.name),
      { recursive: true },
    );
  }
  cpSync(
    join(sourcePrismaDir, 'migrations', 'migration_lock.toml'),
    join(prismaDir, 'migrations', 'migration_lock.toml'),
  );
  return prismaDir;
}

function runProcess(args, input) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(prismaBinary, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (status, signal) => resolvePromise({ status, signal, stdout, stderr }));
    child.stdin.end(input);
  });
}

async function deploy(prismaDir, expectSuccess = true) {
  const result = await runProcess(
    ['migrate', 'deploy', '--schema', join(prismaDir, 'schema.prisma')],
  );
  if (expectSuccess) {
    assert.equal(
      result.status,
      0,
      result.stderr || result.stdout || `Prisma exited with ${result.status} after ${result.signal || 'no signal'}`,
    );
  }
  else assert.notEqual(result.status, 0, 'migration should stop on ambiguous legacy data');
}

async function execute(databasePath, sql) {
  const client = new PrismaClient({ datasources: { db: { url: `file:${databasePath}` } } });
  try {
    for (const statement of sql.split(';').map((value) => value.trim()).filter(Boolean)) {
      await client.$executeRawUnsafe(statement);
    }
  } finally {
    await client.$disconnect();
  }
}

async function query(databasePath, sql) {
  const client = new PrismaClient({ datasources: { db: { url: `file:${databasePath}` } } });
  try {
    return await client.$queryRawUnsafe(sql);
  } finally {
    await client.$disconnect();
  }
}

test('reviewed migrations preserve legacy workflow and accounting rows', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bar-ticketing-migrations-'));
  try {
    const prismaDir = copyMigrationTree(directory, false);
    const databasePath = join(prismaDir, 'dev.db');
    writeFileSync(databasePath, '');
    await deploy(prismaDir);
    await execute(databasePath, `
      INSERT INTO "Table" (id, number, zone, seats, name) VALUES (1, 1, NULL, 4, 'Legacy table');
      INSERT INTO "MenuItem" (id, name, priceCents, sku, category, available) VALUES (1, 'Coffee', 150, 'COF', 'Drinks', 1);
      INSERT INTO "Order" (id, tableId, status, totalCents, createdAt, updatedAt)
        VALUES ('order-1', 1, 'confirmed', 150, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      INSERT INTO "OrderItem" (id, orderId, menuItemId, name, qty, unitPriceCents, totalPriceCents)
        VALUES (1, 'order-1', 1, 'Coffee', 1, 150, 150);
      INSERT INTO "Payment" (id, orderId, amountCents, method, createdAt)
        VALUES (1, 'order-1', 150, 'cash', CURRENT_TIMESTAMP);
      INSERT INTO "PreOrderSession" (id, tableId, status, createdAt, updatedAt)
        VALUES ('sent-session', 1, 'sent', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      INSERT INTO "PreOrderItem" (id, sessionId, menuItemId, name, qty, unitPriceCents, totalPriceCents)
        VALUES (1, 'sent-session', 1, 'Coffee', 1, 150, 150);
      INSERT INTO "KitchenTicket" (id, orderId, tableId, status, createdAt)
        VALUES ('kitchen-1', 'order-1', 1, 'queued', CURRENT_TIMESTAMP);
      INSERT INTO "KitchenTicketItem" (id, ticketId, menuItemId, name, qty, unitPriceCents, totalPriceCents)
        VALUES (1, 'kitchen-1', 1, 'Coffee', 1, 150, 150);
      INSERT INTO "User" (id, name, role) VALUES (1, 'Legacy user', 'staff');
      INSERT INTO "PaidTicket" (
        id, ticketNumber, mode, method, tableNumber, tableZone, totalCents,
        taxableBaseCents, vatCents, vatRatePercent, createdAt
      ) VALUES ('paid-1', 'PT-000007', 'full', 'cash', 1, 'outside', 150, 136, 14, 10, CURRENT_TIMESTAMP);
      INSERT INTO "PaidTicketItem" (
        id, ticketId, orderId, orderItemId, menuItemId, name, qty, unitPriceCents, totalPriceCents
      ) VALUES (1, 'paid-1', 'order-1', 1, 1, 'Coffee', 1, 150, 150);
    `);
    assert.equal(Number((await query(databasePath, 'SELECT COUNT(*) AS count FROM "Table"'))[0].count), 1);

    copyMigrationTree(directory, true);
    await deploy(prismaDir);

    const tableRows = await query(databasePath, 'SELECT number, zone, name FROM "Table"');
    assert.deepEqual(tableRows, [{ number: 1, zone: 'outside', name: 'Legacy table' }]);
    const retained = await query(databasePath, `
      SELECT
        (SELECT COUNT(*) FROM "PreOrderSession" WHERE status = 'sent') AS sentSessions,
        (SELECT COUNT(*) FROM "PreOrderItem") AS preOrderItems,
        (SELECT COUNT(*) FROM "KitchenTicket") AS kitchenTickets,
        (SELECT COUNT(*) FROM "KitchenTicketItem") AS kitchenTicketItems,
        (SELECT COUNT(*) FROM "User") AS users,
        (SELECT COUNT(*) FROM "PaidTicket") AS paidTickets,
        (SELECT COUNT(*) FROM "PaidTicketItem") AS paidTicketItems,
        (SELECT value FROM "TicketSequence" WHERE series = 'PT') AS ticketSequence
    `);
    assert.deepEqual(
      Object.fromEntries(Object.entries(retained[0]).map(([key, value]) => [key, Number(value)])),
      {
        sentSessions: 1,
        preOrderItems: 1,
        kitchenTickets: 1,
        kitchenTicketItems: 1,
        users: 1,
        paidTickets: 1,
        paidTicketItems: 1,
        ticketSequence: 7,
      },
    );
    assert.deepEqual(await query(databasePath, 'PRAGMA foreign_key_check'), []);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('SKU migration stops without clearing duplicate production values', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bar-ticketing-duplicate-sku-'));
  try {
    const prismaDir = copyMigrationTree(directory, false);
    const databasePath = join(prismaDir, 'dev.db');
    writeFileSync(databasePath, '');
    await deploy(prismaDir);
    await execute(databasePath, `
      INSERT INTO "MenuItem" (id, name, priceCents, sku, category, available)
      VALUES (1, 'First', 100, 'DUP', 'Food', 1), (2, 'Second', 200, 'DUP', 'Food', 1);
    `);
    assert.equal(Number((await query(databasePath, 'SELECT COUNT(*) AS count FROM "MenuItem"'))[0].count), 2);
    copyMigrationTree(directory, true);
    await deploy(prismaDir, false);
    const rows = await query(databasePath, 'SELECT id, sku FROM "MenuItem" ORDER BY id');
    assert.deepEqual(rows, [{ id: 1, sku: 'DUP' }, { id: 2, sku: 'DUP' }]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
