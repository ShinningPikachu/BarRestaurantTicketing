import React, { useMemo, useState } from 'react';
import { Image, LayoutChangeEvent, Text, TouchableOpacity, View } from 'react-native';
import { getItemDisplayName } from '../../helpers/itemDisplayName';
import { MenuItem } from '../../types';
import { styles } from './MenuCategoryGroup.styles';

const DESKTOP_ITEM_MIN_WIDTH = 138;
const DESKTOP_ITEM_GAP = 8;

interface MenuCategoryGroupProps {
  category: string;
  items: MenuItem[];
  onSelectItem: (itemId: number) => void;
  formatPrice: (cents: number) => string;
  layout?: 'desktop' | 'mobile';
}

export function translateCategory(category: string): string {
  const normalized = category.trim().toLowerCase();
  const translations: Record<string, string> = {
    appetizer: 'Entrantes',
    beverage: 'Bebidas',
    dessert: 'Postres',
    'main course': 'Platos principales',
    salad: 'Ensaladas',
    sides: 'Guarniciones',
    uncategorized: 'Sin categoría',
  };

  return translations[normalized] ?? category;
}

export function MenuCategoryGroup({
  category,
  items,
  onSelectItem,
  formatPrice,
  layout = 'desktop'
}: MenuCategoryGroupProps): React.JSX.Element {
  const [itemsWidth, setItemsWidth] = useState(0);
  const isMobile = layout === 'mobile';
  const desktopItemWidth = useMemo(() => {
    if (isMobile || itemsWidth <= 0) {
      return undefined;
    }

    const columnCount = Math.max(
      1,
      Math.floor((itemsWidth + DESKTOP_ITEM_GAP) / (DESKTOP_ITEM_MIN_WIDTH + DESKTOP_ITEM_GAP))
    );

    return Math.floor((itemsWidth - DESKTOP_ITEM_GAP * (columnCount - 1)) / columnCount);
  }, [isMobile, itemsWidth]);

  if (items.length === 0) {
    return <Text style={styles.emptyText}>No se encontraron productos.</Text>;
  }

  function handleItemsLayout(event: LayoutChangeEvent): void {
    setItemsWidth(event.nativeEvent.layout.width);
  }

return (
  <View style={[styles.categoryGroup, isMobile && styles.mobileCategoryGroup]}>
    <Text style={styles.categoryHeader}>{translateCategory(category).toUpperCase()}</Text>
      <View style={styles.itemsWrap} onLayout={handleItemsLayout}>
        {items.map((item) => {
          const displayName = getItemDisplayName(item);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItemChip, desktopItemWidth ? { width: desktopItemWidth } : null, isMobile && styles.mobileMenuItemChip]}
              onPress={() => onSelectItem(item.id)}
              activeOpacity={0.7}
            >
              {item.imageDataUrl ? (
                <Image
                  source={{ uri: item.imageDataUrl }}
                  style={[styles.itemImage, isMobile && styles.mobileItemImage]}
                  resizeMode="contain"
                />
              ) : null}
              <Text style={[styles.itemName, isMobile && styles.mobileItemName]} numberOfLines={2}>
                {displayName.primary}
              </Text>
              {displayName.secondary ? (
                <Text style={[styles.itemSecondaryName, isMobile && styles.mobileItemSecondaryName]} numberOfLines={2}>
                  {displayName.secondary}
                </Text>
              ) : null}
              <Text style={styles.itemPrice}>{formatPrice(item.priceCents)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
  </View>
);
}
