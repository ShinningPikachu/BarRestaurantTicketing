import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTicketTax } from '../src/domain/workflow/tax.ts';
import { workflowRepository } from '../src/domain/workflow/workflow.repository.ts';
import { workflowService } from '../src/domain/workflow/workflow.service.ts';
import { createTestDatabase } from './test-database.ts';
import type { PrismaClient } from '@prisma/client';

test('mixed VAT bands preserve integer-cent totals', () => {
  const result = calculateTicketTax([
    { totalPriceCents: 1100, vatRatePercent: 10 },
    { totalPriceCents: 1210, vatRatePercent: 21 },
  ], 10);
  assert.equal(result.taxableBaseCents, 2000);
  assert.equal(result.vatCents, 310);
  assert.equal(result.vatRatePercent, 0);
  assert.deepEqual(JSON.parse(result.taxBreakdownJson).map((band: { ratePercent: number }) => band.ratePercent), [10, 21]);
});

test('VAT snapshots remain attached to the order when menu changes before payment', async () => {
  const database = await createTestDatabase();
  const bound = workflowRepository as unknown as { client: PrismaClient };
  const previous = bound.client;
  bound.client = database.client;
  try {
    await database.client.table.create({ data: { number: 36, zone: 'outside' } });
    const low = await database.client.menuItem.create({
      data: { name: 'Food', category: 'Food', priceCents: 1100, vatRatePercent: 10 },
    });
    const high = await database.client.menuItem.create({
      data: { name: 'Drink', category: 'Drinks', priceCents: 1210, vatRatePercent: 21 },
    });
    await workflowService.addPreOrderMenuItem(36, 'outside', low.id);
    await workflowService.addPreOrderMenuItem(36, 'outside', high.id);
    await workflowService.sendToKitchen(36, 'outside');
    await database.client.menuItem.update({ where: { id: high.id }, data: { vatRatePercent: 10 } });
    const paid = await workflowService.payTable(36, 'outside', 'cash', 'vat-regression-0001');
    assert.equal(paid.paidTicket.totalCents, 2310);
    assert.equal(paid.paidTicket.taxableBaseCents, 2000);
    assert.equal(paid.paidTicket.vatCents, 310);
    assert.deepEqual(paid.paidTicket.items.map((item) => item.vatRatePercent).sort(), [10, 21]);
    assert.equal(JSON.parse(paid.paidTicket.taxBreakdownJson ?? '[]').length, 2);
  } finally {
    bound.client = previous;
    await database.cleanup();
  }
});
