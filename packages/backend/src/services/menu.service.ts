import prisma from '../db';

export class MenuService {
  async getAllMenuItems() {
    return prisma.menuItem.findMany({ where: { available: true } });
  }

  async getMenuItemById(id: number) {
    return prisma.menuItem.findUnique({ where: { id } });
  }

  async getMenuItemsByCategory(category: string) {
    return prisma.menuItem.findMany({
      where: { category, available: true }
    });
  }
}

export const menuService = new MenuService();
