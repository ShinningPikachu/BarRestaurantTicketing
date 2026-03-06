import { flattenMenuItems } from '../helpers';
import { MenuItem, PreOrderItem } from '../types';
import { ConfirmOrderItem } from './app.types';

export function centsToCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function addMenuItemToPreOrder(
  current: PreOrderItem[],
  menuId: number,
  menuByCategory: Map<string, MenuItem[]>
): PreOrderItem[] {
  const allMenuItems = flattenMenuItems(menuByCategory);
  const menu = allMenuItems.find((item) => item.id === menuId);
  if (!menu) {
    return current;
  }

  const existing = current.find((item) => item.menuId === menuId);
  if (existing) {
    return current.map((item) =>
      item.menuId === menuId ? { ...item, qty: item.qty + 1 } : item
    );
  }

  return [...current, { menuId, qty: 1, priceCents: menu.priceCents }];
}

export function incrementPreOrderItem(current: PreOrderItem[], menuId: number): PreOrderItem[] {
  return current.map((item) =>
    item.menuId === menuId ? { ...item, qty: item.qty + 1 } : item
  );
}

export function decrementPreOrderItem(current: PreOrderItem[], menuId: number): PreOrderItem[] {
  return current
    .map((item) =>
      item.menuId === menuId ? { ...item, qty: item.qty - 1 } : item
    )
    .filter((item) => item.qty > 0);
}

export function updatePreOrderItemPrice(
  current: PreOrderItem[],
  menuId: number,
  priceCents: number
): PreOrderItem[] {
  return current.map((item) =>
    item.menuId === menuId ? { ...item, priceCents: Math.max(0, priceCents) } : item
  );
}

export function buildConfirmOrderItems(
  preorderItems: PreOrderItem[],
  menuByCategory: Map<string, MenuItem[]>
): ConfirmOrderItem[] {
  const allMenuItems = flattenMenuItems(menuByCategory);
  return preorderItems
    .map((item) => {
      const menu = allMenuItems.find((menuItem) => menuItem.id === item.menuId);
      if (!menu) {
        return null;
      }

      return {
        name: menu.name,
        qty: item.qty,
        unitPriceCents: item.priceCents
      };
    })
    .filter((item): item is ConfirmOrderItem => item !== null);
}

export function getMenuTitleById(
  menuByCategory: Map<string, MenuItem[]>,
  menuId: number
): string {
  const allMenuItems = flattenMenuItems(menuByCategory);
  const menu = allMenuItems.find((menuItem) => menuItem.id === menuId);
  return menu?.name || `Menu ${menuId}`;
}

export function getPreOrderTotal(preorderItems: PreOrderItem[]): number {
  return preorderItems.reduce((sum, item) => sum + item.qty * item.priceCents, 0);
}
