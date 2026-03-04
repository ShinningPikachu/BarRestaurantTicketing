import { TableDef, TableId, TableZone } from '../types';

export interface TableManagerConfig {
  tables: Map<TableZone, number[]>;
  selectedTable: TableId;
  preorderItems: any[];
  onTablesUpdate: (tables: Map<TableZone, number[]>) => void;
  onSelectedTableUpdate: (table: TableId) => void;
  onPreorderItemsUpdate: (items: any[]) => void;
  storageService: {
    savePreOrderItems: (table: TableId, items: any[]) => Promise<void>;
    saveTables: (tables: TableDef[]) => Promise<void>;
  };
}

export function createTableManager(config: TableManagerConfig) {
  const {
    tables,
    selectedTable,
    preorderItems,
    onTablesUpdate,
    onSelectedTableUpdate,
    onPreorderItemsUpdate,
    storageService
  } = config;

  async function addTable(zone: TableZone): Promise<void> {
    const maxNumber = tables.get(zone)?.reduce((max, num) => Math.max(max, num), 0) ?? 0;
    const newTable: TableDef = { number: maxNumber + 1, zone };
    const updatedTables = new Map(tables);
    const zoneTables = updatedTables.get(zone) || [];
    updatedTables.set(zone, [...zoneTables, newTable.number]);

    await storageService.savePreOrderItems(selectedTable, preorderItems);
    await storageService.saveTables(
      [...updatedTables.entries()].flatMap(([zone, numbers]) => 
        numbers.map((num) => ({ number: num, zone }))
      )
    );

    onTablesUpdate(updatedTables);
    onSelectedTableUpdate({ zone: newTable.zone, number: newTable.number });
    onPreorderItemsUpdate([]);
  }

  async function removeTable(table: TableId): Promise<void> {
    const updatedTables = new Map(tables);
    const zoneTables = updatedTables.get(table.zone) || [];
    const filteredTables = zoneTables.filter(num => num !== table.number);
    
    if (filteredTables.length === 0) {
      updatedTables.delete(table.zone);
    } else {
      updatedTables.set(table.zone, filteredTables);
    }

    await storageService.saveTables(
      [...updatedTables.entries()].flatMap(([zone, numbers]) => 
        numbers.map((num) => ({ number: num, zone }))
      )
    );

    onTablesUpdate(updatedTables);
    
    // If removed table was selected, switch to another table
    if (selectedTable.zone === table.zone && selectedTable.number === table.number) {
      const firstZone = Array.from(updatedTables.keys())[0];
      const firstNumber = updatedTables.get(firstZone)?.[0];
      if (firstZone && firstNumber !== undefined) {
        onSelectedTableUpdate({ zone: firstZone, number: firstNumber });
      }
    }
  }

  return {
    addTable,
    removeTable
  };
}
