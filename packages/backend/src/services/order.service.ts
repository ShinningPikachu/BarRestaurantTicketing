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
}

export const orderService = new OrderService();
