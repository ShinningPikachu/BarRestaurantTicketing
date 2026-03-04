export enum TableZone {
  OUTSIDE = "outside",
  FLOOR1 = "floor1",
  FLOOR2 = "floor2",
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
  category?: string;
  description?: string;
  available?: boolean;
}

export interface OrderItem {
  id?: number;
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
  menuId: number;
  qty: number;
  priceCents: number;
}
