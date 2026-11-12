import type { PrismaClient } from '@prisma/client';
import prisma from '../db.js';

export interface ReconciliationIssue {
  ticketNumber: string;
  code: string;
  detail: string;
}

export interface ReconciliationResult {
  checkedTickets: number;
  totalTickets: number;
  truncated: boolean;
  grossRecordedCents: number;
  correctionCents: number;
  netRecordedCents: number;
  issueCount: number;
  issues: ReconciliationIssue[];
}

/**
 * Read-only reconciliation. No in-place correction is ever attempted.
 *
 * This audit validates internal accounting consistency, not card settlement
 * or a jurisdiction's external fiscal-registration requirements.
 */
export async function reconcileRecordedTickets(
  db: PrismaClient = prisma,
  maxTickets = 10_000
): Promise<ReconciliationResult> {
  if (!Number.isInteger(maxTickets) || maxTickets < 1 || maxTickets > 50_000) {
    throw new Error('Invalid reconciliation limit');
  }
  const [tickets, totalTickets] = await Promise.all([
    db.paidTicket.findMany({
      take: maxTickets,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { items: true },
    }),
    db.paidTicket.count(),
  ]);
  const issues: ReconciliationIssue[] = [];
  const add = (ticketNumber: string, code: string, detail: string) => {
    issues.push({ ticketNumber, code, detail });
  };
  const byNumber = new Map(tickets.map((ticket) => [ticket.ticketNumber, ticket]));
  const correctionCounts = new Map<string, number>();
  let grossRecordedCents = 0;
  let correctionCents = 0;

  for (const ticket of tickets) {
    const itemsTotal = ticket.items.reduce((sum, item) => {
      if (item.totalPriceCents !== item.qty * item.unitPriceCents) {
        add(ticket.ticketNumber, 'INVALID_LINE_TOTAL', `Line ${item.id} disagrees with quantity and unit price`);
      }
      return sum + item.totalPriceCents;
    }, 0);
    if (itemsTotal !== ticket.totalCents) {
      add(ticket.ticketNumber, 'TICKET_LINES_MISMATCH', 'Stored ticket lines do not sum to the header amount');
    }
    if (ticket.taxableBaseCents + ticket.vatCents !== ticket.totalCents) {
      add(ticket.ticketNumber, 'TICKET_TAX_MISMATCH', 'Stored taxable base and VAT do not sum to ticket total');
    }
    if (ticket.taxBreakdownJson) {
      try {
        const parsed: unknown = JSON.parse(ticket.taxBreakdownJson);
        if (!Array.isArray(parsed) || parsed.some((band) =>
          !band || !Number.isInteger(band.taxableBaseCents) ||
          !Number.isInteger(band.vatCents) || !Number.isInteger(band.totalCents) ||
          band.taxableBaseCents + band.vatCents !== band.totalCents
        )) {
          add(ticket.ticketNumber, 'INVALID_TAX_BREAKDOWN', 'Tax breakdown contains invalid monetary bands');
        } else {
          const base = parsed.reduce((sum, band) => sum + band.taxableBaseCents, 0);
          const vat = parsed.reduce((sum, band) => sum + band.vatCents, 0);
          if (base !== ticket.taxableBaseCents || vat !== ticket.vatCents) {
            add(ticket.ticketNumber, 'TAX_BREAKDOWN_MISMATCH', 'Tax bands disagree with the recorded ticket totals');
          }
        }
      } catch {
        add(ticket.ticketNumber, 'INVALID_TAX_BREAKDOWN_JSON', 'Stored tax breakdown is not valid JSON');
      }
    }
    if (ticket.status === 'correction') {
      correctionCents += ticket.totalCents;
      if (ticket.totalCents >= 0 || ticket.mode !== 'refund' || !ticket.relatedTicketNumber) {
        add(ticket.ticketNumber, 'INVALID_CORRECTION', 'Correction must be negative and reference an original ticket');
      }
      if (ticket.relatedTicketNumber) {
        correctionCounts.set(
          ticket.relatedTicketNumber,
          (correctionCounts.get(ticket.relatedTicketNumber) ?? 0) + 1
        );
      }
    } else {
      grossRecordedCents += ticket.totalCents;
    }
  }

  // A bounded audit cannot establish relationship integrity for originals that
  // fall outside the queried page. Those cases are marked by truncated=true.
  for (const ticket of tickets) {
    if (ticket.status === 'correction' && ticket.relatedTicketNumber) {
      const original = byNumber.get(ticket.relatedTicketNumber);
      if (original) {
        if (original.status !== 'refunded') {
          add(ticket.ticketNumber, 'ORIGINAL_NOT_REFUNDED', 'Original is not marked refunded');
        }
        if (original.totalCents !== -ticket.totalCents ||
          original.vatCents !== -ticket.vatCents ||
          original.taxableBaseCents !== -ticket.taxableBaseCents) {
          add(ticket.ticketNumber, 'CORRECTION_AMOUNT_MISMATCH', 'Correction does not fully reverse the original');
        }
      }
    }
    if (ticket.status === 'refunded' && byNumber.has(ticket.ticketNumber) &&
        correctionCounts.get(ticket.ticketNumber) === undefined &&
        !ticket.relatedTicketNumber && tickets.length === totalTickets) {
      add(ticket.ticketNumber, 'REFUND_CORRECTION_MISSING', 'Refunded sale has no corrective ticket');
    }
  }
  for (const [original, count] of correctionCounts) {
    if (count > 1) add(original, 'DUPLICATE_CORRECTIONS', `${count} corrections reference the same original ticket`);
  }
  return {
    checkedTickets: tickets.length,
    totalTickets,
    truncated: totalTickets > tickets.length,
    grossRecordedCents,
    correctionCents,
    netRecordedCents: grossRecordedCents + correctionCents,
    issueCount: issues.length,
    issues: issues.slice(0, 500),
  };
}
