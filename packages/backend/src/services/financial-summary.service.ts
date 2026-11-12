import { Prisma } from '@prisma/client';
import { config } from '../config/index.js';
import type { XprinterFinancialSummaryPayload } from './xprinter.service.js';

type RecordedTicket = Prisma.PaidTicketGetPayload<{ include: { items: true } }>;

function businessDate(date: Date): string {
  const zone = process.env.POS_TIME_ZONE || 'Europe/Madrid';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const lookup = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${lookup('year')}-${lookup('month')}-${lookup('day')}`;
}

export function buildRecordedFinancialSummary(tickets: RecordedTicket[]): XprinterFinancialSummaryPayload {
  if (!tickets.length) throw new Error('Cannot print an empty financial summary');
  const ordered = [...tickets].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  const days = new Map<string, XprinterFinancialSummaryPayload['dailyTotals'][number]>();
  const totals = { ticketCount: 0, itemQuantity: 0, taxableBaseCents: 0, vatCents: 0, totalCents: 0, cashCents: 0, cardCents: 0 };
  for (const ticket of ordered) {
    if (!['paid', 'refunded', 'correction'].includes(ticket.status) || !['cash', 'card'].includes(ticket.method)) {
      throw new Error('Summary requires paid tickets with supported payment methods');
    }
    const dayLabel = businessDate(ticket.createdAt);
    const day = days.get(dayLabel) ?? {
      dayLabel, ticketCount: 0, itemQuantity: 0, taxableBaseCents: 0, vatCents: 0, totalCents: 0, cashCents: 0, cardCents: 0,
    };
    const quantity = ticket.items.reduce((sum, item) => sum + item.qty, 0);
    for (const record of [day, totals]) {
      record.ticketCount += 1;
      record.itemQuantity += quantity;
      record.taxableBaseCents += ticket.taxableBaseCents;
      record.vatCents += ticket.vatCents;
      record.totalCents += ticket.totalCents;
      if (ticket.method === 'cash') record.cashCents += ticket.totalCents;
      else record.cardCents += ticket.totalCents;
    }
    days.set(dayLabel, day);
  }
  const rates = new Set(ordered.map((ticket) => ticket.vatRatePercent));
  const hasMixedTicket = ordered.some((ticket) => {
    if (!ticket.taxBreakdownJson) return false;
    try { return JSON.parse(ticket.taxBreakdownJson).length > 1; } catch { return true; }
  });
  return {
    businessName: config.ticket.businessName,
    tradeName: config.ticket.tradeName,
    nif: config.ticket.businessTaxId,
    periodLabel: `${businessDate(ordered[0].createdAt)} to ${businessDate(ordered[ordered.length - 1].createdAt)}`,
    issuedAt: new Date().toISOString(),
    ...totals,
    vatRateLabel: rates.size === 1 && !hasMixedTicket ? `${ordered[0].vatRatePercent}%` : 'mixto',
    firstTicketNumber: ordered[0].ticketNumber,
    lastTicketNumber: ordered[ordered.length - 1].ticketNumber,
    dailyTotals: Array.from(days.values()).sort((a, b) => a.dayLabel.localeCompare(b.dayLabel)),
  };
}
