import { useState } from 'react';
import { Alert } from 'react-native';
import { SelectedTable } from '../app/app.types';
import { apiService, logger } from '../services';
import { BackendTable, TableId, TableZone, normalizeTableZone } from '../types';

function getInitialTable(tables: Map<TableZone, number[]>): SelectedTable {
  for (const [zone, numbers] of tables.entries()) {
    const firstNumber = numbers[0];
    if (firstNumber !== undefined) {
      return { zone, number: firstNumber };
    }
  }

  return { zone: TableZone.OUTSIDE, number: 1 };
}

function mapTablesByZone(tables: BackendTable[]): Map<TableZone, number[]> {
  const grouped = new Map<TableZone, number[]>();

  for (const table of tables) {
    const zone = normalizeTableZone(table.zone);
    const numbers = grouped.get(zone) ?? [];
    grouped.set(zone, [...numbers, table.number]);
  }

  return grouped;
}

export function useTableController() {
  const [tables, setTables] = useState<Map<TableZone, number[]>>(new Map());
  const [selectedTable, setSelectedTable] = useState<SelectedTable>({ zone: TableZone.OUTSIDE, number: 1 });

  async function loadTables(): Promise<SelectedTable> {
    let loadedTablesRaw: BackendTable[] = [];
    try {
      loadedTablesRaw = await apiService.fetchTables();
    } catch (error) {
      logger.warn({ error }, 'Failed to load tables, will create default');
    }

    const ensuredTablesRaw = loadedTablesRaw.length > 0
      ? loadedTablesRaw
      : [await apiService.addTable(TableZone.OUTSIDE)];

    const loadedTables = mapTablesByZone(ensuredTablesRaw);
    const initialTable = getInitialTable(loadedTables);

    setTables(loadedTables);
    setSelectedTable(initialTable);

    return initialTable;
  }

  async function selectTable(table: TableId, onSelected: (tableId: TableId) => Promise<void>): Promise<void> {
    try {
      await onSelected(table);
      setSelectedTable(table);
    } catch {
      Alert.alert('Error', 'Failed to switch table.');
    }
  }

  async function addTable(zone: TableZone, onSelected: (tableId: TableId) => Promise<void>): Promise<void> {
    try {
      const newTable = await apiService.addTable(zone);
      const loadedTables = await apiService.fetchTables();
      setTables(mapTablesByZone(loadedTables));

      const nextTable: TableId = {
        zone: normalizeTableZone(newTable.zone ?? zone),
        number: newTable.number
      };

      setSelectedTable(nextTable);
      await onSelected(nextTable);
    } catch {
      Alert.alert('Error', 'Failed to add table.');
    }
  }

  return {
    state: {
      tables,
      selectedTable,
    },
    actions: {
      loadTables,
      selectTable,
      addTable,
    }
  };
}
