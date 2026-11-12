import prisma from '../db.js';
import { ApiError } from '../middleware/errorHandler.js';
import { PrinterTransportError } from './printer-adapter.js';
import { trackPrinterOperation } from './print-job.service.js';
import { KitchenTicketPayload, xprinterService } from './xprinter.service.js';

const AMBIGUOUS_TRANSPORT_CODES = new Set([
  'PRINTER_TIMEOUT', 'PRINTER_DISCONNECTED', 'PRINTER_IO_ERROR', 'PRINTER_COMMAND_FAILED',
]);

export async function markInterruptedKitchenDispatchesUnknown() {
  const changed = await prisma.kitchenDispatch.updateMany({
    where: { status: 'sending' },
    data: { status: 'unknown', lastErrorCode: 'PROCESS_INTERRUPTED' },
  });
  return changed.count;
}

export async function printKitchenDispatch(id: string, confirmedNoOutput: boolean) {
  const dispatch = await prisma.kitchenDispatch.findUnique({ where: { id } });
  if (!dispatch) throw new ApiError(404, 'Kitchen dispatch not found', 'KITCHEN_DISPATCH_NOT_FOUND');
  const allowed = ['pending', 'failed'].includes(dispatch.status)
    || (dispatch.status === 'unknown' && confirmedNoOutput);
  if (!allowed) {
    throw new ApiError(
      409,
      dispatch.status === 'unknown'
        ? 'Check that no kitchen ticket was produced before retrying'
        : 'Kitchen dispatch has already been sent or acknowledged',
      dispatch.status === 'unknown' ? 'KITCHEN_PRINT_RETRY_REQUIRES_CONFIRMATION' : 'KITCHEN_DISPATCH_ALREADY_SENT'
    );
  }
  const claimed = await prisma.kitchenDispatch.updateMany({
    where: { id, status: dispatch.status },
    data: { status: 'sending', lastErrorCode: null },
  });
  if (claimed.count !== 1) throw new ApiError(409, 'Kitchen dispatch changed during print', 'KITCHEN_DISPATCH_CONFLICT');

  try {
    const items = JSON.parse(dispatch.linesJson) as KitchenTicketPayload['items'];
    const result = await trackPrinterOperation('kitchen-ticket', dispatch.id, () => xprinterService.printKitchenTicket({
      dispatchId: dispatch.id,
      tableLabel: `${dispatch.tableZone} ${dispatch.tableNumber}`,
      items,
    }));
    await prisma.kitchenDispatch.update({
      where: { id },
      data: { status: 'accepted', printerJobId: result.jobId, lastErrorCode: null },
    });
    return { ...result, dispatchId: dispatch.id, deliveryStatus: 'accepted' };
  } catch (error) {
    const code = error instanceof PrinterTransportError ? error.code : 'KITCHEN_PRINT_UNKNOWN';
    const status = AMBIGUOUS_TRANSPORT_CODES.has(code) || code === 'KITCHEN_PRINT_UNKNOWN' ? 'unknown' : 'failed';
    try {
      await prisma.kitchenDispatch.update({
        where: { id },
        data: { status, lastErrorCode: code },
      });
    } catch {
      // A crash or SQLite error leaves a "sending" claim, recovered on restart.
    }
    throw error;
  }
}

export async function acknowledgeKitchenDispatch(id: string, manualHandoff: boolean) {
  const dispatch = await prisma.kitchenDispatch.findUnique({ where: { id } });
  if (!dispatch) throw new ApiError(404, 'Kitchen dispatch not found', 'KITCHEN_DISPATCH_NOT_FOUND');
  if (dispatch.status === 'acknowledged') return dispatch;
  if (dispatch.status === 'sending') {
    throw new ApiError(409, 'Printing is still in progress', 'KITCHEN_DISPATCH_IN_PROGRESS');
  }
  if (dispatch.status !== 'accepted' && !manualHandoff) {
    throw new ApiError(
      409, 'Explicitly confirm physical handoff if the printer did not accept the ticket',
      'KITCHEN_MANUAL_HANDOFF_REQUIRED'
    );
  }
  const changed = await prisma.kitchenDispatch.updateMany({
    where: { id, status: dispatch.status },
    data: { status: 'acknowledged', acknowledgedAt: new Date() },
  });
  if (changed.count !== 1) throw new ApiError(409, 'Kitchen dispatch changed concurrently', 'KITCHEN_DISPATCH_CONFLICT');
  return prisma.kitchenDispatch.findUniqueOrThrow({ where: { id } });
}
