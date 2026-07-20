import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db.js';
import { errorResponse, successResponse } from '../types/api.js';
import { logger } from '../utils/logger.js';

const router = Router();

function toPublicTicket<T extends { idempotencyKey: string | null; idempotencyFingerprint: string | null }>(ticket: T) {
  const { idempotencyKey: _idempotencyKey, idempotencyFingerprint: _fingerprint, ...publicTicket } = ticket;
  return publicTicket;
}

export function getSessionWindow(reference = new Date()): { start: Date; end: Date } {
  const start = new Date(reference);
  start.setHours(6, 0, 0, 0);

  if (reference.getHours() < 6) {
    start.setDate(start.getDate() - 1);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(6, 0, 0, 0);

  return { start, end };
}

function formatSessionDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseOptionalDate(value: unknown, fieldName: string): Date | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return date;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startAt = parseOptionalDate(req.query.startAt, 'startAt');
    const endAt = parseOptionalDate(req.query.endAt, 'endAt');

    if ((startAt && !endAt) || (!startAt && endAt)) {
      res.status(400).json(errorResponse('INVALID_TICKET_DATE_RANGE', 'Both startAt and endAt are required for ticket date filtering'));
      return;
    }

    if (startAt && endAt && startAt >= endAt) {
      res.status(400).json(errorResponse('INVALID_TICKET_DATE_RANGE', 'Ticket date range startAt must be before endAt'));
      return;
    }

    const tickets = await prisma.paidTicket.findMany({
      where: startAt && endAt ? {
        createdAt: {
          gte: startAt,
          lt: endAt,
        },
      } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    res.json(successResponse(tickets.map(toPublicTicket)));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Invalid ')) {
      res.status(400).json(errorResponse('INVALID_TICKET_DATE_RANGE', error.message));
      return;
    }
    logger.error({ error }, 'Failed to fetch paid tickets');
    next(error);
  }
});

router.get('/summary/session', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { start, end } = getSessionWindow();
    const tickets = await prisma.paidTicket.findMany({
      where: {
        createdAt: {
          gte: start,
          lt: end,
        },
      },
      orderBy: { createdAt: 'asc' },
      include: { items: true },
    });

    const paymentTotals = tickets.reduce((totals, ticket) => {
      totals[ticket.method] = (totals[ticket.method] ?? 0) + ticket.totalCents;
      return totals;
    }, {} as Record<string, number>);

    const itemTotalsByKey = new Map<string, {
      name: string;
      qty: number;
      totalCents: number;
    }>();

    for (const ticket of tickets) {
      for (const item of ticket.items) {
        const key = `${item.menuItemId ?? 'custom'}:${item.name}`;
        const current = itemTotalsByKey.get(key) ?? { name: item.name, qty: 0, totalCents: 0 };
        current.qty += item.qty;
        current.totalCents += item.totalPriceCents;
        itemTotalsByKey.set(key, current);
      }
    }

    const totalCents = tickets.reduce((sum, ticket) => sum + ticket.totalCents, 0);
    const taxableBaseCents = tickets.reduce((sum, ticket) => sum + ticket.taxableBaseCents, 0);
    const vatCents = tickets.reduce((sum, ticket) => sum + ticket.vatCents, 0);

    res.json(successResponse({
      sessionDate: formatSessionDate(start),
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      ticketCount: tickets.length,
      totalCents,
      taxableBaseCents,
      vatCents,
      paymentTotals: {
        cash: paymentTotals.cash ?? 0,
        card: paymentTotals.card ?? 0,
      },
      items: Array.from(itemTotalsByKey.values())
        .sort((left, right) => right.totalCents - left.totalCents || left.name.localeCompare(right.name)),
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        method: ticket.method,
        tableNumber: ticket.tableNumber,
        tableZone: ticket.tableZone,
        totalCents: ticket.totalCents,
        createdAt: ticket.createdAt,
      })),
    }));
  } catch (error) {
    logger.error({ error }, 'Failed to fetch session summary');
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticket = await prisma.paidTicket.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });

    if (!ticket) {
      res.status(404).json(errorResponse('PAID_TICKET_NOT_FOUND', 'Paid ticket not found'));
      return;
    }

    res.json(successResponse(toPublicTicket(ticket)));
  } catch (error) {
    logger.error({ error }, 'Failed to fetch paid ticket');
    next(error);
  }
});

export default router;
