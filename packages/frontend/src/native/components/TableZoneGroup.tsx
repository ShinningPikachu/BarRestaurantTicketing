import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { TableId, TableZone, tableKey } from '../types';
import { styles } from './TableZoneGroup.styles';

interface TableZoneGroupProps {
  zone: TableZone;
  numbers: number[];
  selectedTable: TableId;
  onSelectTable: (table: TableId) => void;
  onAddTable: (zone: TableZone) => void;
}

export function TableZoneGroup({ zone, numbers, selectedTable, onSelectTable, onAddTable }: TableZoneGroupProps): React.JSX.Element {
  if (numbers.length === 0) {
    return <></>;
  }

  return (
    <View style={styles.zoneGroup}>
      <Text style={styles.zoneHeader}>{zone.toUpperCase()}</Text>
      {numbers.map((number) => {
        const table: TableId = { zone, number };
        const isSelected = selectedTable.zone === zone && selectedTable.number === number;
        
        return (
          <TouchableOpacity
            key={tableKey(table)}
            style={[styles.tableButton, isSelected && styles.tableButtonSelected]}
            onPress={() => onSelectTable(table)}
          >
            <Text style={[styles.tableButtonText, isSelected && styles.tableButtonTextSelected]}>
              {`Table ${number}`}
            </Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity key={`add-${zone}`} style={styles.tableButton} onPress={() => onAddTable(zone)}>
        <Text style={styles.tableButtonText}>{`+ Add Table`}</Text>
      </TouchableOpacity>
    </View>
  );
}

