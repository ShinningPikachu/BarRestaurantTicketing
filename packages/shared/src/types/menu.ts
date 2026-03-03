/**
 * Menu item type definitions
 */

export interface MenuItem {
  id: number;
  name: string;
  priceCents: number;
  sku?: string;
  category?: string;
  description?: string;
  available?: boolean;
}
