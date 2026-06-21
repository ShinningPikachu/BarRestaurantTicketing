import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../db';

export interface PaidTicketLine {
  orderId: string;
  orderItemId: number;
  menuItemId?: number | null;
  name: string;
  primaryName?: string | null;
  secondaryName?: string | null;
  qty: number;
  unitPriceCents: number;
  totalPriceCents: number;
}

export class WorkflowRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  runInTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.client.$transaction(callback);
  }

  async listTables() {
    return this.client.table.findMany({
      orderBy: [{ zone: 'asc' }, { number: 'asc' }],
      include: {
        orders: {
          where: { status: 'confirmed' },
          select: {
            totalCents: true,
            items: {
              select: { qty: true },
            },
          },
        },
        preOrderSessions: {
          where: { status: 'draft' },
          select: {
            items: {
              select: { qty: true, unitPriceCents: true },
            },
          },
        },
      },
    });
  }

  async getTableByNumberAndZone(number: number, zone: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.table.findUnique({
      where: {
        number_zone: {
          number,
          zone
        }
      }
    });
  }

  async getTableNumbersInZone(zone: string, tx?: Prisma.TransactionClient): Promise<number[]> {
    const db = tx ?? this.client;
    const tables = await db.table.findMany({
      where: { zone },
      orderBy: { number: 'asc' },
      select: { number: true }
    });

    return tables.map((table) => table.number);
  }

  async createTable(zone: string, number: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.table.create({
      data: {
        zone,
        number
      }
    });
  }

  async countTablesInZone(zone: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.table.count({ where: { zone } });
  }

  async countTableDependencies(tableId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;

    const [orders, preOrderSessions, kitchenTickets] = await Promise.all([
      db.order.count({ where: { tableId } }),
      db.preOrderSession.count({ where: { tableId } }),
      db.kitchenTicket.count({ where: { tableId } }),
    ]);

    return { orders, preOrderSessions, kitchenTickets };
  }

  async deleteTable(tableId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.table.delete({ where: { id: tableId } });
  }

  async deleteTableWorkflowData(tableId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;

    const [orders, preOrderSessions, kitchenTickets] = await Promise.all([
      db.order.findMany({ where: { tableId }, select: { id: true } }),
      db.preOrderSession.findMany({ where: { tableId }, select: { id: true } }),
      db.kitchenTicket.findMany({ where: { tableId }, select: { id: true } }),
    ]);

    const orderIds = orders.map((order) => order.id);
    const preOrderSessionIds = preOrderSessions.map((session) => session.id);
    const kitchenTicketIds = kitchenTickets.map((ticket) => ticket.id);

    if (kitchenTicketIds.length > 0) {
      await db.kitchenTicketItem.deleteMany({
        where: { ticketId: { in: kitchenTicketIds } },
      });
      await db.kitchenTicket.deleteMany({ where: { id: { in: kitchenTicketIds } } });
    }

    if (orderIds.length > 0) {
      await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.order.deleteMany({ where: { id: { in: orderIds } } });
    }

    if (preOrderSessionIds.length > 0) {
      await db.preOrderItem.deleteMany({
        where: { sessionId: { in: preOrderSessionIds } },
      });
      await db.preOrderSession.deleteMany({ where: { id: { in: preOrderSessionIds } } });
    }
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
    payload: { menuItemId?: number | null; name: string; primaryName?: string | null; secondaryName?: string | null; qty: number; unitPriceCents: number },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? this.client;

    const data: Prisma.PreOrderItemUncheckedCreateInput = {
      sessionId,
      name: payload.name,
      primaryName: payload.primaryName ?? null,
      secondaryName: payload.secondaryName ?? null,
      qty: payload.qty,
      unitPriceCents: payload.unitPriceCents,
      totalPriceCents: payload.unitPriceCents * payload.qty
    };

    if (payload.menuItemId !== undefined && payload.menuItemId !== null) {
      data.menuItemId = payload.menuItemId;
    }

    return db.preOrderItem.create({ data });
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

  async getOrdersForTable(tableId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.order.findMany({
      where: {
        tableId,
        status: 'confirmed'
      },
      include: { items: true, table: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  async countPaidTickets(tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.paidTicket.count();
  }

  async createPaidTicket(
    payload: {
      ticketNumber: string;
      mode: string;
      method: string;
      tableNumber: number;
      tableZone: string;
      totalCents: number;
      taxableBaseCents: number;
      vatCents: number;
      vatRatePercent: number;
      splitPeople?: number | null;
      items: PaidTicketLine[];
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? this.client;

    return db.paidTicket.create({
      data: {
        ticketNumber: payload.ticketNumber,
        mode: payload.mode,
        method: payload.method,
        tableNumber: payload.tableNumber,
        tableZone: payload.tableZone,
        totalCents: payload.totalCents,
        taxableBaseCents: payload.taxableBaseCents,
        vatCents: payload.vatCents,
        vatRatePercent: payload.vatRatePercent,
        splitPeople: payload.splitPeople ?? null,
        items: {
          create: payload.items.map((item) => ({
            orderId: item.orderId,
            orderItemId: item.orderItemId,
            menuItemId: item.menuItemId ?? null,
            name: item.name,
            primaryName: item.primaryName ?? null,
            secondaryName: item.secondaryName ?? null,
            qty: item.qty,
            unitPriceCents: item.unitPriceCents,
            totalPriceCents: item.totalPriceCents,
          })),
        },
      },
      include: { items: true },
    });
  }

  async createPayment(orderId: string, amountCents: number, method: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.payment.create({
      data: {
        orderId,
        amountCents,
        method,
      },
    });
  }

  async getTableWorkflow(tableId: number, tx?: Prisma.TransactionClient) {
    const [session, orders] = await Promise.all([
      this.getDraftPreOrderSession(tableId, tx),
      this.getOrdersForTable(tableId, tx)
    ]);

    return {
      preOrderSession: session,
      orders
    };
  }

  async createOrderFromPreOrder(
    tableId: number,
    sessionId: string,
    items: Array<{ menuItemId: number | null; name: string; primaryName?: string | null; secondaryName?: string | null; qty: number; unitPriceCents: number }>,
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
            primaryName: item.primaryName ?? null,
            secondaryName: item.secondaryName ?? null,
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
    items: Array<{ menuItemId: number | null; name: string; primaryName?: string | null; secondaryName?: string | null; qty: number; unitPriceCents: number }>,
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
            primaryName: item.primaryName ?? null,
            secondaryName: item.secondaryName ?? null,
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

  async updateOrderItemQty(orderItemId: number, qty: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.orderItem.update({
      where: { id: orderItemId },
      data: {
        qty,
        totalPriceCents: qty * (await db.orderItem.findUniqueOrThrow({
          where: { id: orderItemId },
          select: { unitPriceCents: true }
        })).unitPriceCents
      }
    });
  }

  async deleteOrder(orderId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;

    const tickets = await db.kitchenTicket.findMany({
      where: { orderId },
      select: { id: true },
    });

    const ticketIds = tickets.map((ticket) => ticket.id);
    if (ticketIds.length > 0) {
      await db.kitchenTicketItem.deleteMany({
        where: { ticketId: { in: ticketIds } },
      });
    }

    await db.kitchenTicket.deleteMany({ where: { orderId } });
    await db.payment.deleteMany({ where: { orderId } });
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

  async updateOrderStatus(orderId: string, status: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.order.update({
      where: { id: orderId },
      data: { status }
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
