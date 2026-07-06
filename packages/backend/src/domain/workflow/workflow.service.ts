import { ApiError } from '../../middleware/errorHandler';
import { config } from '../../config';
import { PaidTicketLine, workflowRepository } from './workflow.repository';

const VALID_TABLE_ZONES = new Set(['outside', 'floor1', 'floor2']);
const VALID_PAYMENT_METHODS = new Set(['cash', 'card']);
const DEFAULT_VAT_RATE_PERCENT = 10;

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
  const vatRatePercent = Number.isFinite(configuredVatRate) && configuredVatRate > 0
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
  return `PT-${String(sequence).padStart(6, '0')}`;
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

function workflowHasProducts(workflow: WorkflowState): boolean {
  const hasPendingItems = workflow.preOrderSession?.items.some((item) => item.qty > 0) ?? false;
  const hasConfirmedItems = workflow.orders.some((order) => order.items.some((item) => item.qty > 0));

  return hasPendingItems || hasConfirmedItems;
}

function workflowHasConfirmedProducts(workflow: WorkflowState): boolean {
  return workflow.orders.some((order) => order.items.some((item) => item.qty > 0));
}

export class WorkflowService {
  private async clearPrintedTicketIfTableIsEmpty(
    tableId: number,
    tx?: Parameters<typeof workflowRepository.getTableWorkflow>[1]
  ) {
    const workflow = await workflowRepository.getTableWorkflow(tableId, tx);
    if (!workflowHasProducts(workflow)) {
      await workflowRepository.clearTableTicketPrinted(tableId, tx);
    }
  }

  async listTables() {
    const tables = await workflowRepository.listTables();
    const printedTicketTableIds = await workflowRepository.getPrintedTicketTableIds(tables.map((table) => table.id));

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
          hasPrintedTicket: printedTicketTableIds.has(table.id) && pendingItemCount + confirmedItemCount > 0,
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
    const hasPrintedTicket = await workflowRepository.hasTablePrintedTicket(table.id);

    return {
      table: {
        ...table,
        hasPrintedTicket: hasPrintedTicket && workflowHasProducts(workflow),
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
        await workflowRepository.updatePreOrderItem(existing.id, {
          qty: existing.qty + 1,
          unitPriceCents: existing.unitPriceCents
        }, tx);
      } else {
        await workflowRepository.createPreOrderItem(draftSession.id, {
          menuItemId: menu.id,
          name: menu.name,
          primaryName: menu.primaryName,
          secondaryName: menu.secondaryName,
          qty: 1,
          unitPriceCents: menu.priceCents
        }, tx);
      }

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
        await workflowRepository.updatePreOrderItem(item.id, {
          qty: nextQty,
          unitPriceCents: Math.max(0, nextUnitPrice)
        }, tx);
      }

      await this.clearPrintedTicketIfTableIsEmpty(table.id, tx);

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

      await this.clearPrintedTicketIfTableIsEmpty(table.id, tx);

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

      const order = await workflowRepository.createOrderFromPreOrder(table.id, draftSession!.id, normalizedItems, tx);
      await workflowRepository.createKitchenTicket(order.id, table.id, normalizedItems, tx);
      await workflowRepository.markSessionAsSent(draftSession!.id, tx);

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
        await workflowRepository.updatePreOrderItem(existing.id, {
          qty: existing.qty + orderItem.qty,
          unitPriceCents: existing.unitPriceCents
        }, tx);
      } else {
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
        await workflowRepository.deleteOrder(orderId, tx);
      } else {
        const totalCents = remainingItems.reduce((sum, item) => sum + item.totalPriceCents, 0);
        await workflowRepository.updateOrderTotal(orderId, totalCents, tx);
      }

      await this.clearPrintedTicketIfTableIsEmpty(table.id, tx);

      return {
        tableNumber: table.number,
        tableZone: table.zone ?? 'outside'
      };
    });
  }

  async getAllOrders() {
    return workflowRepository.getAllOrders();
  }

  async deleteOrder(orderId: string) {
    return workflowRepository.runInTransaction(async (tx) => {
      const order = await workflowRepository.getOrderById(orderId, tx);
      if (!order) {
        throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND');
      }

      const tableId = order.tableId;
      await workflowRepository.deleteOrder(orderId, tx);
      await this.clearPrintedTicketIfTableIsEmpty(tableId, tx);
      return { ok: true };
    });
  }

  async payTable(tableNumber: number, tableZone: string, method: string, splitPeople?: number) {
    const normalizedNumber = normalizeNumber(tableNumber);
    const normalizedZone = normalizeZone(tableZone);
    const normalizedMethod = normalizePaymentMethod(method);

    return workflowRepository.runInTransaction(async (tx) => {
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

      const totalCents = lines.reduce((sum, line) => sum + line.totalPriceCents, 0);
      const sequence = await workflowRepository.countPaidTickets(tx) + 1;
      const tax = calculateTax(totalCents);
      const mode = splitPeople && splitPeople > 1 ? 'split' : 'full';
      const paidTicket = await workflowRepository.createPaidTicket({
        ticketNumber: nextPaidTicketNumber(sequence),
        mode,
        method: normalizedMethod,
        tableNumber: table.number,
        tableZone: table.zone ?? normalizedZone,
        totalCents,
        ...tax,
        splitPeople: splitPeople && splitPeople > 1 ? splitPeople : null,
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

      await this.clearPrintedTicketIfTableIsEmpty(table.id, tx);

      return {
        paidTicket,
        tableNumber: table.number,
        tableZone: table.zone ?? normalizedZone,
      };
    });
  }

  async paySelectedItems(
    tableNumber: number,
    tableZone: string,
    method: string,
    selectedItems: Array<{ orderId: string; itemId: number; qty: number }>
  ) {
    const normalizedNumber = normalizeNumber(tableNumber);
    const normalizedZone = normalizeZone(tableZone);
    const normalizedMethod = normalizePaymentMethod(method);

    if (selectedItems.length === 0) {
      throw new ApiError(400, 'No selected items to pay', 'EMPTY_PAYMENT_SELECTION');
    }

    const groupedSelectedItems = Array.from(selectedItems.reduce((grouped, item) => {
      const key = `${item.orderId}:${item.itemId}`;
      const current = grouped.get(key);
      grouped.set(key, current ? { ...current, qty: current.qty + item.qty } : { ...item });
      return grouped;
    }, new Map<string, { orderId: string; itemId: number; qty: number }>()).values());

    return workflowRepository.runInTransaction(async (tx) => {
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
          totalPriceCents: selected.qty * orderItem.unitPriceCents,
        });
      }

      const totalCents = lines.reduce((sum, line) => sum + line.totalPriceCents, 0);
      const sequence = await workflowRepository.countPaidTickets(tx) + 1;
      const tax = calculateTax(totalCents);
      const mode = 'aa';
      const paidTicket = await workflowRepository.createPaidTicket({
        ticketNumber: nextPaidTicketNumber(sequence),
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
          const nextTotal = remainingItems.reduce((sum, item) => sum + item.totalPriceCents, 0);
          await workflowRepository.updateOrderTotal(line.orderId, nextTotal, tx);
        }
      }

      await this.clearPrintedTicketIfTableIsEmpty(table.id, tx);

      return {
        paidTicket,
        tableNumber: table.number,
        tableZone: table.zone ?? normalizedZone,
      };
    });
  }

  async removeSelectedItems(
    tableNumber: number,
    tableZone: string,
    selectedItems: Array<{ orderId: string; itemId: number; qty: number }>
  ) {
    const normalizedNumber = normalizeNumber(tableNumber);
    const normalizedZone = normalizeZone(tableZone);

    if (selectedItems.length === 0) {
      throw new ApiError(400, 'No selected items to remove', 'EMPTY_REMOVE_SELECTION');
    }

    const groupedSelectedItems = Array.from(selectedItems.reduce((grouped, item) => {
      const key = `${item.orderId}:${item.itemId}`;
      const current = grouped.get(key);
      grouped.set(key, current ? { ...current, qty: current.qty + item.qty } : { ...item });
      return grouped;
    }, new Map<string, { orderId: string; itemId: number; qty: number }>()).values());

    return workflowRepository.runInTransaction(async (tx) => {
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
          await workflowRepository.deleteOrder(line.orderId, tx);
        } else {
          const nextTotal = remainingItems.reduce((sum, item) => sum + item.totalPriceCents, 0);
          await workflowRepository.updateOrderTotal(line.orderId, nextTotal, tx);
        }
      }

      await this.clearPrintedTicketIfTableIsEmpty(table.id, tx);

      return {
        tableNumber: table.number,
        tableZone: table.zone ?? normalizedZone,
      };
    });
  }
}

export const workflowService = new WorkflowService();
