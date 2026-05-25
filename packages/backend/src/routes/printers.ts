import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validation';
import { ApiError } from '../middleware/errorHandler.js';
import { successResponse } from '../types/api';
import { PrinterTransportError, xprinterService } from '../services/xprinter.service.js';

const router = Router();

const ticketLineSchema = z.object({
  name: z.string().trim().min(1),
  qty: z.number().int().positive(),
  unitPriceCents: z.number().int().min(0),
  totalPriceCents: z.number().int().min(0),
});

const xprinterTicketSchema = z.object({
  businessName: z.string().trim().min(1),
  tradeName: z.string().trim().min(1),
  nif: z.string().trim().min(1),
  address: z.string().trim().min(1),
  city: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  invoiceNumber: z.string().trim().min(1),
  issuedAt: z.string().trim().min(1),
  tableLabel: z.string().trim().min(1),
  lines: z.array(ticketLineSchema).min(1),
  taxableBaseCents: z.number().int().min(0),
  vatCents: z.number().int().min(0),
  vatRatePercent: z.number().min(0),
  totalCents: z.number().int().min(0),
  ticketNote: z.string().trim().optional().nullable(),
  splitPeople: z.number().int().positive().optional().nullable(),
  openCashDrawer: z.boolean().optional().nullable(),
  printerHost: z.string().trim().optional(),
  printerPort: z.number().int().positive().optional(),
  printerName: z.string().trim().optional(),
  usbDevice: z.string().trim().optional(),
});

const xprinterTargetSchema = z.object({
  printerHost: z.string().trim().optional(),
  printerPort: z.number().int().positive().optional(),
  printerName: z.string().trim().optional(),
  usbDevice: z.string().trim().optional(),
}).optional();

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
      const { printerHost, printerPort, printerName, usbDevice, ...payload } = req.body;
      await xprinterService.printTicket(payload, {
        host: printerHost,
        port: printerPort,
        printerName,
        usbDevice,
      });
      res.json(successResponse({ printed: true }));
    } catch (error) {
      next(toPrinterApiError(error));
    }
  }
);

router.post(
  '/xprinter/drawer',
  validateBody(xprinterTargetSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { printerHost, printerPort, printerName, usbDevice } = req.body ?? {};
      await xprinterService.openCashDrawer({
        host: printerHost,
        port: printerPort,
        printerName,
        usbDevice,
      });
      res.json(successResponse({ opened: true }));
    } catch (error) {
      next(toPrinterApiError(error));
    }
  }
);

export default router;
