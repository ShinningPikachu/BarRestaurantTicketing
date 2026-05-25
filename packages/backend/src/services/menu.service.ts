import prisma from '../db';

interface MenuImportItem {
  name: string;
  priceCents: number;
  costCents?: number | null;
  category: string;
  sku?: string | null;
  description?: string | null;
  available?: boolean;
}

export class MenuService {
  async getAllMenuItems() {
    return prisma.menuItem.findMany({ where: { available: true } });
  }

  async getAllMenuItemsForManagement() {
    return prisma.menuItem.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }

  async getMenuItemById(id: number) {
    return prisma.menuItem.findUnique({ where: { id } });
  }

  async getMenuItemsByCategory(category: string) {
    return prisma.menuItem.findMany({
      where: { category, available: true }
    });
  }

  async createMenuItem(payload: {
    name: string;
    priceCents: number;
    costCents?: number | null;
    category: string;
    sku?: string | null;
    description?: string | null;
    imageDataUrl?: string | null;
    available?: boolean;
  }) {
    return prisma.menuItem.create({
      data: {
        name: payload.name,
        priceCents: payload.priceCents,
        costCents: payload.costCents ?? null,
        category: payload.category,
        sku: payload.sku || null,
        description: payload.description || null,
        imageDataUrl: payload.imageDataUrl || null,
        available: payload.available ?? true,
      }
    });
  }

  async updateMenuItem(id: number, payload: {
    name?: string;
    priceCents?: number;
    costCents?: number | null;
    category?: string;
    sku?: string | null;
    description?: string | null;
    imageDataUrl?: string | null;
    available?: boolean;
  }) {
    return prisma.menuItem.update({
      where: { id },
      data: payload
    });
  }

  async deleteMenuItem(id: number) {
    return prisma.$transaction(async (tx) => {
      const linkFilter = { menuItemId: id };
      const unlinkData = { menuItemId: null };

      await tx.orderItem.updateMany({ where: linkFilter, data: unlinkData });
      await tx.preOrderItem.updateMany({ where: linkFilter, data: unlinkData });
      await tx.kitchenTicketItem.updateMany({ where: linkFilter, data: unlinkData });

      return tx.menuItem.delete({ where: { id } });
    });
  }

  async importMenuItems(items: MenuImportItem[]) {
    let created = 0;
    let updated = 0;

    for (const item of items) {
      const data = {
        name: item.name,
        priceCents: item.priceCents,
        costCents: item.costCents ?? null,
        category: item.category,
        sku: item.sku || null,
        description: item.description || null,
        available: item.available ?? true,
      };
      const existing = item.sku
        ? await prisma.menuItem.findFirst({ where: { sku: item.sku } })
        : await prisma.menuItem.findFirst({ where: { name: item.name, category: item.category } });

      if (existing) {
        await prisma.menuItem.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await prisma.menuItem.create({ data });
        created += 1;
      }
    }

    return { created, updated, total: items.length };
  }
}

export const menuService = new MenuService();
