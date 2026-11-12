import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db.js';
import { config } from '../config/index.js';
import { z } from 'zod';
import { workflowService } from '../domain/workflow/workflow.service.js';
import { requireManager } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { signalDataChange } from '../services/sync.service.js';
import { errorResponse, successResponse } from '../types/api.js';
import { logger } from '../utils/logger.js';

const router = Router();

function toPublicTicket<T extends { idempotencyKey: string | null; idempotencyFingerprint: string | null }>(ticket: T) {
  const { idempotencyKey: _idempotencyKey, idempotencyFingerprint: _fingerprint, ...publicTicket } = ticket;
  return publicTicket;
}

export function getSessionWindow(reference = new Date()): { start: Date; end: Date } {
  // `config` initializes TZ before local Date setters are used for session windows.
  void config.timeZone;
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

const ticketPageQuery = z.object({
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  cursor: z.string().trim().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(250).default(100),
});

router.get('/page', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = ticketPageQuery.parse(req.query);
    const start = new Date(query.startAt);
    const end = new Date(query.endAt);
    if (start >= end) {
      res.status(400).json(errorResponse('INVALID_TICKET_DATE_RANGE', 'Start date must be before end date'));
      return;
    }
    if (query.cursor) {
      const cursorTicket = await prisma.paidTicket.findUnique({
        where: { id: query.cursor },
        select: { id: true, createdAt: true },
      });
      if (!cursorTicket || cursorTicket.createdAt < start || cursorTicket.createdAt >= end) {
        res.status(400).json(errorResponse('INVALID_TICKET_CURSOR', 'Cursor does not belong to this date range'));
        return;
      }
    }
    const tickets = await prisma.paidTicket.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: query.limit + 1,
      include: { items: true },
    });
    const hasMore = tickets.length > query.limit;
    const page = tickets.slice(0, query.limit);
    res.json(successResponse({
      tickets: page.map(toPublicTicket),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    }));
  } catch (error) {
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

const refundParamsSchema = z.object({ id: z.string().trim().min(1).max(128) });
const refundBodySchema = z.object({
  reason: z.string().trim().min(4).max(250),
  idempotencyKey: z.string().trim().min(8).max(128),
  externalCardRefundConfirmed: z.boolean().optional(),
});

router.post(
  '/:id/refund',
  requireManager,
  validateParams(refundParamsSchema),
  validateBody(refundBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correction = await workflowService.refundPaidTicket(
        req.params.id,
        req.body.reason,
        req.body.idempotencyKey,
        req.body.externalCardRefundConfirmed === true
      );
      signalDataChange('orders');
      res.json(successResponse(correction));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
