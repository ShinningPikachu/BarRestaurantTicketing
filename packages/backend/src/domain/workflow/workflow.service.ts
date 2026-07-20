import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { config } from '../../config/index.js';
import { ApiError } from '../../middleware/errorHandler.js';
import { PaidTicketLine, workflowRepository } from './workflow.repository.js';

const VALID_TABLE_ZONES = new Set(['outside', 'floor1', 'floor2']);
const VALID_PAYMENT_METHODS = new Set(['cash', 'card']);
const DEFAULT_VAT_RATE_PERCENT = 10;
const TICKET_SERIES = 'PT';
const MAX_DATABASE_INT = 2_147_483_647;

function checkedDatabaseInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_DATABASE_INT) {
    throw new ApiError(
      422,
      `${label} exceeds the supported order value`,
      'ORDER_VALUE_TOO_LARGE'
    );
  }
  return value;
}

function checkedLineTotal(qty: number, unitPriceCents: number): number {
  checkedDatabaseInteger(qty, 'Item quantity');
  checkedDatabaseInteger(unitPriceCents, 'Item price');
  return checkedDatabaseInteger(qty * unitPriceCents, 'Item total');
}

function checkedCentsSum(values: Iterable<number>, label = 'Order total'): number {
  let total = 0;
  for (const value of values) {
    checkedDatabaseInteger(value, label);
    total = checkedDatabaseInteger(total + value, label);
  }
  return total;
}

function checkedQuantitySum(left: number, right: number): number {
  return checkedDatabaseInteger(left + right, 'Item quantity');
}

function normalizeZone(zone: string): string {
  const normalized = zone.trim().toLowerCase();
  if (!normalized || !VALID_TABLE_ZONES.has(normalized)) {
    throw new ApiError(400, 'Invalid table zone', 'INVALID_TABLE_ZONE');
  }

  return normalized;
}

function normalizeNumber(number: number): number {
  if (!Number.isInteger(number) || number <= 0) {
    throw new ApiError(400, 'Invalid table number', 'INVALID_TABLE_NUMBER');
  }
  return number;
}

function normalizePaymentMethod(method: string): string {
  const normalized = method.trim().toLowerCase();
  if (!VALID_PAYMENT_METHODS.has(normalized)) {
    throw new ApiError(400, 'Invalid payment method', 'INVALID_PAYMENT_METHOD');
  }
  return normalized;
}

function calculateTax(totalCents: number) {
  const configuredVatRate = config.ticket.vatRatePercent;
  const vatRatePercent = Number.isFinite(configuredVatRate) && configuredVatRate >= 0
    ? Math.round(configuredVatRate)
    : DEFAULT_VAT_RATE_PERCENT;
  const taxableBaseCents = Math.round(totalCents / (1 + vatRatePercent / 100));
  return {
    taxableBaseCents,
    vatCents: totalCents - taxableBaseCents,
    vatRatePercent
  };
}

function nextPaidTicketNumber(sequence: number): string {
  return `${TICKET_SERIES}-${String(sequence).padStart(6, '0')}`;
}

function normalizeIdempotencyKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 128) {
    throw new ApiError(400, 'Invalid idempotency key', 'INVALID_IDEMPOTENCY_KEY');
  }
  return normalized;
}

function createPaymentFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function isRetryableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return true;
  const candidate = error as { code?: string; message?: string };
  return candidate?.code === 'P1008' || /database is locked/i.test(candidate?.message ?? '');
}

function groupPaymentTotalsByOrder(lines: PaidTicketLine[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines) {
    totals.set(line.orderId, (totals.get(line.orderId) ?? 0) + line.totalPriceCents);
  }
  return totals;
}

function getTicketAccountingSnapshot(params: {
  mode: string;
  method: string;
  tableId: number;
  tableNumber: number;
  tableZone: string;
  lines: PaidTicketLine[];
  selectedItems?: Array<{ orderId: string; itemId: number; qty: number }>;
}) {
  const orderIds = Array.from(new Set(params.lines.map((line) => line.orderId)));

  return {
    businessName: config.ticket.businessName,
    tradeName: config.ticket.tradeName,
    businessTaxId: config.ticket.businessTaxId,
    businessAddress: config.ticket.businessAddress,
    businessCity: config.ticket.businessCity,
    businessPhone: config.ticket.businessPhone,
    terminalId: config.ticket.terminalId,
    cashierName: config.ticket.cashierName || null,
    status: 'paid',
    auditMetadata: JSON.stringify({
      source: 'pos-payment',
      mode: params.mode,
      method: params.method,
      tableId: params.tableId,
      tableNumber: params.tableNumber,
      tableZone: params.tableZone,
      orderIds,
      selectedItems: params.selectedItems ?? null,
      lineCount: params.lines.length,
      itemQuantity: params.lines.reduce((sum, line) => sum + line.qty, 0),
      capturedAt: new Date().toISOString(),
    }),
  };
}

function getSmallestAvailableTableNumber(existingNumbers: number[]): number {
  let candidate = 1;

  for (const number of existingNumbers) {
    if (number === candidate) {
      candidate += 1;
    }
  }

  return candidate;
}

type WorkflowState = Awaited<ReturnType<typeof workflowRepository.getTableWorkflow>>;
type PaidTicketWithItems = NonNullable<Awaited<ReturnType<typeof workflowRepository.getPaidTicketByIdempotencyKey>>>;
type PublicPaidTicket = Omit<PaidTicketWithItems, 'idempotencyKey' | 'idempotencyFingerprint'>;
type PaymentTransactionResult = {
  paidTicket: PaidTicketWithItems;
  tableNumber: number;
  tableZone: string;
};
type PublicPaymentResult = Omit<PaymentTransactionResult, 'paidTicket'> & { paidTicket: PublicPaidTicket };
type IdempotentMutationResult = { tableNumber: number; tableZone: string };

function workflowHasProducts(workflow: WorkflowState): boolean {
  const hasPendingItems = workflow.preOrderSession?.items.some((item) => item.qty > 0) ?? false;
  const hasConfirmedItems = workflow.orders.some((order) => order.items.some((item) => item.qty > 0));

  return hasPendingItems || hasConfirmedItems;
}

function workflowHasConfirmedProducts(workflow: WorkflowState): boolean {
  return workflow.orders.some((order) => order.items.some((item) => item.qty > 0));
}

export class WorkflowService {
  private async invalidatePrintedTicket(
    tableId: number,
    tx?: Parameters<typeof workflowRepository.clearTableTicketPrinted>[1]
  ) {
    await workflowRepository.clearTableTicketPrinted(tableId, tx);
  }

  private toIdempotentPaymentResult(paidTicket: PaidTicketWithItems, fingerprint: string): PaymentTransactionResult {
    if (paidTicket.idempotencyFingerprint !== fingerprint) {
      throw new ApiError(409, 'Idempotency key was already used for a different payment', 'IDEMPOTENCY_KEY_REUSED');
    }
    return {
      paidTicket,
      tableNumber: paidTicket.tableNumber,
      tableZone: paidTicket.tableZone,
    };
  }

  private toPublicPaymentResult(result: PaymentTransactionResult): PublicPaymentResult {
    const { idempotencyKey: _idempotencyKey, idempotencyFingerprint: _fingerprint, ...paidTicket } = result.paidTicket;
    return { ...result, paidTicket };
  }

  private async runPaymentTransaction(
    idempotencyKey: string,
    fingerprint: string,
    callback: (tx: Prisma.TransactionClient) => Promise<PaymentTransactionResult>
  ): Promise<PaymentTransactionResult> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await workflowRepository.runInTransaction(callback);
      } catch (error) {
        const existing = await workflowRepository.getPaidTicketByIdempotencyKey(idempotencyKey);
        if (existing) return this.toIdempotentPaymentResult(existing, fingerprint);
        if (!isRetryableTransactionError(error) || attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
      }
    }
    throw new ApiError(503, 'Payment transaction could not be completed', 'PAYMENT_TRANSACTION_FAILED');
  }

  private mutationReceiptResult(
    receipt: NonNullable<Awaited<ReturnType<typeof workflowRepository.getMutationReceipt>>>,
    operation: string,
    fingerprint: string
  ): IdempotentMutationResult {
    if (receipt.operation !== operation || receipt.fingerprint !== fingerprint) {
      throw new ApiError(409, 'Idempotency key was already used for a different operation', 'IDEMPOTENCY_KEY_REUSED');
    }
    return { tableNumber: receipt.tableNumber, tableZone: receipt.tableZone };
  }

  private async runMutationTransaction(
    idempotencyKey: string,
    operation: string,
    fingerprint: string,
    callback: (tx: Prisma.TransactionClient) => Promise<IdempotentMutationResult>
  ): Promise<IdempotentMutationResult> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await workflowRepository.runInTransaction(callback);
      } catch (error) {
        const existing = await workflowRepository.getMutationReceipt(idempotencyKey);
        if (existing) return this.mutationReceiptResult(existing, operation, fingerprint);
        if (!isRetryableTransactionError(error) || attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
      }
    }
    throw new ApiError(503, 'Mutation transaction could not be completed', 'MUTATION_TRANSACTION_FAILED');
  }

  async listTables() {
    const tables = await workflowRepository.listTables();

    return tables
      .filter((table) => VALID_TABLE_ZONES.has((table.zone ?? '').trim().toLowerCase()))
      .map(({ orders, preOrderSessions, ...table }) => {
        const pendingItems = preOrderSessions.flatMap((session) => session.items);
        const confirmedItems = orders.flatMap((order) => order.items);
        const pendingItemCount = pendingItems.reduce((sum, item) => sum + item.qty, 0);
        const confirmedItemCount = confirmedItems.reduce((sum, item) => sum + item.qty, 0);

        return {
          ...table,
          totalCents: orders.reduce((sum, order) => sum + order.totalCents, 0)
            + pendingItems.reduce((sum, item) => sum + item.qty * item.unitPriceCents, 0),
          pendingItemCount,
          confirmedItemCount,
          hasPrintedTicket: Boolean(table.ticketPrintedAt) && pendingItemCount + confirmedItemCount > 0,
        };
      });
  }

  async addTable(zone: string) {
    const normalizedZone = normalizeZone(zone);

    return workflowRepository.runInTransaction(async (tx) => {
      const existingNumbers = await workflowRepository.getTableNumbersInZone(normalizedZone, tx);
      const nextNumber = getSmallestAvailableTableNumber(existingNumbers);

      return workflowRepository.createTable(normalizedZone, nextNumber, tx);
    });
  }

  async ensureTableInZone(zone: string) {
    const normalizedZone = normalizeZone(zone);
    return workflowRepository.ensureFirstTableInZone(normalizedZone);
  }

  async deleteTable(tableNumber: number, tableZone: string) {
    const normalizedNumber = normalizeNumber(tableNumber);
    const normalizedZone = normalizeZone(tableZone);

    return workflowRepository.runInTransaction(async (tx) => {
      const table = await workflowRepository.getTableByNumberAndZone(normalizedNumber, normalizedZone, tx);
      if (!table) {
        throw new ApiError(404, 'Table not found', 'TABLE_NOT_FOUND');
      }

      const tablesInZone = await workflowRepository.countTablesInZone(normalizedZone, tx);
      if (tablesInZone <= 1) {
        throw new ApiError(409, 'Cannot remove the last table in a zone', 'LAST_TABLE_IN_ZONE');
      }

      const financialDependencies = await workflowRepository.countTableFinancialDependencies(table.id, tx);
      if (financialDependencies.payments > 0 || financialDependencies.paidOrders > 0) {
        throw new ApiError(409, 'Cannot remove a table with payment history', 'TABLE_HAS_PAYMENT_HISTORY');
      }

      await workflowRepository.deleteTableWorkflowData(table.id, tx);
      await workflowRepository.deleteTable(table.id, tx);
      return { ok: true };
    });
  }

  async getTableWorkflow(tableNumber: number, tableZone: string) {
    const normalizedNumber = normalizeNumber(tableNumber);
    const normalizedZone = normalizeZone(tableZone);

    const table = await workflowRepository.getTableByNumberAndZone(normalizedNumber, normalizedZone);
    if (!table) {
      throw new ApiError(404, 'Table not found', 'TABLE_NOT_FOUND');
    }

    const workflow = await workflowRepository.getTableWorkflow(table.id);
    return {
      table: {
        ...table,
        hasPrintedTicket: Boolean(table.ticketPrintedAt) && workflowHasProducts(workflow),
      },
      preOrderItems: workflow.preOrderSession?.items ?? [],
      orders: workflow.orders
    };
  }

  async markTableTicketPrinted(tableNumber: number, tableZone: string) {
    const normalizedNumber = normalizeNumber(tableNumber);
    const normalizedZone = normalizeZone(tableZone);

    return workflowRepository.runInTransaction(async (tx) => {
      const table = await workflowRepository.getTableByNumberAndZone(normalizedNumber, normalizedZone, tx);
      if (!table) {
        throw new ApiError(404, 'Table not found', 'TABLE_NOT_FOUND');
      }

      const workflow = await workflowRepository.getTableWorkflow(table.id, tx);
      const hasPendingProducts = workflow.preOrderSession?.items.some((item) => item.qty > 0) ?? false;
      if (hasPendingProducts) {
        throw new ApiError(409, 'Pending items must be sent before marking the ticket as printed', 'PENDING_ITEMS_NOT_PRINTED');
      }
      if (!workflowHasConfirmedProducts(workflow)) {
        throw new ApiError(409, 'No confirmed items to mark as printed', 'EMPTY_PRINTED_TICKET');
      }

      const updatedTable = await workflowRepository.markTableTicketPrinted(table.id, tx);
      return {
        ...updatedTable,
        hasPrintedTicket: true,
      };
    });
  }

  async addPreOrderMenuItem(tableNumber: number, tableZone: string, menuItemId: number) {
    const normalizedNumber = normalizeNumber(tableNumber);
    const normalizedZone = normalizeZone(tableZone);

    return workflowRepository.runInTransaction(async (tx) => {
      const table = await workflowRepository.getTableByNumberAndZone(normalizedNumber, normalizedZone, tx);
      if (!table) {
        throw new ApiError(404, 'Table not found', 'TABLE_NOT_FOUND');
      }

      const menu = await workflowRepository.getMenuItem(menuItemId, tx);
      if (!menu || !menu.available) {
        throw new ApiError(404, 'Menu item not found', 'MENU_ITEM_NOT_FOUND');
      }

      const draftSession = (await workflowRepository.getDraftPreOrderSession(table.id, tx))
        ?? (await workflowRepository.createDraftPreOrderSession(table.id, tx));

      const existing = draftSession.items.find((item) =>
        item.menuItemId === menu.id &&
        item.unitPriceCents === menu.priceCents &&
        item.name === menu.name &&
        item.primaryName === menu.primaryName &&
        item.secondaryName === menu.secondaryName
      );

      if (existing) {
        const nextQty = checkedQuantitySum(existing.qty, 1);
        checkedLineTotal(nextQty, existing.unitPriceCents);
        await workflowRepository.updatePreOrderItem(existing.id, {
          qty: nextQty,
          unitPriceCents: existing.unitPriceCents
        }, tx);
      } else {
        checkedLineTotal(1, menu.priceCents);
        await workflowRepository.createPreOrderItem(draftSession.id, {
          menuItemId: menu.id,
          name: menu.name,
          primaryName: menu.primaryName,
          secondaryName: menu.secondaryName,
          qty: 1,
          unitPriceCents: menu.priceCents
        }, tx);
      }

      await this.invalidatePrintedTicket(table.id, tx);

      return {
        tableNumber: table.number,
        tableZone: table.zone ?? normalizedZone
      };
    });
  }

  async updatePreOrderItem(tableNumber: number, tableZone: string, preOrderItemId: number, payload: { qty?: number; unitPriceCents?: number }) {
    const normalizedNumber = normalizeNumber(tableNumber);
    const normalizedZone = normalizeZone(tableZone);

    return workflowRepository.runInTransaction(async (tx) => {
      const table = await workflowRepository.getTableByNumberAndZone(normalizedNumber, normalizedZone, tx);
      if (!table) {
        throw new ApiError(404, 'Table not found', 'TABLE_NOT_FOUND');
      }

      const item = await workflowRepository.getPreOrderItemById(preOrderItemId, tx);
      if (!item || item.session.tableId !== table.id || item.session.status !== 'draft') {
        throw new ApiError(404, 'Pre-order item not found', 'PREORDER_ITEM_NOT_FOUND');
      }

      const nextQty = payload.qty ?? item.qty;
      const nextUnitPrice = payload.unitPriceCents ?? item.unitPriceCents;

      if (nextQty <= 0) {
        await workflowRepository.deletePreOrderItem(item.id, tx);
      } else {
        checkedLineTotal(nextQty, nextUnitPrice);
        await workflowRepository.updatePreOrderItem(item.id, {
          qty: nextQty,
          unitPriceCents: Math.max(0, nextUnitPrice)
        }, tx);
      }

      await this.invalidatePrintedTicket(table.id, tx);

      return {
        tableNumber: table.number,
        tableZone: table.zone ?? normalizedZone
      };
    });
  }

  async clearPreOrder(tableNumber: number, tableZone: string) {
    const normalizedNumber = normalizeNumber(tableNumber);
    const normalizedZone = normalizeZone(tableZone);

    return workflowRepository.runInTransaction(async (tx) => {
      const table = await workflowRepository.getTableByNumberAndZone(normalizedNumber, normalizedZone, tx);
      if (!table) {
        throw new ApiError(404, 'Table not found', 'TABLE_NOT_FOUND');
      }

      const session = await workflowRepository.getDraftPreOrderSession(table.id, tx);
      if (session) {
        await workflowRepository.clearDraftItems(session.id, tx);
      }

      await this.invalidatePrintedTicket(table.id, tx);

      return {
        tableNumber: table.number,
        tableZone: table.zone ?? normalizedZone
      };
    });
  }

  async sendToKitchen(tableNumber: number, tableZone: string) {
    const normalizedNumber = normalizeNumber(tableNumber);
    const normalizedZone = normalizeZone(tableZone);

    return workflowRepository.runInTransaction(async (tx) => {
      const table = await workflowRepository.getTableByNumberAndZone(normalizedNumber, normalizedZone, tx);
      if (!table) {
        throw new ApiError(404, 'Table not found', 'TABLE_NOT_FOUND');
      }

      const draftSession = await workflowRepository.getDraftPreOrderSession(table.id, tx);
      const items = draftSession?.items ?? [];

      if (items.length === 0) {
        throw new ApiError(409, 'No pre-order items to send', 'EMPTY_PREORDER');
      }

      const normalizedItems = items.map((item) => ({
        menuItemId: item.menuItemId,
        name: item.name,
        primaryName: item.primaryName,
        secondaryName: item.secondaryName,
        qty: item.qty,
        unitPriceCents: item.unitPriceCents
      }));
      checkedCentsSum(normalizedItems.map((item) => checkedLineTotal(item.qty, item.unitPriceCents)));

      await workflowRepository.createOrderFromPreOrder(table.id, normalizedItems, tx);
      await workflowRepository.deleteDraftSession(draftSession!.id, tx);
      await this.invalidatePrintedTicket(table.id, tx);

      return {
        tableNumber: table.number,
        tableZone: table.zone ?? normalizedZone
      };
    });
  }

  async moveConfirmedOrderItemToPreOrder(orderId: string, orderItemId: number) {
    return workflowRepository.runInTransaction(async (tx) => {
      const orderItem = await workflowRepository.getOrderItemWithOrder(orderId, orderItemId, tx);
      if (!orderItem) {
        throw new ApiError(404, 'Order item not found', 'ORDER_ITEM_NOT_FOUND');
      }
      const paymentCount = await workflowRepository.countPaymentsForOrder(orderId, tx);
      if (orderItem.order.status !== 'confirmed' || paymentCount > 0) {
        throw new ApiError(409, 'Cannot move an item from an order with payment history', 'ORDER_HAS_PAYMENT_HISTORY');
      }

      const table = orderItem.order.table;
      const draftSession = (await workflowRepository.getDraftPreOrderSession(table.id, tx))
        ?? (await workflowRepository.createDraftPreOrderSession(table.id, tx));

      const existing = draftSession.items.find((item) =>
        item.menuItemId === orderItem.menuItemId &&
        item.unitPriceCents === orderItem.unitPriceCents &&
        item.name === orderItem.name &&
        item.primaryName === orderItem.primaryName &&
        item.secondaryName === orderItem.secondaryName
      );

      if (existing) {
        const nextQty = checkedQuantitySum(existing.qty, orderItem.qty);
        checkedLineTotal(nextQty, existing.unitPriceCents);
        await workflowRepository.updatePreOrderItem(existing.id, {
          qty: nextQty,
          unitPriceCents: existing.unitPriceCents
        }, tx);
      } else {
        checkedLineTotal(orderItem.qty, orderItem.unitPriceCents);
        await workflowRepository.createPreOrderItem(draftSession.id, {
          menuItemId: orderItem.menuItemId ?? null,
          name: orderItem.name,
          primaryName: orderItem.primaryName,
          secondaryName: orderItem.secondaryName,
          qty: orderItem.qty,
          unitPriceCents: orderItem.unitPriceCents
        }, tx);
      }

      await workflowRepository.deleteOrderItem(orderItem.id, tx);

      const remainingItems = await workflowRepository.getOrderItems(orderId, tx);
      if (remainingItems.length === 0) {
        const paymentCount = await workflowRepository.countPaymentsForOrder(orderId, tx);
        if (paymentCount > 0) {
          await workflowRepository.updateOrderTotal(orderId, 0, tx);
          await workflowRepository.updateOrderStatus(orderId, 'paid', tx);
        } else {
          await workflowRepository.deleteOrder(orderId, tx);
        }
      } else {
        const totalCents = checkedCentsSum(remainingItems.map((item) => item.totalPriceCents));
        await workflowRepository.updateOrderTotal(orderId, totalCents, tx);
      }

      await this.invalidatePrintedTicket(table.id, tx);

      return {
        tableNumber: table.number,
        tableZone: table.zone ?? 'outside'
      };
    });
  }

  async deleteOrder(orderId: string) {
    return workflowRepository.runInTransaction(async (tx) => {
      const order = await workflowRepository.getOrderById(orderId, tx);
      if (!order) {
        throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
      }

      const paymentCount = await workflowRepository.countPaymentsForOrder(orderId, tx);
      if (order.status === 'paid' || paymentCount > 0) {
        throw new ApiError(409, 'Cannot delete an order with payment history', 'ORDER_HAS_PAYMENT_HISTORY');
      }

      const tableId = order.tableId;
      await workflowRepository.deleteOrder(orderId, tx);
      await this.invalidatePrintedTicket(tableId, tx);
      return { ok: true };
    });
  }

  async payTable(tableNumber: number, tableZone: string, method: string, idempotencyKey: string, splitPeople?: number) {
    const normalizedNumber = normalizeNumber(tableNumber);
    const normalizedZone = normalizeZone(tableZone);
    const normalizedMethod = normalizePaymentMethod(method);
    const normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);
    const normalizedSplitPeople = splitPeople && splitPeople > 1 ? splitPeople : null;
    const fingerprint = createPaymentFingerprint({
      version: 1,
      operation: 'pay-table',
      tableNumber: normalizedNumber,
      tableZone: normalizedZone,
      method: normalizedMethod,
      splitPeople: normalizedSplitPeople,
    });

    const result = await this.runPaymentTransaction(normalizedIdempotencyKey, fingerprint, async (tx) => {
      const existing = await workflowRepository.getPaidTicketByIdempotencyKey(normalizedIdempotencyKey, tx);
      if (existing) return this.toIdempotentPaymentResult(existing, fingerprint);

      const table = await workflowRepository.getTableByNumberAndZone(normalizedNumber, normalizedZone, tx);
      if (!table) {
        throw new ApiError(404, 'Table not found', 'TABLE_NOT_FOUND');
      }

      const workflow = await workflowRepository.getTableWorkflow(table.id, tx);
      const orders = workflow.orders;
      const lines: PaidTicketLine[] = orders.flatMap((order) =>
        order.items.map((item) => ({
          orderId: order.id,
          orderItemId: item.id,
          menuItemId: item.menuItemId,
          name: item.name,
          primaryName: item.primaryName,
          secondaryName: item.secondaryName,
          qty: item.qty,
          unitPriceCents: item.unitPriceCents,
          totalPriceCents: item.totalPriceCents,
        }))
      );

      if (lines.length === 0) {
        throw new ApiError(409, 'No confirmed items to pay', 'EMPTY_PAYMENT');
      }

      const totalCents = checkedCentsSum(lines.map((line) => line.totalPriceCents), 'Ticket total');
      const sequence = await workflowRepository.allocateTicketSequence(TICKET_SERIES, tx);
      const tax = calculateTax(totalCents);
      const mode = normalizedSplitPeople ? 'split' : 'full';
      const paidTicket = await workflowRepository.createPaidTicket({
        ticketNumber: nextPaidTicketNumber(sequence),
        idempotencyKey: normalizedIdempotencyKey,
        idempotencyFingerprint: fingerprint,
        mode,
        method: normalizedMethod,
        tableNumber: table.number,
        tableZone: table.zone ?? normalizedZone,
        totalCents,
        ...tax,
        splitPeople: normalizedSplitPeople,
        ...getTicketAccountingSnapshot({
          mode,
          method: normalizedMethod,
          tableId: table.id,
          tableNumber: table.number,
          tableZone: table.zone ?? normalizedZone,
          lines,
        }),
        items: lines,
      }, tx);

      for (const [orderId, amountCents] of groupPaymentTotalsByOrder(lines)) {
        await workflowRepository.createPayment(orderId, amountCents, normalizedMethod, tx);
        await workflowRepository.updateOrderStatus(orderId, 'paid', tx);
      }

      await this.invalidatePrintedTicket(table.id, tx);

      return {
        paidTicket,
        tableNumber: table.number,
        tableZone: table.zone ?? normalizedZone,
      };
    });
    return this.toPublicPaymentResult(result);
  }

  async paySelectedItems(
    tableNumber: number,
    tableZone: string,
    method: string,
    selectedItems: Array<{ orderId: string; itemId: number; qty: number }>,
    idempotencyKey: string
  ) {
    const normalizedNumber = normalizeNumber(tableNumber);
    const normalizedZone = normalizeZone(tableZone);
    const normalizedMethod = normalizePaymentMethod(method);
    const normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);

    if (selectedItems.length === 0) {
      throw new ApiError(400, 'No selected items to pay', 'EMPTY_PAYMENT_SELECTION');
    }

    const groupedSelectedItems = Array.from(selectedItems.reduce((grouped, item) => {
      const key = `${item.orderId}:${item.itemId}`;
      const current = grouped.get(key);
      grouped.set(key, current ? { ...current, qty: checkedQuantitySum(current.qty, item.qty) } : { ...item });
      return grouped;
    }, new Map<string, { orderId: string; itemId: number; qty: number }>()).values())
      .sort((left, right) => left.orderId.localeCompare(right.orderId) || left.itemId - right.itemId);

    const fingerprint = createPaymentFingerprint({
      version: 1,
      operation: 'pay-items',
      tableNumber: normalizedNumber,
      tableZone: normalizedZone,
      method: normalizedMethod,
      items: groupedSelectedItems,
    });

    const result = await this.runPaymentTransaction(normalizedIdempotencyKey, fingerprint, async (tx) => {
      const existing = await workflowRepository.getPaidTicketByIdempotencyKey(normalizedIdempotencyKey, tx);
      if (existing) return this.toIdempotentPaymentResult(existing, fingerprint);

      const table = await workflowRepository.getTableByNumberAndZone(normalizedNumber, normalizedZone, tx);
      if (!table) {
        throw new ApiError(404, 'Table not found', 'TABLE_NOT_FOUND');
      }

      const lines: PaidTicketLine[] = [];
      for (const selected of groupedSelectedItems) {
        if (!Number.isInteger(selected.qty) || selected.qty <= 0) {
          throw new ApiError(400, 'Invalid payment item quantity', 'INVALID_PAYMENT_QTY');
        }

        const orderItem = await workflowRepository.getOrderItemWithOrder(selected.orderId, selected.itemId, tx);
        if (!orderItem || orderItem.order.tableId !== table.id || orderItem.order.status !== 'confirmed') {
          throw new ApiError(404, 'Order item not found for payment', 'PAYMENT_ITEM_NOT_FOUND');
        }
        if (selected.qty > orderItem.qty) {
          throw new ApiError(409, 'Payment item quantity exceeds remaining quantity', 'PAYMENT_QTY_EXCEEDS_REMAINING');
        }

        lines.push({
          orderId: orderItem.orderId,
          orderItemId: orderItem.id,
          menuItemId: orderItem.menuItemId,
          name: orderItem.name,
          primaryName: orderItem.primaryName,
          secondaryName: orderItem.secondaryName,
          qty: selected.qty,
          unitPriceCents: orderItem.unitPriceCents,
          totalPriceCents: checkedLineTotal(selected.qty, orderItem.unitPriceCents),
        });
      }

      const totalCents = checkedCentsSum(lines.map((line) => line.totalPriceCents), 'Ticket total');
      const sequence = await workflowRepository.allocateTicketSequence(TICKET_SERIES, tx);
      const tax = calculateTax(totalCents);
      const mode = 'aa';
      const paidTicket = await workflowRepository.createPaidTicket({
        ticketNumber: nextPaidTicketNumber(sequence),
        idempotencyKey: normalizedIdempotencyKey,
        idempotencyFingerprint: fingerprint,
        mode,
        method: normalizedMethod,
        tableNumber: table.number,
        tableZone: table.zone ?? normalizedZone,
        totalCents,
        ...tax,
        ...getTicketAccountingSnapshot({
          mode,
          method: normalizedMethod,
          tableId: table.id,
          tableNumber: table.number,
          tableZone: table.zone ?? normalizedZone,
          lines,
          selectedItems: groupedSelectedItems,
        }),
        items: lines,
      }, tx);

      for (const [orderId, amountCents] of groupPaymentTotalsByOrder(lines)) {
        await workflowRepository.createPayment(orderId, amountCents, normalizedMethod, tx);
      }

      for (const line of lines) {
        const current = await workflowRepository.getOrderItemWithOrder(line.orderId, line.orderItemId, tx);
        if (!current) {
          continue;
        }
        const nextQty = current.qty - line.qty;
        if (nextQty <= 0) {
          await workflowRepository.deleteOrderItem(current.id, tx);
        } else {
          await workflowRepository.updateOrderItemQty(current.id, nextQty, tx);
        }

        const remainingItems = await workflowRepository.getOrderItems(line.orderId, tx);
        if (remainingItems.length === 0) {
          await workflowRepository.updateOrderStatus(line.orderId, 'paid', tx);
        } else {
          const nextTotal = checkedCentsSum(remainingItems.map((item) => item.totalPriceCents));
          await workflowRepository.updateOrderTotal(line.orderId, nextTotal, tx);
        }
      }

      await this.invalidatePrintedTicket(table.id, tx);

      return {
        paidTicket,
        tableNumber: table.number,
        tableZone: table.zone ?? normalizedZone,
      };
    });
    return this.toPublicPaymentResult(result);
  }

  async removeSelectedItems(
    tableNumber: number,
    tableZone: string,
    selectedItems: Array<{ orderId: string; itemId: number; qty: number }>,
    idempotencyKey: string
  ) {
    const normalizedNumber = normalizeNumber(tableNumber);
    const normalizedZone = normalizeZone(tableZone);
    const normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);

    if (selectedItems.length === 0) {
      throw new ApiError(400, 'No selected items to remove', 'EMPTY_REMOVE_SELECTION');
    }

    const groupedSelectedItems = Array.from(selectedItems.reduce((grouped, item) => {
      const key = `${item.orderId}:${item.itemId}`;
      const current = grouped.get(key);
      grouped.set(key, current ? { ...current, qty: checkedQuantitySum(current.qty, item.qty) } : { ...item });
      return grouped;
    }, new Map<string, { orderId: string; itemId: number; qty: number }>()).values());

    const operation = 'remove-items';
    const fingerprint = createPaymentFingerprint({
      version: 1,
      operation,
      tableNumber: normalizedNumber,
      tableZone: normalizedZone,
      items: [...groupedSelectedItems]
        .sort((left, right) => left.orderId.localeCompare(right.orderId) || left.itemId - right.itemId),
    });

    return this.runMutationTransaction(normalizedIdempotencyKey, operation, fingerprint, async (tx) => {
      const existingReceipt = await workflowRepository.getMutationReceipt(normalizedIdempotencyKey, tx);
      if (existingReceipt) return this.mutationReceiptResult(existingReceipt, operation, fingerprint);

      // Claim the key inside the same transaction as the destructive write.
      // A failed validation or mutation rolls the receipt back as well.
      await workflowRepository.createMutationReceipt({
        idempotencyKey: normalizedIdempotencyKey,
        fingerprint,
        operation,
        tableNumber: normalizedNumber,
        tableZone: normalizedZone,
      }, tx);

      const table = await workflowRepository.getTableByNumberAndZone(normalizedNumber, normalizedZone, tx);
      if (!table) {
        throw new ApiError(404, 'Table not found', 'TABLE_NOT_FOUND');
      }

      const lines: Array<{ orderId: string; orderItemId: number; qty: number }> = [];
      for (const selected of groupedSelectedItems) {
        if (!Number.isInteger(selected.qty) || selected.qty <= 0) {
          throw new ApiError(400, 'Invalid remove item quantity', 'INVALID_REMOVE_QTY');
        }

        const orderItem = await workflowRepository.getOrderItemWithOrder(selected.orderId, selected.itemId, tx);
        if (!orderItem || orderItem.order.tableId !== table.id || orderItem.order.status !== 'confirmed') {
          throw new ApiError(404, 'Order item not found for removal', 'REMOVE_ITEM_NOT_FOUND');
        }
        if (selected.qty > orderItem.qty) {
          throw new ApiError(409, 'Remove item quantity exceeds remaining quantity', 'REMOVE_QTY_EXCEEDS_REMAINING');
        }

        lines.push({
          orderId: orderItem.orderId,
          orderItemId: orderItem.id,
          qty: selected.qty,
        });
      }

      for (const line of lines) {
        const current = await workflowRepository.getOrderItemWithOrder(line.orderId, line.orderItemId, tx);
        if (!current) {
          continue;
        }
        const nextQty = current.qty - line.qty;
        if (nextQty <= 0) {
          await workflowRepository.deleteOrderItem(current.id, tx);
        } else {
          await workflowRepository.updateOrderItemQty(current.id, nextQty, tx);
        }

        const remainingItems = await workflowRepository.getOrderItems(line.orderId, tx);
        if (remainingItems.length === 0) {
          const paymentCount = await workflowRepository.countPaymentsForOrder(line.orderId, tx);
          if (paymentCount > 0) {
            await workflowRepository.updateOrderTotal(line.orderId, 0, tx);
            await workflowRepository.updateOrderStatus(line.orderId, 'paid', tx);
          } else {
            await workflowRepository.deleteOrder(line.orderId, tx);
          }
        } else {
          const nextTotal = checkedCentsSum(remainingItems.map((item) => item.totalPriceCents));
          await workflowRepository.updateOrderTotal(line.orderId, nextTotal, tx);
        }
      }

      await this.invalidatePrintedTicket(table.id, tx);

      return {
        tableNumber: table.number,
        tableZone: table.zone ?? normalizedZone,
      };
    });
  }
}

export const workflowService = new WorkflowService();
