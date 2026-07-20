import { useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { SelectedTable } from '../app/app.types';
import { ApiRequestError, apiService, logger } from '../services';
import { BackendTable, TableId, TableKitchenStatus, TABLE_ZONES, TableZone, normalizeTableZone, tableKey, tableZoneLabel } from '../types';

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

function getTableKitchenStatus(table: BackendTable): TableKitchenStatus {
  const pendingItemCount = table.pendingItemCount ?? 0;
  const confirmedItemCount = table.confirmedItemCount ?? 0;
  if (pendingItemCount > 0) {
    return 'pending';
  }
  if (table.hasPrintedTicket && confirmedItemCount > 0) {
    return 'printed';
  }
  if (confirmedItemCount > 0) {
    return 'sent';
  }
  return 'empty';
}

function mapTableKitchenStatuses(tables: BackendTable[]): Map<string, TableKitchenStatus> {
  const statuses = new Map<string, TableKitchenStatus>();

  for (const table of tables) {
    const zone = toKnownZone(table.zone);
    if (zone) {
      statuses.set(tableKey({ zone, number: table.number }), getTableKitchenStatus(table));
    }
  }

  return statuses;
}

function confirmDeleteTable(table: TableId, onConfirm: () => void): void {
  const message = `Se eliminará la mesa M${table.number} en ${tableZoneLabel(table.zone)} y todos sus pedidos pendientes. Esta acción no se puede deshacer.`;

  if (Platform.OS === 'web') {
    const webConfirm = (globalThis as typeof globalThis & { confirm?: (message: string) => boolean }).confirm;
    if (webConfirm?.(message)) {
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
  const [tableKitchenStatuses, setTableKitchenStatuses] = useState<Map<string, TableKitchenStatus>>(new Map());
  const [selectedTable, setSelectedTable] = useState<SelectedTable>({ zone: TableZone.OUTSIDE, number: 1 });
  const selectedTableRef = useRef<SelectedTable>(selectedTable);
  const committedSelectedTableRef = useRef<SelectedTable>(selectedTable);
  const selectionGenerationRef = useRef(0);
  const sessionGenerationRef = useRef(0);
  const tableLoadGenerationRef = useRef(0);

  function commitSelectedTable(table: SelectedTable): void {
    selectedTableRef.current = table;
    committedSelectedTableRef.current = table;
    setSelectedTable(table);
  }

  async function loadTables(): Promise<SelectedTable | null> {
    const sessionGeneration = sessionGenerationRef.current;
    const loadGeneration = ++tableLoadGenerationRef.current;
    const loadedTablesRaw = await apiService.fetchTables();
    if (
      sessionGeneration !== sessionGenerationRef.current
      || loadGeneration !== tableLoadGenerationRef.current
    ) {
      return null;
    }

    const groupedLoaded = mapTablesByZone(loadedTablesRaw);
    const missingZones = TABLE_ZONES.filter((zone) => !(groupedLoaded.get(zone)?.length));

    const createdTables: BackendTable[] = [];
    for (const zone of missingZones) {
      createdTables.push(await apiService.ensureTableZone(zone));
      if (
        sessionGeneration !== sessionGenerationRef.current
        || loadGeneration !== tableLoadGenerationRef.current
      ) {
        return null;
      }
    }

    const ensuredTablesRaw = [...loadedTablesRaw, ...createdTables];
    const loadedTables = mapTablesByZone(ensuredTablesRaw);
    const initialTable = getInitialTable(loadedTables);

    setTables(loadedTables);
    setTableTotals(mapTableTotals(ensuredTablesRaw));
    setTableKitchenStatuses(mapTableKitchenStatuses(ensuredTablesRaw));
    commitSelectedTable(initialTable);

    return initialTable;
  }

  async function refreshTables(): Promise<SelectedTable | null> {
    const sessionGeneration = sessionGenerationRef.current;
    const loadGeneration = ++tableLoadGenerationRef.current;
    const loadedTablesRaw = await apiService.fetchTables();
    if (
      sessionGeneration !== sessionGenerationRef.current
      || loadGeneration !== tableLoadGenerationRef.current
    ) {
      return null;
    }
    const loadedTables = mapTablesByZone(loadedTablesRaw);
    const requestedTable = selectedTableRef.current;
    const selectedStillExists = loadedTables.get(requestedTable.zone)?.includes(requestedTable.number) ?? false;
    const nextSelectedTable = selectedStillExists ? requestedTable : getInitialTable(loadedTables);

    setTables(loadedTables);
    setTableTotals(mapTableTotals(loadedTablesRaw));
    setTableKitchenStatuses(mapTableKitchenStatuses(loadedTablesRaw));
    if (!selectedStillExists) {
      selectionGenerationRef.current += 1;
      commitSelectedTable(nextSelectedTable);
    }

    return nextSelectedTable;
  }

  async function selectTable(table: TableId, onSelected: (tableId: TableId) => Promise<boolean>): Promise<void> {
    const previousTable = committedSelectedTableRef.current;
    const generation = ++selectionGenerationRef.current;
    selectedTableRef.current = table;
    try {
      const didLoad = await onSelected(table);
      if (generation !== selectionGenerationRef.current || !didLoad) {
        if (generation === selectionGenerationRef.current) {
          selectedTableRef.current = previousTable;
        }
        return;
      }
      commitSelectedTable(table);
    } catch {
      if (generation === selectionGenerationRef.current) {
        selectedTableRef.current = previousTable;
        try {
          await onSelected(previousTable);
        } catch {
          // Keep the committed selection visible; the next manual or sync
          // refresh will retry if restoring its workflow also fails.
        }
      }
      Alert.alert('Error', 'No se pudo cambiar de mesa.');
    }
  }

  async function addTable(zone: TableZone, onSelected: (tableId: TableId) => Promise<boolean>): Promise<void> {
    const sessionGeneration = sessionGenerationRef.current;
    try {
      const newTable = await apiService.addTable(zone);
      if (sessionGeneration !== sessionGenerationRef.current) return;
      const loadGeneration = ++tableLoadGenerationRef.current;
      const loadedTables = await apiService.fetchTables();
      if (sessionGeneration !== sessionGenerationRef.current || loadGeneration !== tableLoadGenerationRef.current) return;
      setTables(mapTablesByZone(loadedTables));
      setTableTotals(mapTableTotals(loadedTables));
      setTableKitchenStatuses(mapTableKitchenStatuses(loadedTables));

      const nextTable: TableId = {
        zone: normalizeTableZone(newTable.zone ?? zone),
        number: newTable.number
      };

      const previousTable = committedSelectedTableRef.current;
      const generation = ++selectionGenerationRef.current;
      selectedTableRef.current = nextTable;
      let didLoad: boolean;
      try {
        didLoad = await onSelected(nextTable);
      } catch (error) {
        if (generation === selectionGenerationRef.current) {
          selectedTableRef.current = previousTable;
          await onSelected(previousTable).catch(() => false);
        }
        throw error;
      }
      if (generation !== selectionGenerationRef.current || !didLoad) {
        if (generation === selectionGenerationRef.current) {
          selectedTableRef.current = previousTable;
        }
        return;
      }
      commitSelectedTable(nextTable);
    } catch {
      if (sessionGeneration === sessionGenerationRef.current) {
        Alert.alert('Error', 'No se pudo añadir la mesa.');
      }
    }
  }

  async function removeTable(table: TableId, onSelected: (tableId: TableId) => Promise<boolean>): Promise<void> {
    confirmDeleteTable(table, () => {
      void deleteTable(table, onSelected);
    });
  }

  async function deleteTable(table: TableId, onSelected: (tableId: TableId) => Promise<boolean>): Promise<void> {
    const sessionGeneration = sessionGenerationRef.current;
    try {
      await apiService.deleteTable(table.zone, table.number);
      if (sessionGeneration !== sessionGenerationRef.current) return;
      const loadGeneration = ++tableLoadGenerationRef.current;
      const loadedTables = await apiService.fetchTables();
      if (sessionGeneration !== sessionGenerationRef.current || loadGeneration !== tableLoadGenerationRef.current) return;
      const groupedTables = mapTablesByZone(loadedTables);
      setTables(groupedTables);
      setTableTotals(mapTableTotals(loadedTables));
      setTableKitchenStatuses(mapTableKitchenStatuses(loadedTables));

      const nextTable = getFirstTableInZone(groupedTables, table.zone) ?? getInitialTable(groupedTables);
      const generation = ++selectionGenerationRef.current;
      selectedTableRef.current = nextTable;
      const didLoad = await onSelected(nextTable);
      if (generation === selectionGenerationRef.current) {
        // The old selection no longer exists after a successful deletion.
        // Keep table/workflow context aligned even if the workflow refresh
        // failed; a later refresh can retry loading this replacement table.
        commitSelectedTable(nextTable);
        if (!didLoad) {
          Alert.alert('Mesa eliminada', 'La mesa se eliminó, pero no se pudo cargar la mesa seleccionada. Actualiza los datos para reintentarlo.');
        }
      }
    } catch (error) {
      if (sessionGeneration !== sessionGenerationRef.current) return;
      if (error instanceof ApiRequestError) {
        if (error.code === 'TABLE_HAS_PAYMENT_HISTORY') {
          Alert.alert('Mesa protegida', 'No se puede eliminar una mesa que contiene pedidos con historial de pagos.');
          return;
        }

        if (error.code === 'LAST_TABLE_IN_ZONE') {
          Alert.alert('No se puede eliminar la mesa', 'Cada zona debe conservar al menos una mesa.');
          return;
        }

        if (error.code === 'TABLE_NOT_FOUND') {
          const loadGeneration = ++tableLoadGenerationRef.current;
          const loadedTables = await apiService.fetchTables();
          if (sessionGeneration !== sessionGenerationRef.current || loadGeneration !== tableLoadGenerationRef.current) return;
          const groupedTables = mapTablesByZone(loadedTables);
          setTables(groupedTables);
          setTableTotals(mapTableTotals(loadedTables));
          setTableKitchenStatuses(mapTableKitchenStatuses(loadedTables));

          const currentSelection = selectedTableRef.current;
          const zoneHasSelectedTable = groupedTables.get(currentSelection.zone)?.includes(currentSelection.number) ?? false;
          const nextTable = zoneHasSelectedTable
            ? currentSelection
            : (getFirstTableInZone(groupedTables, table.zone) ?? getInitialTable(groupedTables));

          const generation = ++selectionGenerationRef.current;
          selectedTableRef.current = nextTable;
          const didLoad = await onSelected(nextTable);
          if (generation === selectionGenerationRef.current) {
            commitSelectedTable(nextTable);
            if (!didLoad) {
              Alert.alert('Datos no disponibles', 'No se pudo cargar la mesa seleccionada. Actualiza los datos para reintentarlo.');
            }
          }
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

  function updateTableKitchenStatus(table: TableId, status: TableKitchenStatus): void {
    setTableKitchenStatuses((current) => {
      const key = tableKey(table);
      if (current.get(key) === status) {
        return current;
      }

      const next = new Map(current);
      next.set(key, status);
      return next;
    });
  }

  async function markTableTicketPrinted(table: TableId): Promise<void> {
    const sessionGeneration = sessionGenerationRef.current;
    await apiService.markTableTicketPrinted(table.number, table.zone);
    if (sessionGeneration === sessionGenerationRef.current) {
      updateTableKitchenStatus(table, 'printed');
    }
  }

  function resetTables(): void {
    sessionGenerationRef.current += 1;
    tableLoadGenerationRef.current += 1;
    selectionGenerationRef.current += 1;
    const initialTable = { zone: TableZone.OUTSIDE, number: 1 };
    selectedTableRef.current = initialTable;
    committedSelectedTableRef.current = initialTable;
    setTables(new Map());
    setTableTotals(new Map());
    setTableKitchenStatuses(new Map());
    setSelectedTable(initialTable);
  }

  return {
    state: {
      tables,
      tableTotals,
      tableKitchenStatuses,
      selectedTable,
    },
    actions: {
      loadTables,
      refreshTables,
      selectTable,
      addTable,
      removeTable,
      updateTableTotal,
      updateTableKitchenStatus,
      markTableTicketPrinted,
      resetTables,
    }
  };
}
