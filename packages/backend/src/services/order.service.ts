import prisma from '../db';

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

  async createOrder(tableNumber: number, tableZone: string | undefined, items: any[]) {
    const normalizedItems = items.map((it: any) => ({
      name: it.name,
      qty: it.qty || 1,
      unitPriceCents: it.unitPriceCents || 0,
      totalPriceCents: (it.unitPriceCents || 0) * (it.qty || 1)
    }));

    const totalCents = normalizedItems.reduce((sum: number, item: any) => sum + item.totalPriceCents, 0);
    
    const whereClause = tableZone 
      ? { number_zone: { number: tableNumber, zone: tableZone } }
      : { number_zone: { number: tableNumber, zone: null } };

    const created = await prisma.order.create({
      data: {
        status: 'confirmed',
        totalCents,
        table: {
          connectOrCreate: {
            where: whereClause as any,
            create: { number: tableNumber, zone: tableZone }
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
    await prisma.orderItem.deleteMany({ where: { orderId } });
    return prisma.order.delete({ where: { id: orderId } });
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
