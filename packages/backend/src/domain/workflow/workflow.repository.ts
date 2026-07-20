import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../db.js';

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

  async markTableTicketPrinted(tableId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.table.update({
      where: { id: tableId },
      data: { ticketPrintedAt: new Date() },
    });
  }

  async clearTableTicketPrinted(tableId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.table.update({
      where: { id: tableId },
      data: { ticketPrintedAt: null },
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

  async ensureFirstTableInZone(zone: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.table.upsert({
      where: { number_zone: { number: 1, zone } },
      create: { zone, number: 1 },
      update: {},
    });
  }

  async countTablesInZone(zone: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.table.count({ where: { zone } });
  }

  async countTableFinancialDependencies(tableId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    const [payments, paidOrders] = await Promise.all([
      db.payment.count({ where: { order: { tableId } } }),
      db.order.count({ where: { tableId, status: 'paid' } }),
    ]);
    return { payments, paidOrders };
  }

  async deleteTable(tableId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.table.delete({ where: { id: tableId } });
  }

  async deleteTableWorkflowData(tableId: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;

    const [orders, preOrderSessions] = await Promise.all([
      db.order.findMany({ where: { tableId }, select: { id: true } }),
      db.preOrderSession.findMany({ where: { tableId }, select: { id: true } }),
    ]);

    const orderIds = orders.map((order) => order.id);
    const preOrderSessionIds = preOrderSessions.map((session) => session.id);

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

  async deleteDraftSession(sessionId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    await db.preOrderItem.deleteMany({ where: { sessionId } });
    return db.preOrderSession.delete({ where: { id: sessionId } });
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

  async allocateTicketSequence(series: string, tx?: Prisma.TransactionClient): Promise<number> {
    const db = tx ?? this.client;
    const sequence = await db.ticketSequence.upsert({
      where: { series },
      create: { series, value: 1 },
      update: { value: { increment: 1 } },
      select: { value: true },
    });
    return sequence.value;
  }

  async getPaidTicketByIdempotencyKey(idempotencyKey: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.paidTicket.findUnique({
      where: { idempotencyKey },
      include: { items: true },
    });
  }

  async getMutationReceipt(idempotencyKey: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.client;
    return db.mutationReceipt.findUnique({ where: { idempotencyKey } });
  }

  async createMutationReceipt(
    payload: {
      idempotencyKey: string;
      fingerprint: string;
      operation: string;
      tableNumber: number;
      tableZone: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? this.client;
    return db.mutationReceipt.create({ data: payload });
  }

  async createPaidTicket(
    payload: {
      ticketNumber: string;
      idempotencyKey: string;
      idempotencyFingerprint: string;
      mode: string;
      method: string;
      tableNumber: number;
      tableZone: string;
      totalCents: number;
      taxableBaseCents: number;
      vatCents: number;
      vatRatePercent: number;
      splitPeople?: number | null;
      businessName?: string;
      tradeName?: string;
      businessTaxId?: string;
      businessAddress?: string | null;
      businessCity?: string | null;
      businessPhone?: string | null;
      terminalId?: string | null;
      cashierName?: string | null;
      customerName?: string | null;
      customerTaxId?: string | null;
      status?: string;
      relatedTicketNumber?: string | null;
      pdfFileReference?: string | null;
      auditMetadata?: string | null;
      items: PaidTicketLine[];
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx ?? this.client;
    const snapshot = {
      businessName: payload.businessName ?? '',
      tradeName: payload.tradeName ?? '',
      businessTaxId: payload.businessTaxId ?? '',
      businessAddress: payload.businessAddress ?? null,
      businessCity: payload.businessCity ?? null,
      businessPhone: payload.businessPhone ?? null,
      terminalId: payload.terminalId ?? null,
      cashierName: payload.cashierName ?? null,
      customerName: payload.customerName ?? null,
      customerTaxId: payload.customerTaxId ?? null,
      status: payload.status ?? 'paid',
      relatedTicketNumber: payload.relatedTicketNumber ?? null,
      pdfFileReference: payload.pdfFileReference ?? null,
      auditMetadata: payload.auditMetadata ?? null,
    };

    return db.paidTicket.create({
      data: {
        ticketNumber: payload.ticketNumber,
        idempotencyKey: payload.idempotencyKey,
        idempotencyFingerprint: payload.idempotencyFingerprint,
        mode: payload.mode,
        method: payload.method,
        tableNumber: payload.tableNumber,
        tableZone: payload.tableZone,
        totalCents: payload.totalCents,
        taxableBaseCents: payload.taxableBaseCents,
        vatCents: payload.vatCents,
        vatRatePercent: payload.vatRatePercent,
        splitPeople: payload.splitPeople ?? null,
        ...snapshot,
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

  async countPaymentsForOrder(orderId: string, tx?: Prisma.TransactionClient): Promise<number> {
    const db = tx ?? this.client;
    return db.payment.count({ where: { orderId } });
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

}

export const workflowRepository = new WorkflowRepository();
