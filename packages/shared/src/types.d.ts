/**
 * Shared types for Bar Restaurant Ticketing system
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
export type TableZone = 'outside' | 'floor1' | 'floor2';
export interface Table {
    number: number;
    zone: TableZone;
    id?: number;
    name?: string;
    seats?: number;
}
export interface TableDef {
    number: number;
    zone: TableZone;
}
//# sourceMappingURL=types.d.ts.map