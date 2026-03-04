export type TableZone = 'outside' | 'floor1' | 'floor2';

export interface TableDef {
  number: number;
  zone: TableZone;
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
