export interface OrderItem {
  name: string;
  qty: number;
}

export interface Order {
  id: string;
  table: number;
  items: OrderItem[];
}
