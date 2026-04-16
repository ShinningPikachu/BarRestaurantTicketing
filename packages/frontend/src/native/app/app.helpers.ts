import { flattenMenuItems } from '../helpers';
import { MenuItem, PreOrderItem } from '../types';

export function centsToCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
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
  return preorderItems.reduce((sum, item) => sum + item.qty * item.unitPriceCents, 0);
}
