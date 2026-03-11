import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  Text,
  View
} from 'react-native';
import { apiService, storageService } from './src/native/services';
import { TableZoneGroup, MenuCategoryGroup } from './src/native/components';
import { OrderSection } from './src/native/components/OrderZone/OrderSection';
import { createTableManager, groupMenuItemsByCategory } from './src/native/helpers';
import { MenuItem, Order, PreOrderItem, TableDef, TableId, TableZone } from './src/native/types';
import {
  addMenuItemToPreOrder,
  buildConfirmOrderItems,
  centsToCurrency,
  decrementPreOrderItem,
  getMenuTitleById,
  getPreOrderTotal,
  incrementPreOrderItem,
  updatePreOrderItemPrice
} from './src/native/app/app.helpers';
import { SelectedTable } from './src/native/app/app.types';
import { styles } from './src/native/app/App.styles';

function getInitialTable(tables: Map<TableZone, number[]>): SelectedTable {
  for (const [zone, numbers] of tables.entries()) {
    const firstNumber = numbers[0];
    if (firstNumber !== undefined) {
      return { zone, number: firstNumber };
    }
  }

  return { zone: TableZone.OUTSIDE, number: 1 };
}

export default function App(): React.JSX.Element {
  const [tables, setTables] = useState<Map<TableZone, number[]>>(new Map());
  const [selectedTable, setSelectedTable] = useState<SelectedTable>({zone: TableZone.OUTSIDE, number: 1});
  const [preorderItems, setPreorderItems] = useState<PreOrderItem[]>([]);
  const [priceDraftByItemId, setPriceDraftByItemId] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuByCategory, setMenuByCategory] = useState<Map<string, MenuItem[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init(): Promise<void> {
      try {
        const loadedTables = await storageService.loadTables();
        const initialTable = getInitialTable(loadedTables);
        const [loadedPreorder, loadedOrders, loadedMenu] = await Promise.all([
          storageService.loadPreOrderItems(initialTable),
          apiService.fetchOrders().catch(() => []),
          apiService.fetchMenu().catch(() => [])
        ]);

        if (!mounted) return;

        setTables(loadedTables);
        setSelectedTable(initialTable);
        setPreorderItems(loadedPreorder);
        setOrders(loadedOrders);
        setMenuByCategory(groupMenuItemsByCategory(loadedMenu));
      } catch {
        if (mounted) {
          Alert.alert('Initialization failed', 'Unable to load app data.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const tableOrders = useMemo(
    () => orders.filter((order) => 
      order.table?.number === selectedTable.number && 
      order.table?.zone === selectedTable.zone
    ),
    [orders, selectedTable]
  );

  const tableConfirmedOrders = useMemo(
    () => tableOrders.filter((order) => (order.status || '').toLowerCase() === 'confirmed'),
    [tableOrders]
  );

  async function refreshOrders(): Promise<void> {
    try {
      const loadedOrders = await apiService.fetchOrders();
      setOrders(loadedOrders);
    } catch {
      Alert.alert('Error', 'Failed to fetch orders.');
    }
  }

  async function switchTable(table: TableId): Promise<void> {
    await storageService.savePreOrderItems(selectedTable, preorderItems);
    const nextItems = await storageService.loadPreOrderItems(table);
    setSelectedTable(table);
    setPreorderItems(nextItems);
  }

  function handleTableSelect(table: TableId): void {
    switchTable(table).catch(() => Alert.alert('Error', 'Failed to switch table.'));
  }

  const tableManager = useMemo(() => createTableManager({
    tables,
    selectedTable,
    preorderItems,
    onTablesUpdate: setTables,
    onSelectedTableUpdate: setSelectedTable,
    onPreorderItemsUpdate: setPreorderItems,
    storageService
  }), [tables, selectedTable, preorderItems]);

  function handleAddTable(zone: TableZone): void {
    tableManager.addTable(zone).catch(() => Alert.alert('Error', 'Failed to add table.'));
  }

  function addMenuItem(menuId: number): void {
    setPreorderItems((current) => addMenuItemToPreOrder(current, menuId, menuByCategory));
  }

  function addPendingItem(itemId: string): void {
    setPreorderItems((current) => incrementPreOrderItem(current, itemId));
  }

  function removePendingItem(itemId: string): void {
    setPreorderItems((current) => decrementPreOrderItem(current, itemId));
  }

  function setItemPrice(itemId: string, priceCents: number): void {
    setPreorderItems((current) => updatePreOrderItemPrice(current, itemId, priceCents));
    setPriceDraftByItemId((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }

  function adjustItemPrice(itemId: string, deltaCents: number): void {
    setPreorderItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, priceCents: Math.max(0, item.priceCents + deltaCents) }
          : item
      )
    );
    setPriceDraftByItemId((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }

  function updatePriceDraft(itemId: string, value: string): void {
    setPriceDraftByItemId((current) => ({ ...current, [itemId]: value }));
  }

  function commitPriceDraft(itemId: string): void {
    const rawValue = priceDraftByItemId[itemId];
    if (rawValue === undefined) {
      return;
    }

    const parsed = Number(rawValue.replace(',', '.').trim());
    if (!Number.isNaN(parsed)) {
      setItemPrice(itemId, Math.round(parsed * 100));
      return;
    }

    setPriceDraftByItemId((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }

  async function confirmOrder(): Promise<void> {
    const items = buildConfirmOrderItems(preorderItems, menuByCategory);

    if (items.length === 0) {
      Alert.alert('No items', 'Add at least one item before sending to kitchen.');
      return;
    }

    try {
      await apiService.createOrder(selectedTable.number, selectedTable.zone, items);
      setPreorderItems([]);
      await storageService.savePreOrderItems(selectedTable, []);
      await refreshOrders();
      Alert.alert('Sent to kitchen', 'Pre-order items are now confirmed and ready to cook.');
    } catch {
      Alert.alert('Error', 'Failed to send order to kitchen.');
    }
  }

  async function removeOrder(orderId: string): Promise<void> {
    try {
      await apiService.deleteOrder(orderId);
      await refreshOrders();
    } catch {
      Alert.alert('Error', 'Failed to remove order.');
    }
  }

  function printTicket(): void {
    Alert.alert('Not supported', 'Printing is not available in this React Native version yet.');
  }

  useEffect(() => {
    if (!loading) {
      storageService.savePreOrderItems(selectedTable, preorderItems).catch(() => undefined);
    }
  }, [preorderItems, selectedTable, loading]);

  const preorderTotal = getPreOrderTotal(preorderItems);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.title}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Bar Ticketing — React Native</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.columnsContent}>
        <View style={styles.columns}>
          <View style={[styles.column, styles.tablesColumn]}>
            <Text style={styles.sectionTitle}>Tables</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {Array.from(tables.entries()).map(([zone, numbers]) => (
                <TableZoneGroup
                  key={zone}
                  zone={zone}
                  numbers={numbers}
                  selectedTable={selectedTable}
                  onSelectTable={handleTableSelect}
                  onAddTable={handleAddTable}
                />
              ))}
            </ScrollView>
          </View>

          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Menu</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {Array.from(menuByCategory.entries()).map(([category, items]) => (
                <MenuCategoryGroup
                  key={category}
                  category={category}
                  items={items}
                  onSelectItem={addMenuItem}
                  formatPrice={centsToCurrency}
                />
              ))}
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
              onRemovePendingItem={removePendingItem}
              onAddPendingItem={addPendingItem}
              onUpdatePriceDraft={updatePriceDraft}
              onCommitPriceDraft={commitPriceDraft}
              onAdjustItemPrice={adjustItemPrice}
              onConfirmOrder={() => void confirmOrder()}
              onClearPreOrder={() => setPreorderItems([])}
              onPrintTicket={printTicket}
              onRemoveOrder={(orderId) => {
                void removeOrder(orderId);
              }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
