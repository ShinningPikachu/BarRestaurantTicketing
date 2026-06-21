import React, { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, PanResponder, PanResponderGestureState, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { TableId, TableKitchenStatus, TableZone, tableKey, tableZoneLabel } from '../../types';
import { styles } from './TableZoneGroup.styles';

interface TablePosition {
  x: number;
  y: number;
}

interface DraggableTableProps {
  table: TableId;
  totalCents: number;
  kitchenStatus: TableKitchenStatus;
  position: TablePosition;
  isSelected: boolean;
  isMobile: boolean;
  tableWidth: number;
  tableHeight: number;
  maxX: number;
  maxY: number;
  onSelectTable: (table: TableId) => void;
  onDragMove: (table: TableId, nextPosition: TablePosition) => void;
  formatPrice: (cents: number) => string;
}

const DESKTOP_TABLE_WIDTH = 90;
const DESKTOP_TABLE_HEIGHT = 68;
const DESKTOP_BOARD_VISIBLE_HEIGHT = 176;
const MOBILE_TABLE_WIDTH = 82;
const MOBILE_TABLE_HEIGHT = 62;
const MOBILE_BOARD_VISIBLE_HEIGHT = 190;
const BOARD_PADDING = 12;
const DESKTOP_TABLE_GAP = 7;
const MOBILE_TABLE_GAP = 7;
const TABLE_POSITIONS_STORAGE_KEY_PREFIX = 'bar-ticketing-table-positions-v1';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getStorageKey(layout: 'desktop' | 'mobile', zone: TableZone): string {
  return `${TABLE_POSITIONS_STORAGE_KEY_PREFIX}:${layout}:${zone}`;
}

function isTablePosition(value: unknown): value is TablePosition {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const position = value as Partial<TablePosition>;
  return typeof position.x === 'number'
    && Number.isFinite(position.x)
    && typeof position.y === 'number'
    && Number.isFinite(position.y);
}

function parseStoredPositions(value: string | null): Record<string, TablePosition> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<Record<string, TablePosition>>((positions, [key, position]) => {
      if (isTablePosition(position)) {
        positions[key] = position;
      }
      return positions;
    }, {});
  } catch {
    return {};
  }
}

function areTablePositionsEqual(left: Record<string, TablePosition>, right: Record<string, TablePosition>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => {
    const leftPosition = left[key];
    const rightPosition = right[key];
    return rightPosition !== undefined
      && leftPosition.x === rightPosition.x
      && leftPosition.y === rightPosition.y;
  });
}

function DraggableTable({
  table,
  totalCents,
  kitchenStatus,
  position,
  isSelected,
  isMobile,
  tableWidth,
  tableHeight,
  maxX,
  maxY,
  onSelectTable,
  onDragMove,
  formatPrice,
}: DraggableTableProps): React.JSX.Element {
  const livePosition = useRef(new Animated.ValueXY({ x: position.x, y: position.y })).current;
  const currentPositionRef = useRef<TablePosition>(position);
  const dragStartRef = useRef<TablePosition>(position);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isDraggingRef.current) {
      return;
    }

    livePosition.setValue({
      x: clamp(position.x, 0, maxX),
      y: clamp(position.y, 0, maxY),
    });
    currentPositionRef.current = {
      x: clamp(position.x, 0, maxX),
      y: clamp(position.y, 0, maxY),
    };
  }, [livePosition, maxX, maxY, position.x, position.y]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        dragStartRef.current = currentPositionRef.current;
        isDraggingRef.current = true;
        setIsDragging(true);
      },
      onPanResponderMove: (_event: unknown, gesture: PanResponderGestureState) => {
        const nextX = clamp(dragStartRef.current.x + gesture.dx, 0, maxX);
        const nextY = clamp(dragStartRef.current.y + gesture.dy, 0, maxY);
        livePosition.setValue({ x: nextX, y: nextY });
        currentPositionRef.current = { x: nextX, y: nextY };
      },
      onPanResponderRelease: (_event: unknown, gesture: PanResponderGestureState) => {
        const nextX = clamp(dragStartRef.current.x + gesture.dx, 0, maxX);
        const nextY = clamp(dragStartRef.current.y + gesture.dy, 0, maxY);

        livePosition.setValue({ x: nextX, y: nextY });
        currentPositionRef.current = { x: nextX, y: nextY };
        onDragMove(table, { x: nextX, y: nextY });

        isDraggingRef.current = false;
        setIsDragging(false);

        if (Math.abs(gesture.dx) < 3 && Math.abs(gesture.dy) < 3) {
          onSelectTable(table);
        }
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        setIsDragging(false);
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    }),
    [livePosition, maxX, maxY, onDragMove, onSelectTable, table]
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.tableNode,
        kitchenStatus === 'pending' && styles.tableNodePending,
        kitchenStatus === 'sent' && styles.tableNodeSent,
        isMobile && styles.mobileTableNode,
        isDragging && styles.tableNodeDragging,
        isSelected && styles.tableNodeSelected,
        isSelected && kitchenStatus === 'empty' && styles.tableNodeSelectedEmpty,
        {
          width: tableWidth,
          height: tableHeight,
          transform: [{ translateX: livePosition.x }, { translateY: livePosition.y }],
        },
      ]}
    >
      <Text
        selectable={false}
        style={[
          styles.tableNodeText,
          kitchenStatus === 'sent' && styles.tableNodeTextSent,
          isMobile && styles.mobileTableNodeText,
          isSelected && kitchenStatus === 'empty' && styles.tableNodeTextSelected
        ]}
      >
        {`M${table.number}`}
      </Text>
      <Text
        selectable={false}
        style={[
          styles.tableAmountText,
          kitchenStatus === 'pending' && styles.tableAmountTextPending,
          kitchenStatus === 'sent' && styles.tableAmountTextSent,
          isMobile && styles.mobileTableAmountText,
          isSelected && kitchenStatus === 'empty' && styles.tableNodeTextSelected
        ]}
      >
        {formatPrice(totalCents)}
      </Text>
    </Animated.View>
  );
}

interface TableZoneGroupProps {
  layout?: 'desktop' | 'mobile';
  zone: TableZone;
  numbers: number[];
  tableTotals: Map<string, number>;
  tableKitchenStatuses: Map<string, TableKitchenStatus>;
  selectedTable: TableId;
  onSelectTable: (table: TableId) => void;
  onAddTable: (zone: TableZone) => void;
  onRemoveTable: (table: TableId) => void;
  formatPrice: (cents: number) => string;
}

export function TableZoneGroup({ layout = 'desktop', zone, numbers, tableTotals, tableKitchenStatuses, selectedTable, onSelectTable, onAddTable, onRemoveTable, formatPrice }: TableZoneGroupProps): React.JSX.Element {
  const [boardWidth, setBoardWidth] = useState(0);
  const [tablePositions, setTablePositions] = useState<Record<string, TablePosition>>({});
  const [hasLoadedPositions, setHasLoadedPositions] = useState(false);
  const isMobile = layout === 'mobile';
  const tableWidth = isMobile ? MOBILE_TABLE_WIDTH : DESKTOP_TABLE_WIDTH;
  const tableHeight = isMobile ? MOBILE_TABLE_HEIGHT : DESKTOP_TABLE_HEIGHT;
  const boardVisibleHeight = isMobile ? MOBILE_BOARD_VISIBLE_HEIGHT : DESKTOP_BOARD_VISIBLE_HEIGHT;
  const tableGap = isMobile ? MOBILE_TABLE_GAP : DESKTOP_TABLE_GAP;
  const measuredBoardWidth = boardWidth > 0 ? boardWidth : 300;

  const tablesPerRow = Math.max(
    1,
    Math.floor((measuredBoardWidth - BOARD_PADDING * 2 + tableGap) / (tableWidth + tableGap))
  );
  const rowCount = Math.max(1, Math.ceil(numbers.length / tablesPerRow));
  const boardContentHeight = Math.max(
    boardVisibleHeight,
    BOARD_PADDING * 2 + rowCount * tableHeight + Math.max(0, rowCount - 1) * tableGap
  );
  const maxX = Math.max(0, measuredBoardWidth - tableWidth - BOARD_PADDING);
  const maxY = Math.max(0, boardContentHeight - tableHeight - BOARD_PADDING);
  const isSelectedInZone = selectedTable.zone === zone;
  const canRemoveSelected = isSelectedInZone && numbers.length > 1;
  const storageKey = useMemo(() => getStorageKey(layout, zone), [layout, zone]);
  const generatedTablePositions = useMemo(() => {
    const next: Record<string, TablePosition> = {};

    numbers.forEach((number, index) => {
      const column = index % tablesPerRow;
      const row = Math.floor(index / tablesPerRow);
      next[tableKey({ zone, number })] = {
        x: clamp(BOARD_PADDING + column * (tableWidth + tableGap), 0, maxX),
        y: clamp(BOARD_PADDING + row * (tableHeight + tableGap), 0, maxY),
      };
    });

    return next;
  }, [maxX, maxY, numbers, tableGap, tableHeight, tableWidth, tablesPerRow, zone]);

  useEffect(() => {
    let isMounted = true;
    setHasLoadedPositions(false);

    async function loadPositions(): Promise<void> {
      let storedPositions: Record<string, TablePosition> = {};
      try {
        storedPositions = parseStoredPositions(await AsyncStorage.getItem(storageKey));
      } catch {
        storedPositions = {};
      }

      if (!isMounted) {
        return;
      }

      setTablePositions(storedPositions);
      setHasLoadedPositions(true);
    }

    void loadPositions();

    return () => {
      isMounted = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!hasLoadedPositions || boardWidth <= 0) {
      return;
    }

    setTablePositions((previous) => {
      const next: Record<string, TablePosition> = {};

      numbers.forEach((number) => {
        const key = tableKey({ zone, number });
        const existing = previous[key];

        if (existing) {
          next[key] = existing;
          return;
        }

        next[key] = generatedTablePositions[key] ?? { x: BOARD_PADDING, y: BOARD_PADDING };
      });

      return areTablePositionsEqual(previous, next) ? previous : next;
    });
  }, [boardWidth, generatedTablePositions, hasLoadedPositions, numbers, zone]);

  useEffect(() => {
    if (!hasLoadedPositions) {
      return;
    }

    void AsyncStorage.setItem(storageKey, JSON.stringify(tablePositions));
  }, [hasLoadedPositions, storageKey, tablePositions]);

  function handleDragMove(table: TableId, nextPosition: TablePosition): void {
    setTablePositions((previous) => ({
      ...previous,
      [tableKey(table)]: nextPosition,
    }));
  }

  function handleResetPositions(): void {
    setTablePositions(generatedTablePositions);
  }

  return (
    <View style={[styles.zoneGroup, isMobile && styles.mobileZoneGroup]}>
      <Text style={styles.zoneHeader}>{`${tableZoneLabel(zone)} (${numbers.length})`}</Text>
      {!isMobile ? <Text style={styles.hintText}>Mantén pulsada una mesa y arrástrala para moverla.</Text> : null}
      <ScrollView
        style={[styles.zoneBoard, isMobile && styles.mobileZoneBoard]}
        contentContainerStyle={[styles.zoneBoardContent, { height: boardContentHeight }]}
        nestedScrollEnabled
        showsVerticalScrollIndicator
        onLayout={(event) => {
          setBoardWidth(event.nativeEvent.layout.width);
        }}
      >
        {numbers.map((number) => {
          const table: TableId = { zone, number };
          const isSelected = selectedTable.zone === zone && selectedTable.number === number;
          const key = tableKey(table);
          const position = tablePositions[key] ?? { x: 0, y: 0 };

          return (
            <DraggableTable
              key={key}
              table={table}
              totalCents={tableTotals.get(key) ?? 0}
              kitchenStatus={tableKitchenStatuses.get(key) ?? 'empty'}
              position={position}
              isSelected={isSelected}
              isMobile={isMobile}
              tableWidth={tableWidth}
              tableHeight={tableHeight}
              maxX={maxX}
              maxY={maxY}
              onSelectTable={onSelectTable}
              onDragMove={handleDragMove}
              formatPrice={formatPrice}
            />
          );
        })}
      </ScrollView>
      <TouchableOpacity key={`add-${zone}`} style={styles.addTableButton} onPress={() => onAddTable(zone)}>
        <Text style={styles.addTableButtonText}>{`+ Añadir mesa`}</Text>
      </TouchableOpacity>
      <TouchableOpacity key={`reset-${zone}`} style={styles.resetPositionsButton} onPress={handleResetPositions}>
        <Text style={styles.resetPositionsButtonText}>Restablecer posiciones</Text>
      </TouchableOpacity>
      {isSelectedInZone ? (
        <TouchableOpacity
          key={`remove-selected-${zone}`}
          style={[styles.removeSelectedButton, !canRemoveSelected && styles.removeSelectedButtonDisabled]}
          onPress={() => onRemoveTable(selectedTable)}
          disabled={!canRemoveSelected}
        >
          <Text style={styles.removeSelectedButtonText}>{`Eliminar mesa seleccionada M${selectedTable.number}`}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
