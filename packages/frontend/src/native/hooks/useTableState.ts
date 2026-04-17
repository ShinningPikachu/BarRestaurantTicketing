import { useState } from 'react';
import { SelectedTable } from '../app/app.types';
import { TableZone } from '../types';

export function useTableState() {
  const [selectedTable, setSelectedTable] = useState<SelectedTable | null>(null);
  const [tables, setTables] = useState<Map<TableZone, number[]>>(new Map());

  return {
    selectedTable,
    setSelectedTable,
    tables,
    setTables,
  };
}
