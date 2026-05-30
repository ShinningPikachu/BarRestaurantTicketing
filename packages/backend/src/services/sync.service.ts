export type DataChangeScope = 'menu' | 'orders' | 'tables';

export interface SyncRevision {
  revision: number;
  changedAt: string;
  scope: DataChangeScope | null;
}

let revision = 0;
let changedAt = new Date().toISOString();
let scope: DataChangeScope | null = null;

export function getSyncRevision(): SyncRevision {
  return {
    revision,
    changedAt,
    scope,
  };
}

export function signalDataChange(nextScope: DataChangeScope): SyncRevision {
  revision += 1;
  changedAt = new Date().toISOString();
  scope = nextScope;
  return getSyncRevision();
}
