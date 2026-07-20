import { flattenMenuItems } from '../helpers';
import { MenuItem, Order, PreOrderItem } from '../types';

export function centsToCurrency(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function getMenuTitleById(
  menuByCategory: Map<string, MenuItem[]>,
  menuId: number
): string {
  const allMenuItems = flattenMenuItems(menuByCategory);
  const menu = allMenuItems.find((menuItem) => menuItem.id === menuId);
  return menu?.name || `Menú ${menuId}`;
}

export function getPreOrderTotal(preorderItems: PreOrderItem[]): number {
  return preorderItems.reduce((sum, item) => sum + item.qty * item.unitPriceCents, 0);
}

export function getCurrentTableTotal(preorderItems: PreOrderItem[], confirmedOrders: Order[]): number {
  return getPreOrderTotal(preorderItems) + getConfirmedOrdersTotal(confirmedOrders);
}

export function getConfirmedOrdersTotal(confirmedOrders: Order[]): number {
  return confirmedOrders.reduce(
    (sum, order) => sum + order.items.reduce(
      (orderSum, item) => orderSum + item.qty * (item.unitPriceCents ?? 0),
      0
    ),
    0
  );
}
