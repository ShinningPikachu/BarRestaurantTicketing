import type { TableDef, PreOrderItem } from '@shared';

const TABLES_STORAGE_KEY = 'bar-ticketing-tables';
const PREORDER_STORAGE_KEY = 'bar-ticketing-preorder';

export class StorageService {
  getDefaultTables(): TableDef[] {
    return [
      { number: 1, zone: 'outside' },
      { number: 2, zone: 'outside' },
      { number: 3, zone: 'outside' },
      { number: 4, zone: 'floor1' },
      { number: 5, zone: 'floor1' },
      { number: 6, zone: 'floor1' },
      { number: 7, zone: 'floor2' },
      { number: 8, zone: 'floor2' }
    ];
  }

  loadTables(): TableDef[] {
    try {
      const raw = localStorage.getItem(TABLES_STORAGE_KEY);
      if (!raw) return this.getDefaultTables();
      const parsed = JSON.parse(raw) as TableDef[];
      if (!Array.isArray(parsed) || parsed.length === 0) return this.getDefaultTables();
      return parsed;
    } catch {
      return this.getDefaultTables();
    }
  }

  saveTables(tables: TableDef[]) {
    try {
      localStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(tables));
    } catch {
      // no-op
    }
  }

  loadPreOrderItems(tableNum: number): PreOrderItem[] {
    try {
      const raw = localStorage.getItem(`${PREORDER_STORAGE_KEY}-${tableNum}`);
      if (!raw) return [];
      return JSON.parse(raw) as PreOrderItem[];
    } catch {
      return [];
    }
  }

  savePreOrderItems(tableNum: number, items: PreOrderItem[]) {
    try {
      if (items.length === 0) {
        localStorage.removeItem(`${PREORDER_STORAGE_KEY}-${tableNum}`);
      } else {
        localStorage.setItem(`${PREORDER_STORAGE_KEY}-${tableNum}`, JSON.stringify(items));
      }
    } catch {
      // no-op
    }
  }
}

export const storageService = new StorageService();
