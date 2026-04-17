export enum TableZone {
  OUTSIDE = "outside",
  FLOOR1 = "floor1",
  FLOOR2 = "floor2",
}

export const TABLE_ZONES: TableZone[] = [
  TableZone.OUTSIDE,
  TableZone.FLOOR1,
  TableZone.FLOOR2,
];

export function normalizeTableZone(zone: string | null | undefined): TableZone {
  const normalized = (zone ?? TableZone.OUTSIDE).trim().toLowerCase();
  if (normalized === TableZone.FLOOR1) {
    return TableZone.FLOOR1;
  }
  if (normalized === TableZone.FLOOR2) {
    return TableZone.FLOOR2;
  }
  return TableZone.OUTSIDE;
}

export function tableZoneLabel(zone: TableZone): string {
  if (zone === TableZone.FLOOR1) {
    return 'Floor 1';
  }
  if (zone === TableZone.FLOOR2) {
    return 'Floor 2';
  }
  return 'Outside';
}

export interface TableDef {
  number: number;
  zone: TableZone;
}

export interface TableId {
  zone: TableZone;
  number: number;
}

export function tableKey(table: TableId): string {
  return `${table.zone}-${table.number}`;
}

export interface MenuItem {
  id: number;
  name: string;
  priceCents: number;
  sku?: string;
  category: string;
  description?: string;
  available?: boolean;
}

export interface OrderItem {
  id?: number;
  menuItemId?: number | null;
  name: string;
  qty: number;
  unitPriceCents?: number;
  totalPriceCents?: number;
}

export interface Order {
  id: string;
  tableId?: number;
  table?: {
    id?: number;
    number: number;
    zone?: TableZone;
    seats?: number;
    name?: string;
  };
  status?: string;
  totalCents?: number;
  createdAt?: string;
  updatedAt?: string;
  items: OrderItem[];
}

export interface PreOrderItem {
  id: number;
  menuItemId?: number | null;
  name: string;
  qty: number;
  unitPriceCents: number;
  totalPriceCents: number;
}

export interface BackendTable {
  id: number;
  number: number;
  zone?: string | null;
  seats?: number | null;
  name?: string | null;
}

export interface TableWorkflow {
  table: BackendTable;
  preOrderItems: PreOrderItem[];
  orders: Order[];
}
