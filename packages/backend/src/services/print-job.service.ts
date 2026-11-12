import type { PrismaClient } from '@prisma/client';
import prisma from '../db.js';
import { PrinterTransportError } from './printer-adapter.js';
import type { PrinterJobResult } from './xprinter.service.js';

const UNCERTAIN_TRANSPORT_CODES = new Set([
  'PRINTER_TIMEOUT', 'PRINTER_DISCONNECTED', 'PRINTER_IO_ERROR', 'PRINTER_COMMAND_FAILED',
]);

/**
 * Persists delivery attempts without storing customer or payment details.
 * "accepted" means the print adapter or spooler accepted the bytes. Physical
 * paper delivery cannot generally be inferred from a CUPS or TCP success.
 * Uncertain attempts require operator inspection before any reprint.
 */
export async function trackPrinterOperation(
  kind: string,
  referenceId: string | null,
  execute: () => Promise<PrinterJobResult>,
  db: PrismaClient = prisma
): Promise<PrinterJobResult & { printRecordId: string }> {
  const attempt = await db.printJob.create({ data: { kind, referenceId, status: 'pending' } });
  try {
    const result = await execute();
    await db.printJob.update({
      where: { id: attempt.id },
      data: {
        status: 'accepted',
        printerJobId: result.jobId,
        completedAt: new Date(),
      },
    });
    return { ...result, printRecordId: attempt.id };
  } catch (error) {
    const code = error instanceof PrinterTransportError ? error.code : 'PRINT_JOB_UNKNOWN_ERROR';
    const uncertain = UNCERTAIN_TRANSPORT_CODES.has(code) || code === 'PRINT_JOB_UNKNOWN_ERROR';
    // Retain ambiguous delivery as unknown; never auto-resubmit these jobs.
    try {
      await db.printJob.update({
        where: { id: attempt.id },
        data: { status: uncertain ? 'unknown' : 'failed', errorCode: code, completedAt: new Date() },
      });
    } catch {
      // The pending row is retained if SQLite is unavailable; startup marks
      // any orphaned attempts as unknown for manual investigation.
    }
    throw error;
  }
}

export async function markInterruptedPrintJobsUnknown(db: PrismaClient = prisma): Promise<number> {
  const changed = await db.printJob.updateMany({
    where: { status: 'pending' },
    data: { status: 'unknown', errorCode: 'PROCESS_INTERRUPTED', completedAt: new Date() },
  });
  return changed.count;
}
