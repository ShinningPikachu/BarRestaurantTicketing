export interface OrderLineIdentityInput {
  menuItemId?: number | null;
  name: string;
  primaryName?: string | null;
  secondaryName?: string | null;
  unitPriceCents?: number;
}

/**
 * Identifies lines that are safe to aggregate on a customer-facing ticket.
 * Product and every displayed label are included deliberately: two products
 * must never collapse into one line merely because their fallback name and
 * price happen to match.
 */
export function getOrderLineIdentity(item: OrderLineIdentityInput): string {
  return JSON.stringify([
    item.menuItemId ?? null,
    item.name,
    item.primaryName ?? null,
    item.secondaryName ?? null,
    item.unitPriceCents ?? 0,
  ]);
}
