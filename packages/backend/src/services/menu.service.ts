import prisma from '../db';

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
    category: string;
    sku?: string | null;
    description?: string | null;
    available?: boolean;
  }) {
    return prisma.menuItem.create({
      data: {
        name: payload.name,
        priceCents: payload.priceCents,
        category: payload.category,
        sku: payload.sku || null,
        description: payload.description || null,
        available: payload.available ?? true,
      }
    });
  }

  async updateMenuItem(id: number, payload: {
    name?: string;
    priceCents?: number;
    category?: string;
    sku?: string | null;
    description?: string | null;
    available?: boolean;
  }) {
    return prisma.menuItem.update({
      where: { id },
      data: payload
    });
  }
}

export const menuService = new MenuService();
