export interface WorkflowResponseGuard {
  session: number;
  currentSession: number;
  tableKey: string;
  desiredTableKey: string | null;
}

export interface ApplyWorkflowResponseGuard extends WorkflowResponseGuard {
  requestId: number;
  lastAppliedRequestId: number;
}

export function isWorkflowContextCurrent(guard: WorkflowResponseGuard): boolean {
  return guard.session === guard.currentSession
    && guard.desiredTableKey === guard.tableKey;
}

export function shouldApplyWorkflowResponse(guard: ApplyWorkflowResponseGuard): boolean {
  return isWorkflowContextCurrent(guard)
    && guard.requestId > guard.lastAppliedRequestId;
}

export function paymentItemsFingerprint(
  items: Array<{ orderId: string; itemId: number; qty: number }>
): string {
  const grouped = new Map<string, { orderId: string; itemId: number; qty: number }>();
  for (const item of items) {
    const key = `${item.orderId}:${item.itemId}`;
    const current = grouped.get(key);
    grouped.set(key, current ? { ...current, qty: current.qty + item.qty } : { ...item });
  }

  return Array.from(grouped.values())
    .map((item) => `${item.orderId}:${item.itemId}:${item.qty}`)
    .sort()
    .join('|');
}

export function paymentOrdersFingerprint(
  orders: Array<{
    id: string;
    items: Array<{
      id?: number;
      menuItemId?: number | null;
      qty: number;
      unitPriceCents?: number;
    }>;
  }>
): string {
  return orders
    .map((order) => {
      const items = order.items
        .map((item) => [
          item.id ?? null,
          item.menuItemId ?? null,
          item.qty,
          item.unitPriceCents ?? 0,
        ] as const)
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
      return JSON.stringify([order.id, items]);
    })
    .sort()
    .join('|');
}

function createIdempotencyKey(): string {
  return `payment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export class PaymentIdempotencyKeyStore {
  private readonly keysByFingerprint = new Map<string, string>();

  constructor(private readonly keyFactory: () => string = createIdempotencyKey) {}

  getOrCreate(fingerprint: string): string {
    const existing = this.keysByFingerprint.get(fingerprint);
    if (existing) return existing;

    const key = this.keyFactory();
    this.keysByFingerprint.set(fingerprint, key);
    return key;
  }

  clear(fingerprint: string): void {
    this.keysByFingerprint.delete(fingerprint);
  }

  reset(): void {
    this.keysByFingerprint.clear();
  }
}

export class OperationFingerprintLock {
  private readonly fingerprints = new Set<string>();

  tryAcquire(fingerprint: string): boolean {
    if (this.fingerprints.has(fingerprint)) return false;
    this.fingerprints.add(fingerprint);
    return true;
  }

  release(fingerprint: string): void {
    this.fingerprints.delete(fingerprint);
  }

  reset(): void {
    this.fingerprints.clear();
  }
}
