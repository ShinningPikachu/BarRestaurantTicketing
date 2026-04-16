import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../db';

export class WorkflowRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  runInTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.client.$transaction(callback);
  }

  async listTables() {
    return this.client.table.findMany({ orderBy: [{ zone: 'asc' }, { number: 'asc' }] });
  }

  async getTableByNumberAndZone(number: number, zone: string) {
    return this.client.table.findUnique({
      where: {
        number_zone: {
          number,
          zone
        }
      }
    });
  }

  async getHighestTableNumberInZone(zone: string): Promise<number> {
    const table = await this.client.table.findFirst({
      where: { zone },
      orderBy: { number: 'desc' },
      select: { number: true }
    });
    return table?.number ?? 0;
  }

  async createTable(zone: string, number: number) {
    return this.client.table.create({
      data: {
        zone,
        number
      }
    });
  }

  async getDraftPreOrderSession(tableId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.preOrderSession.findFirst({
      where: {
        tableId,
        status: 'draft'
      },
      orderBy: { createdAt: 'desc' },
      include: { items: true }
    });
  }

  async createDraftPreOrderSession(tableId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.preOrderSession.create({
      data: {
        tableId,
        status: 'draft'
      },
      include: { items: true }
    });
  }

  async getMenuItem(menuItemId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.menuItem.findUnique({ where: { id: menuItemId } });
  }

  async createPreOrderItem(
    sessionId: string,
    payload: { menuItemId?: number; name: string; qty: number; unitPriceCents: number },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? this.client;
    return db.preOrderItem.create({
      data: {
        sessionId,
        menuItemId: payload.menuItemId,
        name: payload.name,
        qty: payload.qty,
        unitPriceCents: payload.unitPriceCents,
        totalPriceCents: payload.unitPriceCents * payload.qty
      }
    });
  }

  async updatePreOrderItem(
    preOrderItemId: number,
    payload: { qty: number; unitPriceCents: number },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? this.client;
    return db.preOrderItem.update({
      where: { id: preOrderItemId },
      data: {
        qty: payload.qty,
        unitPriceCents: payload.unitPriceCents,
        totalPriceCents: payload.qty * payload.unitPriceCents
      }
    });
  }

  async deletePreOrderItem(preOrderItemId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.preOrderItem.delete({ where: { id: preOrderItemId } });
  }

  async clearDraftItems(sessionId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.preOrderItem.deleteMany({ where: { sessionId } });
  }

  async markSessionAsSent(sessionId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.preOrderSession.update({
      where: { id: sessionId },
      data: { status: 'sent' }
    });
  }

  async getOrdersForTable(tableId: number) {
    return this.client.order.findMany({
      where: {
        tableId,
        status: 'confirmed'
      },
      include: { items: true, table: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  async getTableWorkflow(tableId: number) {
    const [session, orders] = await Promise.all([
      this.getDraftPreOrderSession(tableId),
      this.getOrdersForTable(tableId)
    ]);

    return {
      preOrderSession: session,
      orders
    };
  }

  async createOrderFromPreOrder(
    tableId: number,
    sessionId: string,
    items: Array<{ menuItemId: number | null; name: string; qty: number; unitPriceCents: number }>,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? this.client;
    const totalCents = items.reduce((sum, item) => sum + item.qty * item.unitPriceCents, 0);

    return db.order.create({
      data: {
        tableId,
        status: 'confirmed',
        totalCents,
        items: {
          create: items.map((item) => ({
            menuItemId: item.menuItemId,
            name: item.name,
            qty: item.qty,
            unitPriceCents: item.unitPriceCents,
            totalPriceCents: item.qty * item.unitPriceCents
          }))
        }
      },
      include: { items: true, table: true }
    });
  }

  async createKitchenTicket(
    orderId: string,
    tableId: number,
    items: Array<{ menuItemId: number | null; name: string; qty: number; unitPriceCents: number }>,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? this.client;

    return db.kitchenTicket.create({
      data: {
        orderId,
        tableId,
        status: 'queued',
        items: {
          create: items.map((item) => ({
            menuItemId: item.menuItemId,
            name: item.name,
            qty: item.qty,
            unitPriceCents: item.unitPriceCents,
            totalPriceCents: item.qty * item.unitPriceCents
          }))
        }
      }
    });
  }

  async getOrderItemWithOrder(orderId: string, itemId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.orderItem.findFirst({
      where: {
        id: itemId,
        orderId
      },
      include: {
        order: {
          include: {
            table: true
          }
        }
      }
    });
  }

  async getPreOrderItemById(itemId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.preOrderItem.findUnique({
      where: { id: itemId },
      include: {
        session: {
          include: {
            table: true
          }
        }
      }
    });
  }

  async getOrderById(orderId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.order.findUnique({
      where: { id: orderId },
      include: { items: true, table: true }
    });
  }

  async deleteOrderItem(orderItemId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.orderItem.delete({ where: { id: orderItemId } });
  }

  async deleteOrder(orderId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    await db.orderItem.deleteMany({ where: { orderId } });
    return db.order.delete({ where: { id: orderId } });
  }

  async updateOrderTotal(orderId: string, totalCents: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.order.update({
      where: { id: orderId },
      data: { totalCents }
    });
  }

  async getOrderItems(orderId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.orderItem.findMany({
      where: { orderId },
      orderBy: { id: 'asc' }
    });
  }

  async getAllOrders() {
    return this.client.order.findMany({ include: { items: true, table: true } });
  }
}

export const workflowRepository = new WorkflowRepository();
