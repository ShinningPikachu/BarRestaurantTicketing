import prisma from '../db';

interface CreateOrderItem {
  name: string;
  qty: number;
  unitPriceCents: number;
  totalPriceCents: number;
  menuItemId?: number | null;
}

export class OrderService {
  async getAllOrders() {
    return prisma.order.findMany({ include: { items: true, table: true } });
  }

  async getOrdersByTable(tableId: number) {
    return prisma.order.findMany({
      where: { tableId },
      include: { items: true, table: true }
    });
  }

  async createOrder(
    tableNumber: number,
    tableZone: string | undefined,
    items: Array<{
      name?: string;
      qty?: number;
      unitPriceCents?: number;
      totalPriceCents?: number;
      menuItemId?: number | null;
    }>
  ) {
    const normalizedZone = tableZone ?? 'outside';

    const normalizedItems: CreateOrderItem[] = items.map((it) => ({
      name: it.name ?? 'Item',
      qty: Math.max(1, it.qty ?? 1),
      unitPriceCents: Math.max(0, it.unitPriceCents ?? 0),
      totalPriceCents: Math.max(0, it.totalPriceCents ?? 0),
      menuItemId: it.menuItemId ?? null,
    }));

    const totalCents = normalizedItems.reduce((sum: number, item) => sum + item.totalPriceCents, 0);

    const created = await prisma.order.create({
      data: {
        status: 'confirmed',
        totalCents,
        table: {
          connectOrCreate: {
            where: { number_zone: { number: tableNumber, zone: normalizedZone } },
            create: { number: tableNumber, zone: normalizedZone }
          }
        },
        items: {
          create: normalizedItems
        }
      },
      include: { items: true, table: true }
    });
    return created;
  }

  async deleteOrder(orderId: string) {
    return prisma.$transaction(async (tx) => {
      const tickets = await tx.kitchenTicket.findMany({
        where: { orderId },
        select: { id: true },
      });

      const ticketIds = tickets.map((ticket) => ticket.id);
      if (ticketIds.length > 0) {
        await tx.kitchenTicketItem.deleteMany({
          where: { ticketId: { in: ticketIds } },
        });
      }

      await tx.kitchenTicket.deleteMany({ where: { orderId } });
      await tx.payment.deleteMany({ where: { orderId } });
      await tx.orderItem.deleteMany({ where: { orderId } });

      return tx.order.delete({ where: { id: orderId } });
    });
  }

  async deleteOrderItem(orderId: string, orderItemId: number) {
    return prisma.$transaction(async (tx) => {
      const deleted = await tx.orderItem.deleteMany({
        where: {
          id: orderItemId,
          orderId
        }
      });

      if (deleted.count === 0) {
        throw new Error('Order item not found');
      }

      const remainingItems = await tx.orderItem.findMany({
        where: { orderId },
        select: { totalPriceCents: true }
      });

      if (remainingItems.length === 0) {
        await tx.order.delete({ where: { id: orderId } });
        return { ok: true, orderDeleted: true };
      }

      const totalCents = remainingItems.reduce((sum, item) => sum + item.totalPriceCents, 0);
      await tx.order.update({
        where: { id: orderId },
        data: { totalCents }
      });

      return { ok: true, orderDeleted: false };
    });
  }
}

export const orderService = new OrderService();
