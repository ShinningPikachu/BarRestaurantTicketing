import { randomUUID } from 'node:crypto';

export type DataChangeScope = 'menu' | 'orders' | 'tables';

export interface SyncRevision {
  instanceId: string;
  revision: number;
  changedAt: string;
  scope: DataChangeScope | null;
}

// A revision counter is only meaningful within one backend process. Including
// an instance identifier lets clients detect a restart even when the new
// process reaches the same numeric revision as the old one.
const instanceId = randomUUID();
let revision = 0;
let changedAt = new Date().toISOString();
let scope: DataChangeScope | null = null;

export function getSyncRevision(): SyncRevision {
  return {
    instanceId,
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
