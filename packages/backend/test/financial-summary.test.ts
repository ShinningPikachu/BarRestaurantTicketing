import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecordedFinancialSummary } from '../src/services/financial-summary.service.ts';

test('financial summaries aggregate recorded tickets and their stored payment methods', () => {
  const now = new Date('2026-11-12T12:00:00Z');
  const mk = (id: string, method: string, cents: number) => ({
    id, method, ticketNumber: id, createdAt: now,
    status: 'paid', totalCents: cents, vatCents: Math.round(cents / 11),
    taxableBaseCents: cents - Math.round(cents / 11), vatRatePercent: 10,
    items: [{ qty: 2 }],
  });
  const summary = buildRecordedFinancialSummary([mk('PT-000001', 'cash', 1100), mk('PT-000002', 'card', 2200)] as any);
  assert.equal(summary.ticketCount, 2);
  assert.equal(summary.itemQuantity, 4);
  assert.equal(summary.cashCents, 1100);
  assert.equal(summary.cardCents, 2200);
  assert.equal(summary.totalCents, 3300);
  assert.equal(summary.dailyTotals.length, 1);
  assert.equal(summary.dailyTotals[0].totalCents, 3300);
});
