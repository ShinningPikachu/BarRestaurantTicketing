import { workflowRepository } from './workflow.repository';

function normalizeZone(zone: string): string {
  return zone.trim().toLowerCase();
}

function normalizeNumber(number: number): number {
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error('Invalid table number');
  }
  return number;
}

export class WorkflowService {
  async listTables() {
    const tables = await workflowRepository.listTables();
    return tables;
  }

  async addTable(zone: string) {
    const normalizedZone = normalizeZone(zone);
    if (!normalizedZone) {
      throw new Error('Invalid table zone');
    }

    const maxNumber = await workflowRepository.getHighestTableNumberInZone(normalizedZone);
    return workflowRepository.createTable(normalizedZone, maxNumber + 1);
  }

  async getTableWorkflow(tableNumber: number, tableZone: string) {
    const normalizedNumber = normalizeNumber(tableNumber);
    const normalizedZone = normalizeZone(tableZone);

    const table = await workflowRepository.getTableByNumberAndZone(normalizedNumber, normalizedZone);
    if (!table) {
      throw new Error('Table not found');
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
      const table = await workflowRepository.getTableByNumberAndZone(normalizedNumber, normalizedZone);
      if (!table) {
        throw new Error('Table not found');
      }

      const menu = await workflowRepository.getMenuItem(menuItemId, tx);
      if (!menu || !menu.available) {
        throw new Error('Menu item not found');
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
      const table = await workflowRepository.getTableByNumberAndZone(normalizedNumber, normalizedZone);
      if (!table) {
        throw new Error('Table not found');
      }

      const item = await workflowRepository.getPreOrderItemById(preOrderItemId, tx);
      if (!item || item.session.tableId !== table.id || item.session.status !== 'draft') {
        throw new Error('Pre-order item not found');
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
      const table = await workflowRepository.getTableByNumberAndZone(normalizedNumber, normalizedZone);
      if (!table) {
        throw new Error('Table not found');
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
      const table = await workflowRepository.getTableByNumberAndZone(normalizedNumber, normalizedZone);
      if (!table) {
        throw new Error('Table not found');
      }

      const draftSession = await workflowRepository.getDraftPreOrderSession(table.id, tx);
      const items = draftSession?.items ?? [];

      if (items.length === 0) {
        throw new Error('No pre-order items to send');
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
        throw new Error('Order item not found');
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
          menuItemId: orderItem.menuItemId ?? undefined,
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
        throw new Error('Order not found');
      }

      await workflowRepository.deleteOrder(orderId, tx);
      return { ok: true };
    });
  }
}

export const workflowService = new WorkflowService();
