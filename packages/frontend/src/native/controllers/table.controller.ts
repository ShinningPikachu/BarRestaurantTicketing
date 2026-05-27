import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { SelectedTable } from '../app/app.types';
import { ApiRequestError, apiService, logger } from '../services';
import { BackendTable, TableId, TABLE_ZONES, TableZone, normalizeTableZone, tableKey, tableZoneLabel } from '../types';

function toKnownZone(zone: string | null | undefined): TableZone | null {
  const normalized = (zone ?? '').trim().toLowerCase();
  if (normalized === TableZone.OUTSIDE) {
    return TableZone.OUTSIDE;
  }
  if (normalized === TableZone.FLOOR1) {
    return TableZone.FLOOR1;
  }
  if (normalized === TableZone.FLOOR2) {
    return TableZone.FLOOR2;
  }
  return null;
}

function getInitialTable(tables: Map<TableZone, number[]>): SelectedTable {
  for (const [zone, numbers] of tables.entries()) {
    const firstNumber = numbers[0];
    if (firstNumber !== undefined) {
      return { zone, number: firstNumber };
    }
  }

  return { zone: TableZone.OUTSIDE, number: 1 };
}

function getFirstTableInZone(tables: Map<TableZone, number[]>, zone: TableZone): SelectedTable | null {
  const numbers = tables.get(zone) ?? [];
  const firstNumber = numbers[0];
  if (firstNumber === undefined) {
    return null;
  }

  return { zone, number: firstNumber };
}

function mapTablesByZone(tables: BackendTable[]): Map<TableZone, number[]> {
  const grouped = new Map<TableZone, number[]>();

  for (const table of tables) {
    const zone = toKnownZone(table.zone);
    if (!zone) {
      logger.warn({ table }, 'Ignoring table with unknown zone');
      continue;
    }

    const numbers = grouped.get(zone) ?? [];
    grouped.set(zone, [...numbers, table.number]);
  }

  for (const [zone, numbers] of grouped.entries()) {
    const uniqueSortedNumbers = Array.from(new Set(numbers)).sort((a, b) => a - b);
    grouped.set(zone, uniqueSortedNumbers);
  }

  return grouped;
}

function mapTableTotals(tables: BackendTable[]): Map<string, number> {
  const totals = new Map<string, number>();

  for (const table of tables) {
    const zone = toKnownZone(table.zone);
    if (zone) {
      totals.set(tableKey({ zone, number: table.number }), table.totalCents ?? 0);
    }
  }

  return totals;
}

function confirmDeleteTable(table: TableId, onConfirm: () => void): void {
  const message = `Se eliminará la mesa M${table.number} en ${tableZoneLabel(table.zone)} y todos sus pedidos pendientes. Esta acción no se puede deshacer.`;

  if (Platform.OS === 'web') {
    const webConfirm = (globalThis as typeof globalThis & { confirm?: (message: string) => boolean }).confirm;
    if (!webConfirm || webConfirm(message)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(
    'Eliminar mesa',
    message,
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: onConfirm,
      },
    ]
  );
}

export function useTableController() {
  const [tables, setTables] = useState<Map<TableZone, number[]>>(new Map());
  const [tableTotals, setTableTotals] = useState<Map<string, number>>(new Map());
  const [selectedTable, setSelectedTable] = useState<SelectedTable>({ zone: TableZone.OUTSIDE, number: 1 });

  async function loadTables(): Promise<SelectedTable> {
    let loadedTablesRaw: BackendTable[] = [];
    try {
      loadedTablesRaw = await apiService.fetchTables();
    } catch (error) {
      logger.warn({ error }, 'Failed to load tables, will create default');
    }

    const groupedLoaded = mapTablesByZone(loadedTablesRaw);
    const missingZones = TABLE_ZONES.filter((zone) => !(groupedLoaded.get(zone)?.length));

    const createdTables: BackendTable[] = [];
    for (const zone of missingZones) {
      createdTables.push(await apiService.addTable(zone));
    }

    const ensuredTablesRaw = [...loadedTablesRaw, ...createdTables];
    const loadedTables = mapTablesByZone(ensuredTablesRaw);
    const initialTable = getInitialTable(loadedTables);

    setTables(loadedTables);
    setTableTotals(mapTableTotals(ensuredTablesRaw));
    setSelectedTable(initialTable);

    return initialTable;
  }

  async function selectTable(table: TableId, onSelected: (tableId: TableId) => Promise<void>): Promise<void> {
    try {
      await onSelected(table);
      setSelectedTable(table);
    } catch {
      Alert.alert('Error', 'No se pudo cambiar de mesa.');
    }
  }

  async function addTable(zone: TableZone, onSelected: (tableId: TableId) => Promise<void>): Promise<void> {
    try {
      const newTable = await apiService.addTable(zone);
      const loadedTables = await apiService.fetchTables();
      setTables(mapTablesByZone(loadedTables));
      setTableTotals(mapTableTotals(loadedTables));

      const nextTable: TableId = {
        zone: normalizeTableZone(newTable.zone ?? zone),
        number: newTable.number
      };

      setSelectedTable(nextTable);
      await onSelected(nextTable);
    } catch {
      Alert.alert('Error', 'No se pudo añadir la mesa.');
    }
  }

  async function removeTable(table: TableId, onSelected: (tableId: TableId) => Promise<void>): Promise<void> {
    confirmDeleteTable(table, () => {
      void deleteTable(table, onSelected);
    });
  }

  async function deleteTable(table: TableId, onSelected: (tableId: TableId) => Promise<void>): Promise<void> {
    try {
      await apiService.deleteTable(table.zone, table.number);
      const loadedTables = await apiService.fetchTables();
      const groupedTables = mapTablesByZone(loadedTables);
      setTables(groupedTables);
      setTableTotals(mapTableTotals(loadedTables));

      const nextTable = getFirstTableInZone(groupedTables, table.zone) ?? getInitialTable(groupedTables);
      setSelectedTable(nextTable);
      await onSelected(nextTable);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.code === 'LAST_TABLE_IN_ZONE') {
          Alert.alert('No se puede eliminar la mesa', 'Cada zona debe conservar al menos una mesa.');
          return;
        }

        if (error.code === 'TABLE_NOT_FOUND') {
          const loadedTables = await apiService.fetchTables();
          const groupedTables = mapTablesByZone(loadedTables);
          setTables(groupedTables);
          setTableTotals(mapTableTotals(loadedTables));

          const zoneHasSelectedTable = groupedTables.get(selectedTable.zone)?.includes(selectedTable.number) ?? false;
          const nextTable = zoneHasSelectedTable
            ? selectedTable
            : (getFirstTableInZone(groupedTables, table.zone) ?? getInitialTable(groupedTables));

          setSelectedTable(nextTable);
          await onSelected(nextTable);
          Alert.alert('Mesa ya eliminada', `La mesa M${table.number} en ${tableZoneLabel(table.zone)} ya no existe.`);
          return;
        }
      }

      logger.error({ error, table }, 'Failed to remove table');
      Alert.alert('Error', 'No se pudo eliminar la mesa.');
    }
  }

  function updateTableTotal(table: TableId, totalCents: number): void {
    setTableTotals((current) => {
      const key = tableKey(table);
      if (current.get(key) === totalCents) {
        return current;
      }

      const next = new Map(current);
      next.set(key, totalCents);
      return next;
    });
  }

  return {
    state: {
      tables,
      tableTotals,
      selectedTable,
    },
    actions: {
      loadTables,
      selectTable,
      addTable,
      removeTable,
      updateTableTotal,
    }
  };
}
