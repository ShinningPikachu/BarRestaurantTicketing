import { flattenMenuItems } from '../helpers';
import { MenuItem, PreOrderItem } from '../types';
import { ConfirmOrderItem } from './app.types';

export function centsToCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Generate a unique ID for preorder items
 */
function generatePreOrderItemId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add a menu item to preorder
 * If a non-modified entry for the same menu item exists, increment its qty.
 * Otherwise create a new entry at original menu price.
 * Modified-price entries always stay separate.
 */
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

  const existingOriginal = current.find(
    (item) =>
      item.menuId === menuId &&
      item.priceCents === item.originalPriceCents &&
      item.originalPriceCents === menu.priceCents
  );

  if (existingOriginal) {
    return current.map((item) =>
      item.id === existingOriginal.id ? { ...item, qty: item.qty + 1 } : item
    );
  }

  const newItem: PreOrderItem = {
    id: generatePreOrderItemId(),
    menuId,
    qty: 1,
    priceCents: menu.priceCents,
    originalPriceCents: menu.priceCents
  };

  return [...current, newItem];
}

/**
 * Increment quantity of a specific preorder item by its unique ID
 */
export function incrementPreOrderItem(current: PreOrderItem[], itemId: string): PreOrderItem[] {
  return current.map((item) =>
    item.id === itemId ? { ...item, qty: item.qty + 1 } : item
  );
}

/**
 * Decrement quantity of a specific preorder item by its unique ID
 * Remove if quantity reaches 0
 */
export function decrementPreOrderItem(current: PreOrderItem[], itemId: string): PreOrderItem[] {
  return current
    .map((item) =>
      item.id === itemId ? { ...item, qty: item.qty - 1 } : item
    )
    .filter((item) => item.qty > 0);
}

/**
 * Update price of a specific preorder item by its unique ID
 */
export function updatePreOrderItemPrice(
  current: PreOrderItem[],
  itemId: string,
  priceCents: number
): PreOrderItem[] {
  return current.map((item) =>
    item.id === itemId ? { ...item, priceCents: Math.max(0, priceCents) } : item
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
