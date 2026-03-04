import { MenuItem } from '../types';

/**
 * Groups menu items by category
 */
export function groupMenuItemsByCategory(items: MenuItem[]): Map<string, MenuItem[]> {
  const grouped = new Map<string, MenuItem[]>();
  
  for (const item of items) {
    const category = item.category;
    const existing = grouped.get(category) || [];
    grouped.set(category, [...existing, item]);
  }
  
  return grouped;
}

/**
 * Flattens a map of categorized menu items into a single array
 */
export function flattenMenuItems(categorizedMenu: Map<string, MenuItem[]>): MenuItem[] {
  return Array.from(categorizedMenu.values()).flat();
}
