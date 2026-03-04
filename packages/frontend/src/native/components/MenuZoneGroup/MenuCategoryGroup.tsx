import React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { MenuItem } from '../../types';
import { styles } from './MenuCategoryGroup.styles';

interface MenuCategoryGroupProps {
  category: string;
  items: MenuItem[];
  onSelectItem: (itemId: number) => void;
  formatPrice: (cents: number) => string;
}

export function MenuCategoryGroup({ category, items, onSelectItem, formatPrice }: MenuCategoryGroupProps): React.JSX.Element {
  if (items.length === 0) {
    return <></>;
  }

return (
  <View style={styles.categoryGroup}>
    <Text style={styles.categoryHeader}>{category.toUpperCase()}</Text>
      <View style={styles.itemsWrap}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItemChip}
            onPress={() => onSelectItem(item.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemPrice}>{formatPrice(item.priceCents)}</Text>
          </TouchableOpacity>
        ))}
      </View>
  </View>
);
}
