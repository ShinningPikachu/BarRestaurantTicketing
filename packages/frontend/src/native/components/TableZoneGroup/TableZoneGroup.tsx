import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, PanResponderGestureState, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { TableId, TableZone, tableKey, tableZoneLabel } from '../../types';
import { styles } from './TableZoneGroup.styles';

interface TablePosition {
  x: number;
  y: number;
}

interface DraggableTableProps {
  table: TableId;
  position: TablePosition;
  isSelected: boolean;
  isMobile: boolean;
  tableWidth: number;
  tableHeight: number;
  maxX: number;
  maxY: number;
  onSelectTable: (table: TableId) => void;
  onDragMove: (table: TableId, nextPosition: TablePosition) => void;
}

const DESKTOP_TABLE_WIDTH = 94;
const DESKTOP_TABLE_HEIGHT = 62;
const DESKTOP_BOARD_VISIBLE_HEIGHT = 176;
const MOBILE_TABLE_WIDTH = 86;
const MOBILE_TABLE_HEIGHT = 54;
const MOBILE_BOARD_VISIBLE_HEIGHT = 190;
const BOARD_PADDING = 12;
const DESKTOP_TABLE_GAP = 8;
const MOBILE_TABLE_GAP = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function DraggableTable({
  table,
  position,
  isSelected,
  isMobile,
  tableWidth,
  tableHeight,
  maxX,
  maxY,
  onSelectTable,
  onDragMove,
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
        isMobile && styles.mobileTableNode,
        isDragging && styles.tableNodeDragging,
        isSelected && styles.tableNodeSelected,
        {
          width: tableWidth,
          height: tableHeight,
          transform: [{ translateX: livePosition.x }, { translateY: livePosition.y }],
        },
      ]}
    >
      <Text selectable={false} style={[styles.tableNodeText, isMobile && styles.mobileTableNodeText, isSelected && styles.tableNodeTextSelected]}>
        {`M${table.number}`}
      </Text>
    </Animated.View>
  );
}

interface TableZoneGroupProps {
  layout?: 'desktop' | 'mobile';
  zone: TableZone;
  numbers: number[];
  selectedTable: TableId;
  onSelectTable: (table: TableId) => void;
  onAddTable: (zone: TableZone) => void;
  onRemoveTable: (table: TableId) => void;
}

export function TableZoneGroup({ layout = 'desktop', zone, numbers, selectedTable, onSelectTable, onAddTable, onRemoveTable }: TableZoneGroupProps): React.JSX.Element {
  const [boardWidth, setBoardWidth] = useState(300);
  const [tablePositions, setTablePositions] = useState<Record<string, TablePosition>>({});
  const isMobile = layout === 'mobile';
  const tableWidth = isMobile ? MOBILE_TABLE_WIDTH : DESKTOP_TABLE_WIDTH;
  const tableHeight = isMobile ? MOBILE_TABLE_HEIGHT : DESKTOP_TABLE_HEIGHT;
  const boardVisibleHeight = isMobile ? MOBILE_BOARD_VISIBLE_HEIGHT : DESKTOP_BOARD_VISIBLE_HEIGHT;
  const tableGap = isMobile ? MOBILE_TABLE_GAP : DESKTOP_TABLE_GAP;

  const tablesPerRow = Math.max(
    1,
    Math.floor((boardWidth - BOARD_PADDING * 2 + tableGap) / (tableWidth + tableGap))
  );
  const rowCount = Math.max(1, Math.ceil(numbers.length / tablesPerRow));
  const boardContentHeight = Math.max(
    boardVisibleHeight,
    BOARD_PADDING * 2 + rowCount * tableHeight + Math.max(0, rowCount - 1) * tableGap
  );
  const maxX = Math.max(0, boardWidth - tableWidth - BOARD_PADDING);
  const maxY = Math.max(0, boardContentHeight - tableHeight - BOARD_PADDING);
  const isSelectedInZone = selectedTable.zone === zone;
  const canRemoveSelected = isSelectedInZone && numbers.length > 1;

  useEffect(() => {
    setTablePositions((previous) => {
      const next: Record<string, TablePosition> = {};

      numbers.forEach((number, index) => {
        const key = tableKey({ zone, number });
        const existing = previous[key];

        if (existing) {
          next[key] = {
            x: clamp(existing.x, 0, maxX),
            y: clamp(existing.y, 0, maxY),
          };
          return;
        }

        const column = index % tablesPerRow;
        const row = Math.floor(index / tablesPerRow);
        next[key] = {
          x: clamp(BOARD_PADDING + column * (tableWidth + tableGap), 0, maxX),
          y: clamp(BOARD_PADDING + row * (tableHeight + tableGap), 0, maxY),
        };
      });

      return next;
    });
  }, [maxX, maxY, numbers, tableGap, tableHeight, tableWidth, tablesPerRow, zone]);

  function handleDragMove(table: TableId, nextPosition: TablePosition): void {
    setTablePositions((previous) => ({
      ...previous,
      [tableKey(table)]: nextPosition,
    }));
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
              position={position}
              isSelected={isSelected}
              isMobile={isMobile}
              tableWidth={tableWidth}
              tableHeight={tableHeight}
              maxX={maxX}
              maxY={maxY}
              onSelectTable={onSelectTable}
              onDragMove={handleDragMove}
            />
          );
        })}
      </ScrollView>
      <TouchableOpacity key={`add-${zone}`} style={styles.addTableButton} onPress={() => onAddTable(zone)}>
        <Text style={styles.addTableButtonText}>{`+ Añadir mesa`}</Text>
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
