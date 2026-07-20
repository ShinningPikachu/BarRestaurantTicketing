import { PrismaClient } from '@prisma/client';
import prisma from '../db.js';
import { MenuImportItem } from './menu-import.js';

export class MenuService {
  constructor(private readonly client: PrismaClient = prisma) {}

  async getAllMenuItems() {
    return this.client.menuItem.findMany({ where: { available: true } });
  }

  async getAllMenuItemsForManagement() {
    return this.client.menuItem.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }

  async getMenuItemById(id: number) {
    return this.client.menuItem.findUnique({ where: { id } });
  }

  async getMenuItemsByCategory(category: string) {
    return this.client.menuItem.findMany({
      where: { category, available: true }
    });
  }

  async createMenuItem(payload: {
    name: string;
    primaryName?: string | null;
    secondaryName?: string | null;
    priceCents: number;
    costCents?: number | null;
    category: string;
    sku?: string | null;
    description?: string | null;
    imageDataUrl?: string | null;
    available?: boolean;
  }) {
    return this.client.menuItem.create({
      data: {
        name: payload.name,
        primaryName: payload.primaryName || null,
        secondaryName: payload.secondaryName || null,
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
    primaryName?: string | null;
    secondaryName?: string | null;
    priceCents?: number;
    costCents?: number | null;
    category?: string;
    sku?: string | null;
    description?: string | null;
    imageDataUrl?: string | null;
    available?: boolean;
  }) {
    return this.client.menuItem.update({
      where: { id },
      data: payload
    });
  }

  async deleteMenuItem(id: number) {
    return this.client.$transaction(async (tx) => {
      const linkFilter = { menuItemId: id };
      const unlinkData = { menuItemId: null };

      await tx.orderItem.updateMany({ where: linkFilter, data: unlinkData });
      await tx.preOrderItem.updateMany({ where: linkFilter, data: unlinkData });

      return tx.menuItem.delete({ where: { id } });
    });
  }

  async importMenuItems(items: MenuImportItem[]) {
    return this.client.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;

      for (const item of items) {
        const data = {
          name: item.name,
          primaryName: item.primaryName || null,
          secondaryName: item.secondaryName || null,
          priceCents: item.priceCents,
          costCents: item.costCents ?? null,
          category: item.category,
          sku: item.sku || null,
          description: item.description || null,
          imageDataUrl: item.imageDataUrl || null,
          available: item.available ?? true,
        };
        const existing = item.sku
          ? await tx.menuItem.findFirst({ where: { sku: item.sku } })
          : await tx.menuItem.findFirst({ where: { name: item.name, category: item.category } });

        if (existing) {
          await tx.menuItem.update({ where: { id: existing.id }, data });
          updated += 1;
        } else {
          await tx.menuItem.create({ data });
          created += 1;
        }
      }

      return { created, updated, total: items.length };
    }, { timeout: 30_000 });
  }
}

export const menuService = new MenuService();
