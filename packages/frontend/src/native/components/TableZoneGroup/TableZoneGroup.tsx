import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, PanResponder, PanResponderGestureState, Text, TouchableOpacity, View } from 'react-native';
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
  maxX: number;
  maxY: number;
  onSelectTable: (table: TableId) => void;
  onDragMove: (table: TableId, nextPosition: TablePosition) => void;
}

const TABLE_WIDTH = 92;
const TABLE_HEIGHT = 56;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function DraggableTable({
  table,
  position,
  isSelected,
  maxX,
  maxY,
  onSelectTable,
  onDragMove,
}: DraggableTableProps): React.JSX.Element {
  const dragStartRef = useRef<TablePosition>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        dragStartRef.current = position;
        setIsDragging(true);
      },
      onPanResponderMove: (_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
        const nextX = clamp(dragStartRef.current.x + gesture.dx, 0, maxX);
        const nextY = clamp(dragStartRef.current.y + gesture.dy, 0, maxY);
        onDragMove(table, { x: nextX, y: nextY });
      },
      onPanResponderRelease: (_event: GestureResponderEvent, gesture: PanResponderGestureState) => {
        setIsDragging(false);
        if (Math.abs(gesture.dx) < 3 && Math.abs(gesture.dy) < 3) {
          onSelectTable(table);
        }
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
      },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    }),
    [maxX, maxY, onDragMove, onSelectTable, position, table]
  );

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.tableNode,
        isDragging && styles.tableNodeDragging,
        isSelected && styles.tableNodeSelected,
        { left: position.x, top: position.y },
      ]}
    >
      <Text selectable={false} style={[styles.tableNodeText, isSelected && styles.tableNodeTextSelected]}>
        {`T${table.number}`}
      </Text>
    </View>
  );
}

interface TableZoneGroupProps {
  zone: TableZone;
  numbers: number[];
  selectedTable: TableId;
  onSelectTable: (table: TableId) => void;
  onAddTable: (zone: TableZone) => void;
}

export function TableZoneGroup({ zone, numbers, selectedTable, onSelectTable, onAddTable }: TableZoneGroupProps): React.JSX.Element {
  const [boardWidth, setBoardWidth] = useState(300);
  const [tablePositions, setTablePositions] = useState<Record<string, TablePosition>>({});

  const maxX = Math.max(0, boardWidth - TABLE_WIDTH);
  const maxY = 300 - TABLE_HEIGHT;

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

        const column = index % 3;
        const row = Math.floor(index / 3);
        next[key] = {
          x: clamp(12 + column * 98, 0, maxX),
          y: clamp(12 + row * 64, 0, maxY),
        };
      });

      return next;
    });
  }, [maxX, maxY, numbers, zone]);

  if (numbers.length === 0) {
    return <></>;
  }

  function handleDragMove(table: TableId, nextPosition: TablePosition): void {
    setTablePositions((previous) => ({
      ...previous,
      [tableKey(table)]: nextPosition,
    }));
  }

  return (
    <View style={styles.zoneGroup}>
      <Text style={styles.zoneHeader}>{tableZoneLabel(zone)}</Text>
      <Text style={styles.hintText}>Click and hold a table, then drag to move it.</Text>
      <View
        style={styles.zoneBoard}
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
              maxX={maxX}
              maxY={maxY}
              onSelectTable={onSelectTable}
              onDragMove={handleDragMove}
            />
          );
        })}
      </View>
      <TouchableOpacity key={`add-${zone}`} style={styles.addTableButton} onPress={() => onAddTable(zone)}>
        <Text style={styles.addTableButtonText}>{`+ Add Table`}</Text>
      </TouchableOpacity>
    </View>
  );
}

