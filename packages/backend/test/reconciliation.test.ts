import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileRecordedTickets } from '../src/services/reconciliation.service.ts';
import { createTestDatabase } from './test-database.ts';

test('audit reconciles saved sale and its full negative correction without double-counting', async () => {
  const db = await createTestDatabase();
  try {
    await db.client.paidTicket.create({
      data: {
        ticketNumber: 'PT-500', mode: 'full', method: 'cash',
        tableNumber: 1, tableZone: 'outside', totalCents: 1100,
        taxableBaseCents: 1000, vatCents: 100, vatRatePercent: 10,
        status: 'refunded', relatedTicketNumber: 'RT-500',
        taxBreakdownJson: JSON.stringify([{ ratePercent: 10, taxableBaseCents: 1000, vatCents: 100, totalCents: 1100 }]),
        items: { create: [{ name: 'Soup', qty: 2, unitPriceCents: 550, totalPriceCents: 1100 }] },
      },
    });
    await db.client.paidTicket.create({
      data: {
        ticketNumber: 'RT-500', mode: 'refund', method: 'cash',
        tableNumber: 1, tableZone: 'outside', totalCents: -1100,
        taxableBaseCents: -1000, vatCents: -100, vatRatePercent: 10,
        status: 'correction', relatedTicketNumber: 'PT-500',
        taxBreakdownJson: JSON.stringify([{ ratePercent: 10, taxableBaseCents: -1000, vatCents: -100, totalCents: -1100 }]),
        items: { create: [{ name: 'Soup', qty: -2, unitPriceCents: 550, totalPriceCents: -1100 }] },
      },
    });
    const result = await reconcileRecordedTickets(db.client);
    assert.equal(result.issueCount, 0);
    assert.equal(result.netRecordedCents, 0);
    assert.equal(result.grossRecordedCents, 1100);
    assert.equal(result.correctionCents, -1100);
    assert.equal(result.truncated, false);
  } finally {
    await db.cleanup();
  }
});

test('audit detects amount mismatches without rewriting the underlying tickets', async () => {
  const db = await createTestDatabase();
  try {
    const original = await db.client.paidTicket.create({
      data: {
        ticketNumber: 'PT-501', mode: 'full', method: 'cash',
        tableNumber: 2, tableZone: 'outside', totalCents: 100,
        taxableBaseCents: 90, vatCents: 10, vatRatePercent: 10,
        items: { create: [{ name: 'Drink', qty: 1, unitPriceCents: 120, totalPriceCents: 120 }] },
      },
    });
    const report = await reconcileRecordedTickets(db.client);
    assert.equal(report.checkedTickets, 1);
    assert.ok(report.issues.some((issue) => issue.code === 'TICKET_LINES_MISMATCH'));
    assert.equal((await db.client.paidTicket.findUniqueOrThrow({ where: { id: original.id } })).totalCents, 100);
  } finally {
    await db.cleanup();
  }
});
