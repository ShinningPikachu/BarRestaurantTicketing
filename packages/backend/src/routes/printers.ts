import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../db.js';
import { buildRecordedFinancialSummary } from '../services/financial-summary.service.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { requireManager } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';
import { successResponse } from '../types/api.js';
import { trackPrinterOperation } from '../services/print-job.service.js';
import { PrinterTransportError, xprinterService } from '../services/xprinter.service.js';

const router = Router();
const MAX_CENTS = 2_000_000_000;
const MAX_COUNT = 10_000_000;
const centsSchema = z.number().int().min(0).max(MAX_CENTS);
const countSchema = z.number().int().min(0).max(MAX_COUNT);
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

const ticketLineSchema = z.object({
  name: z.string().trim().min(1).max(200),
  primaryName: optionalText(200),
  secondaryName: optionalText(200),
  qty: z.number().int().min(1).max(10_000),
  unitPriceCents: centsSchema,
  totalPriceCents: centsSchema,
}).superRefine((line, context) => {
  if (!Number.isSafeInteger(line.qty * line.unitPriceCents) || line.totalPriceCents !== line.qty * line.unitPriceCents) {
    context.addIssue({ code: 'custom', message: 'Ticket line total does not match quantity and unit price' });
  }
});

export const xprinterTicketSchema = z.object({
  businessName: z.string().trim().min(1).max(200),
  tradeName: z.string().trim().min(1).max(200),
  nif: z.string().trim().min(1).max(64),
  address: z.string().trim().min(1).max(300),
  city: optionalText(150),
  phone: optionalText(64),
  invoiceNumber: z.string().trim().min(1).max(128),
  issuedAt: z.string().trim().min(1).max(64),
  tableLabel: z.string().trim().min(1).max(100),
  lines: z.array(ticketLineSchema).min(1).max(200),
  taxableBaseCents: centsSchema,
  vatCents: centsSchema,
  vatRatePercent: z.number().min(0).max(100),
  totalCents: centsSchema,
  ticketNote: optionalText(300),
  splitPeople: z.number().int().min(1).max(1_000).optional().nullable(),
}).superRefine((ticket, context) => {
  const lineTotal = ticket.lines.reduce((sum, line) => sum + line.totalPriceCents, 0);
  if (!Number.isSafeInteger(lineTotal) || lineTotal !== ticket.totalCents) {
    context.addIssue({ code: 'custom', message: 'Ticket total does not match its lines' });
  }
  if (ticket.taxableBaseCents + ticket.vatCents !== ticket.totalCents) {
    context.addIssue({ code: 'custom', message: 'Ticket tax totals do not match its total' });
  }
});

// The backend loads the selected tickets and computes all financial fields.
const financialSummarySelectionSchema = z.object({
  ticketIds: z.array(z.string().trim().min(1).max(128)).min(1).max(5_000),
});

const emptyBodySchema = z.object({}).optional();
const paidTicketParamsSchema = z.object({ id: z.string().trim().min(1).max(128) });

function toPrinterApiError(error: unknown): unknown {
  if (error instanceof PrinterTransportError) {
    return new ApiError(503, error.message, error.code);
  }
  return error;
}

router.post(
  '/xprinter/ticket',
  validateBody(xprinterTicketSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await trackPrinterOperation('provisional-ticket', req.body.invoiceNumber, () => xprinterService.printTicket(req.body));
      res.json(successResponse({ printed: true, ...job }));
    } catch (error) {
      next(toPrinterApiError(error));
    }
  }
);

router.post(
  '/xprinter/financial-summary',
  requireManager,
  validateBody(financialSummarySelectionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticketIds = [...new Set(req.body.ticketIds as string[])];
      const tickets = await prisma.paidTicket.findMany({
        where: { id: { in: ticketIds }, status: 'paid' },
        include: { items: true },
        orderBy: [{ createdAt: 'asc' }, { ticketNumber: 'asc' }],
      });
      if (tickets.length !== ticketIds.length) {
        throw new ApiError(409, 'Some selected tickets are missing or not paid', 'INVALID_SUMMARY_SELECTION');
      }
      const job = await trackPrinterOperation('financial-summary', null, () => xprinterService.printFinancialSummary(buildRecordedFinancialSummary(tickets)));
      res.json(successResponse({ printed: true, ...job }));
    } catch (error) {
      next(toPrinterApiError(error));
    }
  }
);

router.post(
  '/xprinter/paid-ticket/:id',
  validateParams(paidTicketParamsSchema),
  validateBody(emptyBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticket = await prisma.paidTicket.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });
      if (!ticket) throw new ApiError(404, 'Paid ticket not found', 'PAID_TICKET_NOT_FOUND');
      if (ticket.status !== 'paid') throw new ApiError(409, 'Only paid tickets can be printed', 'TICKET_NOT_PAYABLE');

      const job = await trackPrinterOperation('paid-ticket', ticket.id, () => xprinterService.printTicket({
        businessName: ticket.businessName,
        tradeName: ticket.tradeName,
        nif: ticket.businessTaxId,
        address: ticket.businessAddress || 'Address not configured',
        city: ticket.businessCity,
        phone: ticket.businessPhone,
        invoiceNumber: ticket.ticketNumber,
        issuedAt: ticket.createdAt.toISOString(),
        tableLabel: `${ticket.tableZone} ${ticket.tableNumber}`,
        lines: ticket.items,
        taxableBaseCents: ticket.taxableBaseCents,
        vatCents: ticket.vatCents,
        vatRatePercent: ticket.vatRatePercent,
        totalCents: ticket.totalCents,
        ticketNote: ticket.mode,
        splitPeople: ticket.splitPeople,
        fiscal: true,
      }));
      res.json(successResponse({ printed: true, ticketId: ticket.id, ...job }));
    } catch (error) {
      next(toPrinterApiError(error));
    }
  }
);

router.post(
  '/xprinter/drawer',
  requireManager,
  validateBody(emptyBodySchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await trackPrinterOperation('cash-drawer', null, () => xprinterService.openCashDrawer());
      res.json(successResponse({ opened: true, ...job }));
    } catch (error) {
      next(toPrinterApiError(error));
    }
  }
);

router.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(successResponse(await xprinterService.getStatus(true)));
  } catch (error) {
    next(toPrinterApiError(error));
  }
});

router.post('/reconnect', validateBody(emptyBodySchema), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(successResponse(await xprinterService.reconnect()));
  } catch (error) {
    next(toPrinterApiError(error));
  }
});

router.post('/test-print', validateBody(emptyBodySchema), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await trackPrinterOperation('test-print', null, () => xprinterService.runSafeTestPrint());
    res.json(successResponse({ printed: true, ...job }));
  } catch (error) {
    next(toPrinterApiError(error));
  }
});

router.delete('/queue/pending', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cancelled = xprinterService.cancelPendingJobs();
    res.json(successResponse({ cancelled, status: await xprinterService.getStatus(false) }));
  } catch (error) {
    next(toPrinterApiError(error));
  }
});

router.get('/diagnostics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(successResponse(await xprinterService.getDiagnostics()));
  } catch (error) {
    next(toPrinterApiError(error));
  }
});

router.get('/history', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await prisma.printJob.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    res.json(successResponse(jobs));
  } catch (error) {
    next(error);
  }
});

export default router;
