/**
 * Order and order item type definitions
 */

import type { Table } from './table';

export interface OrderItem {
  name: string;
  qty: number;
  unitPriceCents?: number;
  totalPriceCents?: number;
}

export interface Order {
  id: string;
  tableId?: number;
  table?: Table;
  status?: string;
  totalCents?: number;
  createdAt?: string;
  updatedAt?: string;
  items: OrderItem[];
}

export interface PreOrderItem {
  menuId: number;
  qty: number;
  priceCents: number;
}
