import { ApiError } from '../../middleware/errorHandler';
import { workflowRepository } from './workflow.repository';

const VALID_TABLE_ZONES = new Set(['outside', 'floor1', 'floor2']);

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

function getSmallestAvailableTableNumber(existingNumbers: number[]): number {
  let candidate = 1;

  for (const number of existingNumbers) {
    if (number === candidate) {
      candidate += 1;
    }
  }

  return candidate;
}

export class WorkflowService {
  async listTables() {
    const tables = await workflowRepository.listTables();
    return tables.filter((table) => VALID_TABLE_ZONES.has((table.zone ?? '').trim().toLowerCase()));
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

      const dependencies = await workflowRepository.countTableDependencies(table.id, tx);
      if (dependencies.orders > 0 || dependencies.preOrderSessions > 0 || dependencies.kitchenTickets > 0) {
        throw new ApiError(409, 'Table has active orders or workflow data and cannot be removed', 'TABLE_IN_USE');
      }

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
      table,
      preOrderItems: workflow.preOrderSession?.items ?? [],
      orders: workflow.orders
    };
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
        item.name === menu.name
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
        item.name === orderItem.name
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

      await workflowRepository.deleteOrder(orderId, tx);
      return { ok: true };
    });
  }
}

export const workflowService = new WorkflowService();
