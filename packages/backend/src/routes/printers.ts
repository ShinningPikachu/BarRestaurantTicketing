import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../db.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { ApiError } from '../middleware/errorHandler.js';
import { successResponse } from '../types/api.js';
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

const financialSummaryDaySchema = z.object({
  dayLabel: z.string().trim().min(1).max(100),
  ticketCount: countSchema,
  itemQuantity: countSchema,
  taxableBaseCents: centsSchema,
  vatCents: centsSchema,
  totalCents: centsSchema,
  cashCents: centsSchema,
  cardCents: centsSchema,
});

const xprinterFinancialSummarySchema = z.object({
  businessName: z.string().trim().min(1).max(200),
  tradeName: z.string().trim().min(1).max(200),
  nif: z.string().trim().min(1).max(64),
  periodLabel: z.string().trim().min(1).max(200),
  issuedAt: z.string().trim().min(1).max(64),
  ticketCount: countSchema,
  itemQuantity: countSchema,
  taxableBaseCents: centsSchema,
  vatCents: centsSchema,
  vatRateLabel: optionalText(32),
  totalCents: centsSchema,
  cashCents: centsSchema,
  cardCents: centsSchema,
  firstTicketNumber: optionalText(128),
  lastTicketNumber: optionalText(128),
  dailyTotals: z.array(financialSummaryDaySchema).min(1).max(3_660),
}).superRefine((summary, context) => {
  const totals = summary.dailyTotals.reduce((result, day) => ({
    ticketCount: result.ticketCount + day.ticketCount,
    itemQuantity: result.itemQuantity + day.itemQuantity,
    taxableBaseCents: result.taxableBaseCents + day.taxableBaseCents,
    vatCents: result.vatCents + day.vatCents,
    totalCents: result.totalCents + day.totalCents,
    cashCents: result.cashCents + day.cashCents,
    cardCents: result.cardCents + day.cardCents,
  }), {
    ticketCount: 0,
    itemQuantity: 0,
    taxableBaseCents: 0,
    vatCents: 0,
    totalCents: 0,
    cashCents: 0,
    cardCents: 0,
  });
  const fields = Object.keys(totals) as Array<keyof typeof totals>;
  if (fields.some((field) => !Number.isSafeInteger(totals[field]) || totals[field] !== summary[field])) {
    context.addIssue({ code: 'custom', message: 'Financial summary totals do not match daily totals' });
  }
  if (
    summary.taxableBaseCents + summary.vatCents !== summary.totalCents
    || summary.cashCents + summary.cardCents !== summary.totalCents
    || summary.dailyTotals.some((day) => (
      day.taxableBaseCents + day.vatCents !== day.totalCents
      || day.cashCents + day.cardCents !== day.totalCents
    ))
  ) {
    context.addIssue({ code: 'custom', message: 'Financial summary accounting totals are inconsistent' });
  }
});

const emptyBodySchema = z.object({}).optional();
const paidTicketParamsSchema = z.object({ id: z.string().trim().min(1).max(128) });
const paidTicketPrintSchema = z.object({ openCashDrawer: z.boolean().optional() }).optional();

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
      const job = await xprinterService.printTicket(req.body);
      res.json(successResponse({ printed: true, ...job }));
    } catch (error) {
      next(toPrinterApiError(error));
    }
  }
);

router.post(
  '/xprinter/financial-summary',
  validateBody(xprinterFinancialSummarySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await xprinterService.printFinancialSummary(req.body);
      res.json(successResponse({ printed: true, ...job }));
    } catch (error) {
      next(toPrinterApiError(error));
    }
  }
);

router.post(
  '/xprinter/paid-ticket/:id',
  validateParams(paidTicketParamsSchema),
  validateBody(paidTicketPrintSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticket = await prisma.paidTicket.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });
      if (!ticket) throw new ApiError(404, 'Paid ticket not found', 'PAID_TICKET_NOT_FOUND');
      if (ticket.status !== 'paid') throw new ApiError(409, 'Only paid tickets can be printed', 'TICKET_NOT_PAYABLE');

      const job = await xprinterService.printTicket({
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
        openCashDrawer: req.body?.openCashDrawer,
        fiscal: true,
      });
      res.json(successResponse({ printed: true, ticketId: ticket.id, ...job }));
    } catch (error) {
      next(toPrinterApiError(error));
    }
  }
);

router.post(
  '/xprinter/drawer',
  validateBody(emptyBodySchema),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await xprinterService.openCashDrawer();
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
    const job = await xprinterService.runSafeTestPrint();
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

export default router;
