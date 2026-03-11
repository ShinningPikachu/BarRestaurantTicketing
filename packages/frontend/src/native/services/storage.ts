import AsyncStorage from '@react-native-async-storage/async-storage';
import { PreOrderItem, TableDef, TableId, TableZone, tableKey } from '../types';

const TABLES_STORAGE_KEY = 'bar-ticketing-tables';
const PREORDER_STORAGE_KEY = 'bar-ticketing-preorder';

function normalizePreOrderItems(items: unknown): PreOrderItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((raw, index) => {
      if (!raw || typeof raw !== 'object') {
        return null;
      }

      const item = raw as Partial<PreOrderItem>;
      if (typeof item.menuId !== 'number' || typeof item.qty !== 'number') {
        return null;
      }

      const fallbackPrice = typeof item.priceCents === 'number' ? item.priceCents : 0;

      return {
        id: typeof item.id === 'string' && item.id.length > 0 ? item.id : `legacy-${item.menuId}-${Date.now()}-${index}`,
        menuId: item.menuId,
        qty: Math.max(1, item.qty),
        priceCents: fallbackPrice,
        originalPriceCents:
          typeof item.originalPriceCents === 'number' ? item.originalPriceCents : fallbackPrice
      };
    })
    .filter((item): item is PreOrderItem => item !== null);
}

export class StorageService {
  getDefaultTables(): Map<TableZone, number[]> {
    return new Map([
      [TableZone.OUTSIDE, [1, 2, 3]],
      [TableZone.FLOOR1, [1, 2, 3]],
      [TableZone.FLOOR2, [1, 2, 3]]
    ]);
  }

  async loadTables(): Promise<Map<TableZone, number[]>> {
    try {
      const raw = await AsyncStorage.getItem(TABLES_STORAGE_KEY);
      if (!raw) return this.getDefaultTables();
      const parsed = JSON.parse(raw) as TableDef[];
      if (!Array.isArray(parsed) || parsed.length === 0) return this.getDefaultTables();
      
      // Convert TableDef[] to Map<TableZone, number[]>
      const map = new Map<TableZone, number[]>();
      for (const table of parsed) {
        const existing = map.get(table.zone) || [];
        map.set(table.zone, [...existing, table.number]);
      }
      return map;
    } catch {
      return this.getDefaultTables();
    }
  }

  async saveTables(tables: TableDef[]): Promise<void> {
    try {
      await AsyncStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(tables));
    } catch {
      // no-op
    }
  }

  async loadPreOrderItems(table: TableId): Promise<PreOrderItem[]> {
    try {
      const key = tableKey(table);
      const raw = await AsyncStorage.getItem(`${PREORDER_STORAGE_KEY}-${key}`);
      if (!raw) return [];
      return normalizePreOrderItems(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  async savePreOrderItems(table: TableId, items: PreOrderItem[]): Promise<void> {
    try {
      const key = tableKey(table);
      if (items.length === 0) {
        await AsyncStorage.removeItem(`${PREORDER_STORAGE_KEY}-${key}`);
      } else {
        await AsyncStorage.setItem(`${PREORDER_STORAGE_KEY}-${key}`, JSON.stringify(items));
      }
    } catch {
      // no-op
    }
  }
}

export const storageService = new StorageService();
