export interface OrderItem {
  name: string;
  qty: number;
  unitPriceCents?: number;
  totalPriceCents?: number;
}

export interface Table {
  number: number;
  id?: number;
  name?: string;
  seats?: number;
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
