import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { workflowRepository } from '../src/domain/workflow/workflow.repository.ts';
import { workflowService } from '../src/domain/workflow/workflow.service.ts';
import { createTestDatabase } from './test-database.ts';
import { markInterruptedKitchenDispatchesUnknown } from '../src/services/kitchen-dispatch.service.ts';

test('confirming a preorder atomically persists an order and kitchen handoff snapshot', async () => {
  const db = await createTestDatabase();
  const bound = workflowRepository as unknown as { client: PrismaClient };
  const previous = bound.client;
  bound.client = db.client;
  try {
    await db.client.table.create({ data: { number: 95, zone: 'outside' } });
    const item = await db.client.menuItem.create({
      data: { name: 'Soup', priceCents: 790, vatRatePercent: 10, category: 'Food' },
    });
    await workflowService.addPreOrderMenuItem(95, 'outside', item.id);
    const sent = await workflowService.sendToKitchen(95, 'outside');
    const dispatch = await db.client.kitchenDispatch.findUniqueOrThrow({ where: { id: sent.dispatchId } });
    assert.equal(dispatch.status, 'pending');
    assert.equal(dispatch.tableNumber, 95);
    assert.equal(dispatch.tableZone, 'outside');
    assert.deepEqual(JSON.parse(dispatch.linesJson).map((line: { name: string; qty: number }) => [line.name, line.qty]), [['Soup', 1]]);
    const order = await db.client.order.findUniqueOrThrow({ where: { id: dispatch.orderId }, include: { items: true } });
    assert.equal(order.status, 'confirmed');
    assert.equal(order.items[0].unitPriceCents, 790);
    assert.equal(await db.client.preOrderSession.count({ where: { tableId: order.tableId } }), 0);
    await assert.rejects(workflowService.sendToKitchen(95, 'outside'));
    assert.equal(await db.client.kitchenDispatch.count(), 1);
  } finally {
    bound.client = previous;
    await db.cleanup();
  }
});

test('an interrupted kitchen print stays in the unknown state for operator review', async () => {
  const db = await createTestDatabase();
  try {
    const handoff = await db.client.kitchenDispatch.create({
      data: {
        orderId: 'test-order',
        tableNumber: 4,
        tableZone: 'outside',
        linesJson: JSON.stringify([{ name: 'Water', qty: 1 }]),
        status: 'sending',
      },
    });
    assert.equal(await markInterruptedKitchenDispatchesUnknown(db.client), 1);
    const updated = await db.client.kitchenDispatch.findUniqueOrThrow({ where: { id: handoff.id } });
    assert.equal(updated.status, 'unknown');
    assert.equal(updated.lastErrorCode, 'PROCESS_INTERRUPTED');
    assert.equal(await markInterruptedKitchenDispatchesUnknown(db.client), 0);
  } finally {
    await db.cleanup();
  }
});
