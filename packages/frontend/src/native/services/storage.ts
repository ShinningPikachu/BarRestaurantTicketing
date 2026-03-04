import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PreOrderItem, TableDef } from '../types';

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

  async loadTables(): Promise<TableDef[]> {
    try {
      const raw = await AsyncStorage.getItem(TABLES_STORAGE_KEY);
      if (!raw) return this.getDefaultTables();
      const parsed = JSON.parse(raw) as TableDef[];
      if (!Array.isArray(parsed) || parsed.length === 0) return this.getDefaultTables();
      return parsed;
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

  async loadPreOrderItems(tableNum: number): Promise<PreOrderItem[]> {
    try {
      const raw = await AsyncStorage.getItem(`${PREORDER_STORAGE_KEY}-${tableNum}`);
      if (!raw) return [];
      return JSON.parse(raw) as PreOrderItem[];
    } catch {
      return [];
    }
  }

  async savePreOrderItems(tableNum: number, items: PreOrderItem[]): Promise<void> {
    try {
      if (items.length === 0) {
        await AsyncStorage.removeItem(`${PREORDER_STORAGE_KEY}-${tableNum}`);
      } else {
        await AsyncStorage.setItem(`${PREORDER_STORAGE_KEY}-${tableNum}`, JSON.stringify(items));
      }
    } catch {
      // no-op
    }
  }
}

export const storageService = new StorageService();
