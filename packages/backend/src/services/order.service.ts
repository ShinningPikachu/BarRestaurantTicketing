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

  async createOrder(tableId: number, items: any[]) {
    const created = await prisma.order.create({
      data: {
        table: {
          connectOrCreate: {
            where: { number: tableId },
            create: { number: tableId }
          }
        },
        items: {
          create: items.map((it: any) => ({
            name: it.name,
            qty: it.qty,
            unitPriceCents: it.unitPriceCents || 0,
            totalPriceCents: (it.unitPriceCents || 0) * (it.qty || 1)
          }))
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
}

export const orderService = new OrderService();
