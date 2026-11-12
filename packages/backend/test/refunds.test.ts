import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { workflowRepository } from '../src/domain/workflow/workflow.repository.ts';
import { workflowService } from '../src/domain/workflow/workflow.service.ts';
import { createTestDatabase } from './test-database.ts';

async function makePaidTicket(db: PrismaClient, number: number, method: 'cash' | 'card') {
  const table = await db.table.create({ data: { number, zone: 'outside' } });
  await db.order.create({
    data: {
      tableId: table.id, status: 'confirmed', totalCents: 1100,
      items: { create: {
        name: 'Coffee', qty: 2, unitPriceCents: 550, totalPriceCents: 1100,
        vatRatePercent: 10,
      } },
    },
  });
  return workflowService.payTable(number, 'outside', method, `pay-test-${number}-00001`);
}

test('full cash refund generates immutable negative correction, preserves original, and is idempotent', async () => {
  const db = await createTestDatabase();
  const bound = workflowRepository as unknown as { client: PrismaClient };
  const originalClient = bound.client;
  bound.client = db.client;
  try {
    const paid = await makePaidTicket(db.client, 80, 'cash');
    const id = paid.paidTicket.id;
    const first = await workflowService.refundPaidTicket(id, 'Customer request', 'refund-test-00001');
    const second = await workflowService.refundPaidTicket(id, 'Customer request', 'refund-test-00001');
    assert.equal(first.paidTicket.id, second.paidTicket.id);
    assert.equal(first.paidTicket.totalCents, -1100);
    assert.equal(first.paidTicket.vatCents, -100);
    assert.equal(first.paidTicket.mode, 'refund');
    assert.equal(first.paidTicket.status, 'correction');
    assert.equal(first.paidTicket.relatedTicketNumber, paid.paidTicket.ticketNumber);
    assert.equal((await db.client.paidTicket.findUniqueOrThrow({ where: { id } })).status, 'refunded');
    assert.equal(await db.client.paidTicket.count(), 2);
    const entries = await db.client.payment.findMany();
    assert.equal(entries.length, 2);
    assert.equal(entries.reduce((sum, row) => sum + row.amountCents, 0), 0);
    await assert.rejects(workflowService.refundPaidTicket(id, 'Another refund', 'refund-test-00002'));
  } finally {
    bound.client = originalClient;
    await db.cleanup();
  }
});

test('card refunds require explicit external terminal confirmation', async () => {
  const db = await createTestDatabase();
  const bound = workflowRepository as unknown as { client: PrismaClient };
  const originalClient = bound.client;
  bound.client = db.client;
  try {
    const paid = await makePaidTicket(db.client, 81, 'card');
    await assert.rejects(
      workflowService.refundPaidTicket(paid.paidTicket.id, 'Card return', 'refund-card-0001'),
      (error: any) => error?.code === 'CARD_REFUND_NOT_CONFIRMED',
    );
    assert.equal(await db.client.paidTicket.count(), 1);
    const corrected = await workflowService.refundPaidTicket(
      paid.paidTicket.id, 'Card return', 'refund-card-0001', true
    );
    assert.equal(corrected.paidTicket.totalCents, -1100);
  } finally {
    bound.client = originalClient;
    await db.cleanup();
  }
});
