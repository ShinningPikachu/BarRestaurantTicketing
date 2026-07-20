import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { workflowRepository } from '../src/domain/workflow/workflow.repository.ts';
import { workflowService } from '../src/domain/workflow/workflow.service.ts';
import { ApiError } from '../src/middleware/errorHandler.ts';
import { MenuService } from '../src/services/menu.service.ts';
import { createTestDatabase } from './test-database.ts';

async function createConfirmedOrder(client: PrismaClient, tableNumber: number, name: string) {
  const table = await client.table.create({
    data: { number: tableNumber, zone: 'outside' },
  });
  const order = await client.order.create({
    data: {
      tableId: table.id,
      status: 'confirmed',
      totalCents: 1_500,
      items: {
        create: {
          name,
          qty: 2,
          unitPriceCents: 750,
          totalPriceCents: 1_500,
        },
      },
    },
    include: { items: true },
  });
  return { table, order };
}

test('payment retries are idempotent, fingerprint-bound, and use a durable sequence', async () => {
  const database = await createTestDatabase();
  const repositoryWithMutableClient = workflowRepository as unknown as { client: PrismaClient };
  const originalClient = repositoryWithMutableClient.client;
  repositoryWithMutableClient.client = database.client;

  try {
    await createConfirmedOrder(database.client, 1, 'First meal');

    const [first, retry] = await Promise.all([
      workflowService.payTable(1, 'outside', 'cash', 'payment-retry-key-0001'),
      workflowService.payTable(1, 'outside', 'cash', 'payment-retry-key-0001'),
    ]);

    assert.equal(first.paidTicket.id, retry.paidTicket.id);
    assert.equal(first.paidTicket.ticketNumber, 'PT-000001');
    assert.equal('idempotencyKey' in first.paidTicket, false);
    assert.equal('idempotencyFingerprint' in first.paidTicket, false);
    assert.equal(await database.client.paidTicket.count(), 1);
    assert.equal(await database.client.payment.count(), 1);
    assert.equal((await database.client.ticketSequence.findUniqueOrThrow({ where: { series: 'PT' } })).value, 1);

    await assert.rejects(
      workflowService.payTable(1, 'outside', 'card', 'payment-retry-key-0001'),
      (error: unknown) => error instanceof ApiError
        && error.statusCode === 409
        && error.code === 'IDEMPOTENCY_KEY_REUSED'
    );

    await database.client.paidTicket.delete({ where: { id: first.paidTicket.id } });
    await createConfirmedOrder(database.client, 2, 'Second meal');
    const second = await workflowService.payTable(2, 'outside', 'card', 'payment-retry-key-0002');

    assert.equal(second.paidTicket.ticketNumber, 'PT-000002');
    assert.equal(await database.client.paidTicket.count(), 1);
    assert.equal((await database.client.ticketSequence.findUniqueOrThrow({ where: { series: 'PT' } })).value, 2);
  } finally {
    repositoryWithMutableClient.client = originalClient;
    await database.cleanup();
  }
});

test('menu import rolls back all rows if a later database operation fails', async () => {
  const database = await createTestDatabase();
  try {
    await database.client.$executeRawUnsafe(`
      CREATE TRIGGER reject_test_menu_item
      BEFORE INSERT ON "MenuItem"
      WHEN NEW."name" = 'FAIL'
      BEGIN
        SELECT RAISE(ABORT, 'forced import failure');
      END
    `);
    const service = new MenuService(database.client);

    await assert.rejects(service.importMenuItems([
      { name: 'Would otherwise persist', priceCents: 500, category: 'Food' },
      { name: 'FAIL', priceCents: 600, category: 'Food' },
    ]));

    assert.equal(await database.client.menuItem.count(), 0);
  } finally {
    await database.cleanup();
  }
});

test('menu SKU identity is unique and imports update the single matching product', async () => {
  const database = await createTestDatabase();
  const service = new MenuService(database.client);
  try {
    await service.createMenuItem({
      name: 'Original',
      category: 'Food',
      priceCents: 500,
      sku: 'SKU-001',
    });

    await assert.rejects(service.createMenuItem({
      name: 'Duplicate',
      category: 'Food',
      priceCents: 600,
      sku: 'SKU-001',
    }));

    const result = await service.importMenuItems([{
      name: 'Updated',
      category: 'Food',
      priceCents: 700,
      sku: 'SKU-001',
    }]);
    assert.deepEqual(result, { created: 0, updated: 1, total: 1 });
    assert.equal(await database.client.menuItem.count({ where: { sku: 'SKU-001' } }), 1);
    assert.equal((await database.client.menuItem.findUniqueOrThrow({ where: { sku: 'SKU-001' } })).name, 'Updated');
  } finally {
    await database.cleanup();
  }
});

test('destructive item removals are idempotent and fingerprint-bound', async () => {
  const database = await createTestDatabase();
  const repositoryWithMutableClient = workflowRepository as unknown as { client: PrismaClient };
  const originalClient = repositoryWithMutableClient.client;
  repositoryWithMutableClient.client = database.client;

  try {
    const { order } = await createConfirmedOrder(database.client, 3, 'Shared plate');
    const item = order.items[0];
    await database.client.orderItem.update({
      where: { id: item.id },
      data: { qty: 10, totalPriceCents: 7_500 },
    });
    await database.client.order.update({ where: { id: order.id }, data: { totalCents: 7_500 } });

    const selection = [{ orderId: order.id, itemId: item.id, qty: 2 }];
    await workflowService.removeSelectedItems(3, 'outside', selection, 'remove-retry-key-0001');
    await workflowService.removeSelectedItems(3, 'outside', selection, 'remove-retry-key-0001');

    const remaining = await database.client.orderItem.findUniqueOrThrow({ where: { id: item.id } });
    assert.equal(remaining.qty, 8);
    assert.equal(remaining.totalPriceCents, 6_000);
    assert.equal(await database.client.mutationReceipt.count(), 1);

    await assert.rejects(
      workflowService.removeSelectedItems(
        3,
        'outside',
        [{ orderId: order.id, itemId: item.id, qty: 1 }],
        'remove-retry-key-0001'
      ),
      (error: unknown) => error instanceof ApiError
        && error.statusCode === 409
        && error.code === 'IDEMPOTENCY_KEY_REUSED'
    );
  } finally {
    repositoryWithMutableClient.client = originalClient;
    await database.cleanup();
  }
});

test('order arithmetic rejects database integer overflow without partial writes', async () => {
  const database = await createTestDatabase();
  const repositoryWithMutableClient = workflowRepository as unknown as { client: PrismaClient };
  const originalClient = repositoryWithMutableClient.client;
  repositoryWithMutableClient.client = database.client;

  try {
    await database.client.table.create({ data: { number: 4, zone: 'outside' } });
    const expensive = await database.client.menuItem.create({
      data: { name: 'Expensive item', category: 'Test', priceCents: 2_000_000_000 },
    });
    const extra = await database.client.menuItem.create({
      data: { name: 'Extra item', category: 'Test', priceCents: 200_000_000 },
    });

    await workflowService.addPreOrderMenuItem(4, 'outside', expensive.id);
    await assert.rejects(
      workflowService.addPreOrderMenuItem(4, 'outside', expensive.id),
      (error: unknown) => error instanceof ApiError
        && error.statusCode === 422
        && error.code === 'ORDER_VALUE_TOO_LARGE'
    );

    await workflowService.addPreOrderMenuItem(4, 'outside', extra.id);
    await assert.rejects(
      workflowService.sendToKitchen(4, 'outside'),
      (error: unknown) => error instanceof ApiError
        && error.statusCode === 422
        && error.code === 'ORDER_VALUE_TOO_LARGE'
    );

    const workflow = await workflowService.getTableWorkflow(4, 'outside');
    assert.deepEqual(workflow.preOrderItems.map((item) => item.qty), [1, 1]);
    assert.equal(workflow.orders.length, 0);
  } finally {
    repositoryWithMutableClient.client = originalClient;
    await database.cleanup();
  }
});

test('concurrent zone initialization creates only one first table', async () => {
  const database = await createTestDatabase();
  const repositoryWithMutableClient = workflowRepository as unknown as { client: PrismaClient };
  const originalClient = repositoryWithMutableClient.client;
  repositoryWithMutableClient.client = database.client;

  try {
    const [first, retry] = await Promise.all([
      workflowService.ensureTableInZone('floor1'),
      workflowService.ensureTableInZone('floor1'),
    ]);
    assert.equal(first.id, retry.id);
    assert.equal(await database.client.table.count({ where: { zone: 'floor1' } }), 1);
  } finally {
    repositoryWithMutableClient.client = originalClient;
    await database.cleanup();
  }
});
