import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useTicketingController } from './src/native/controllers';
import { TableZoneGroup, MenuCategoryGroup } from './src/native/components';
import { translateCategory } from './src/native/components/MenuZoneGroup/MenuCategoryGroup';
import { OrderSection } from './src/native/components/OrderZone/OrderSection';
import { MenuItem, TABLE_ZONES, TableZone } from './src/native/types';
import {
  centsToCurrency,
  getMenuTitleById
} from './src/native/app/app.helpers';
import { styles } from './src/native/app/App.styles';

const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_RESULTS = 24;

function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function getSearchRank(item: MenuItem, category: string, query: string): number | null {
  const name = normalizeSearchText(item.name);
  const sku = normalizeSearchText(item.sku);
  const description = normalizeSearchText(item.description);
  const categoryText = normalizeSearchText(category);
  const translatedCategory = normalizeSearchText(translateCategory(category));

  if (sku && sku === query) return 0;
  if (name === query) return 1;
  if (name.startsWith(query)) return 2;
  if (name.split(/\s+/).some((word) => word.startsWith(query))) return 3;
  if (sku && sku.includes(query)) return 4;
  if (name.includes(query)) return 5;
  if (description.includes(query)) return 6;
  if (categoryText.startsWith(query) || translatedCategory.startsWith(query)) return 7;

  return null;
}

export default function App(): React.JSX.Element {
  const { state, actions } = useTicketingController();
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string | null>(null);
  const [menuSearchText, setMenuSearchText] = useState('');
  const {
    loading,
    tables,
    selectedTable,
    menuByCategory,
    preorderItems,
    tableConfirmedOrders,
    preorderTotal,
    priceDraftByItemId
  } = state;
  const menuCategories = useMemo(() => Array.from(menuByCategory.keys()), [menuByCategory]);
  const visibleMenuCategory = selectedMenuCategory && menuByCategory.has(selectedMenuCategory)
    ? selectedMenuCategory
    : (menuCategories[0] ?? null);
  const visibleMenuItems = visibleMenuCategory ? (menuByCategory.get(visibleMenuCategory) ?? []) : [];
  const normalizedMenuSearch = normalizeSearchText(menuSearchText);
  const searchedMenuItems = useMemo(() => {
    if (normalizedMenuSearch.length < MIN_SEARCH_LENGTH) {
      return [];
    }

    const matches: Array<{ item: MenuItem; rank: number }> = [];
    for (const [category, items] of menuByCategory.entries()) {
      for (const item of items) {
        const rank = getSearchRank(item, category, normalizedMenuSearch);
        if (rank !== null) {
          matches.push({ item, rank });
        }
      }
    }

    return matches
      .sort((left, right) => left.rank - right.rank || left.item.name.localeCompare(right.item.name))
      .slice(0, MAX_SEARCH_RESULTS)
      .map((match) => match.item);
  }, [menuByCategory, normalizedMenuSearch]);
  const isSearching = normalizedMenuSearch.length >= MIN_SEARCH_LENGTH;
  const displayedMenuCategory = isSearching ? 'Resultados' : visibleMenuCategory;
  const displayedMenuItems = isSearching ? searchedMenuItems : visibleMenuItems;

  useEffect(() => {
    if (!visibleMenuCategory) {
      setSelectedMenuCategory(null);
      return;
    }
    if (selectedMenuCategory !== visibleMenuCategory) {
      setSelectedMenuCategory(visibleMenuCategory);
    }
  }, [selectedMenuCategory, visibleMenuCategory]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.title}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Bar Ticketing</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.columnsScroll}
        contentContainerStyle={styles.columnsContent}
      >
        <View style={styles.columns}>
          <View style={[styles.column, styles.tablesColumn]}>
            <Text style={styles.sectionTitle}>Mesas</Text>
            <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
              {TABLE_ZONES.map((zone: TableZone) => {
                const numbers = tables.get(zone) ?? [];
                return (
                  <TableZoneGroup
                    key={zone}
                    zone={zone}
                    numbers={numbers}
                    selectedTable={selectedTable}
                    onSelectTable={(table) => {
                      void actions.selectTable(table);
                    }}
                    onAddTable={(zoneValue) => {
                      void actions.addTable(zoneValue);
                    }}
                    onRemoveTable={(table) => {
                      void actions.removeTable(table);
                    }}
                  />
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Menú</Text>
            <TextInput
              style={styles.menuSearchInput}
              value={menuSearchText}
              onChangeText={setMenuSearchText}
              placeholder="Buscar producto"
              placeholderTextColor="#6B7280"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            <View style={styles.menuTypeSelector}>
              {menuCategories.map((category) => {
                const isSelected = category === visibleMenuCategory;
                return (
                  <TouchableOpacity
                    key={category}
                    style={[styles.menuTypeButton, isSelected && styles.menuTypeButtonSelected]}
                    onPress={() => setSelectedMenuCategory(category)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.menuTypeButtonText, isSelected && styles.menuTypeButtonTextSelected]}>
                      {translateCategory(category)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
              {normalizedMenuSearch.length > 0 && normalizedMenuSearch.length < MIN_SEARCH_LENGTH ? (
                <Text style={styles.emptyText}>Escribe al menos 2 letras para buscar.</Text>
              ) : displayedMenuCategory ? (
                <MenuCategoryGroup
                  category={displayedMenuCategory}
                  items={displayedMenuItems}
                  onSelectItem={(menuId) => {
                    void actions.addMenuItem(menuId);
                  }}
                  formatPrice={centsToCurrency}
                />
              ) : (
                <Text style={styles.emptyText}>No hay productos disponibles.</Text>
              )}
            </ScrollView>
          </View>

          <View style={styles.column}>
            <OrderSection
              selectedTable={selectedTable}
              preorderItems={preorderItems}
              tableOrders={tableConfirmedOrders}
              menuByCategory={menuByCategory}
              preorderTotal={preorderTotal}
              priceDraftByItemId={priceDraftByItemId}
              getMenuTitleById={getMenuTitleById}
              formatPrice={centsToCurrency}
              onRemovePendingItem={(itemId) => {
                void actions.decrementPendingItem(itemId);
              }}
              onAddPendingItem={(itemId) => {
                void actions.incrementPendingItem(itemId);
              }}
              onUpdatePriceDraft={actions.updatePriceDraft}
              onCommitPriceDraft={(itemId) => {
                void actions.commitPriceDraft(itemId);
              }}
              onAdjustItemPrice={(itemId, deltaCents) => {
                void actions.adjustItemPrice(itemId, deltaCents);
              }}
              onConfirmOrder={() => {
                void actions.sendToKitchen();
              }}
              onClearPreOrder={() => {
                void actions.clearPreOrder();
              }}
              onPrintTicket={(options) => {
                void actions.printTicket(options);
              }}
              onPayTicket={(method, splitPeople) => {
                void actions.payTable(method, splitPeople);
              }}
              onPaySelectedItems={(method, items) => {
                void actions.paySelectedItems(method, items);
              }}
              onRemoveOrder={(orderId) => {
                void actions.removeOrder(orderId);
              }}
              onMoveConfirmedItemToPreOrder={(orderId, item) => {
                void actions.moveConfirmedItemToPreOrder(orderId, item);
              }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
