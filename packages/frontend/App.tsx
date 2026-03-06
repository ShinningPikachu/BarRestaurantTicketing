import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { apiService, storageService } from './src/native/services';
import { TableZoneGroup, MenuCategoryGroup } from './src/native/components';
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

export default function App(): React.JSX.Element {
  const [tables, setTables] = useState<Map<TableZone, number[]>>(new Map());
  const [selectedTable, setSelectedTable] = useState<SelectedTable>({zone: TableZone.OUTSIDE, number: 1});
  const [preorderItems, setPreorderItems] = useState<PreOrderItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuByCategory, setMenuByCategory] = useState<Map<string, MenuItem[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init(): Promise<void> {
      try {
        const loadedTables = new Map<TableZone, number[]>([
          [TableZone.OUTSIDE, [1, 2, 3]],
          [TableZone.FLOOR1, [1, 2, 3]],
          [TableZone.FLOOR2, [1, 2, 3]]]
        );
        //await storageService.loadTables();
        const initialTable = {zone: TableZone.OUTSIDE, number: 1};
        const [loadedPreorder, loadedOrders, loadedMenu] = await Promise.all([
          storageService.loadPreOrderItems(initialTable),
          apiService.fetchOrders(),
          apiService.fetchMenu()
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

  function addPendingItem(menuId: number): void {
    setPreorderItems((current) => incrementPreOrderItem(current, menuId));
  }

  function removePendingItem(menuId: number): void {
    setPreorderItems((current) => decrementPreOrderItem(current, menuId));
  }

  function setItemPrice(menuId: number, priceCents: number): void {
    setPreorderItems((current) => updatePreOrderItemPrice(current, menuId, priceCents));
  }

  async function confirmOrder(): Promise<void> {
    const items = buildConfirmOrderItems(preorderItems, menuByCategory);

    if (items.length === 0) {
      Alert.alert('No items', 'Add at least one item before confirming the order.');
      return;
    }

    try {
      await apiService.createOrder(selectedTable.number, items);
      setPreorderItems([]);
      await storageService.savePreOrderItems(selectedTable, []);
      await refreshOrders();
    } catch {
      Alert.alert('Error', 'Failed to create order.');
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
            <Text style={styles.sectionTitle}>{`Table ${selectedTable.zone}-${selectedTable.number} Orders`}</Text>

            <Text style={styles.subTitle}>Pre-Order</Text>
            <FlatList
              data={preorderItems}
              keyExtractor={(item) => String(item.menuId)}
              ListEmptyComponent={<Text style={styles.emptyText}>No pre-order items.</Text>}
              renderItem={({ item }) => {
                const title = getMenuTitleById(menuByCategory, item.menuId);
                return (
                  <View style={styles.preorderRow}>
                    <View style={styles.flex1}>
                      <Text style={styles.itemName}>{title}</Text>
                      <Text style={styles.itemPrice}>{centsToCurrency(item.priceCents * item.qty)}</Text>
                    </View>

                    <View style={styles.qtyGroup}>
                      <TouchableOpacity style={styles.qtyButton} onPress={() => removePendingItem(item.menuId)}>
                        <Text style={styles.qtyButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{item.qty}</Text>
                      <TouchableOpacity style={styles.qtyButton} onPress={() => addPendingItem(item.menuId)}>
                        <Text style={styles.qtyButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      style={styles.priceInput}
                      keyboardType="decimal-pad"
                      value={(item.priceCents / 100).toFixed(2)}
                      onChangeText={(value) => {
                        const parsed = Number(value);
                        if (!Number.isNaN(parsed)) {
                          setItemPrice(item.menuId, Math.round(parsed * 100));
                        }
                      }}
                    />
                  </View>
                );
              }}
            />

            <View style={styles.footerRow}>
              <Text style={styles.totalText}>{`Total: ${centsToCurrency(preorderTotal)}`}</Text>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.primaryButton} onPress={() => void confirmOrder()}>
                  <Text style={styles.primaryButtonText}>Confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setPreorderItems([])}>
                  <Text style={styles.secondaryButtonText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.subTitle}>Confirmed Orders</Text>
            <FlatList
              data={tableOrders}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={styles.emptyText}>No confirmed orders.</Text>}
              renderItem={({ item }) => (
                <View style={styles.confirmedCard}>
                  <Text style={styles.orderId}>{`Order ${item.id}`}</Text>
                  {item.items.map((orderItem, index) => (
                    <Text key={`${item.id}-${orderItem.name}-${index}`} style={styles.orderItemText}>
                      {`${orderItem.qty} × ${orderItem.name}`}
                    </Text>
                  ))}
                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.secondaryButton} onPress={printTicket}>
                      <Text style={styles.secondaryButtonText}>Print</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => void removeOrder(item.id)}>
                      <Text style={styles.secondaryButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
