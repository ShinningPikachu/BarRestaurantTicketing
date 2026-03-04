import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { apiService, storageService } from './src/native/services';
import { TableZoneGroup } from './src/native/components';
import { createTableManager } from './src/native/helpers';
import { MenuItem, Order, PreOrderItem, TableDef, TableId, TableZone } from './src/native/types';

function centsToCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function App(): React.JSX.Element {
  const [tables, setTables] = useState<Map<TableZone, number[]>>(new Map());
  const [selectedTable, setSelectedTable] = useState({zone: TableZone.OUTSIDE, number: 1});
  const [preorderItems, setPreorderItems] = useState<PreOrderItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
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
        setMenuItems(loadedMenu);
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
    setPreorderItems((current) => {
      const menu = menuItems.find((item) => item.id === menuId);
      if (!menu) return current;

      const existing = current.find((item) => item.menuId === menuId);
      if (existing) {
        return current.map((item) =>
          item.menuId === menuId ? { ...item, qty: item.qty + 1 } : item
        );
      }

      return [...current, { menuId, qty: 1, priceCents: menu.priceCents }];
    });
  }

  function addPendingItem(menuId: number): void {
    setPreorderItems((current) =>
      current.map((item) =>
        item.menuId === menuId ? { ...item, qty: item.qty + 1 } : item
      )
    );
  }

  function removePendingItem(menuId: number): void {
    setPreorderItems((current) => {
      const next = current
        .map((item) =>
          item.menuId === menuId ? { ...item, qty: item.qty - 1 } : item
        )
        .filter((item) => item.qty > 0);
      return next;
    });
  }

  function setItemPrice(menuId: number, priceCents: number): void {
    setPreorderItems((current) =>
      current.map((item) =>
        item.menuId === menuId ? { ...item, priceCents: Math.max(0, priceCents) } : item
      )
    );
  }

  async function confirmOrder(): Promise<void> {
    const items = preorderItems
      .map((item) => {
        const menu = menuItems.find((menuItem) => menuItem.id === item.menuId);
        if (!menu) return null;
        return {
          name: menu.name,
          qty: item.qty,
          unitPriceCents: item.priceCents
        };
      })
      .filter((item): item is { name: string; qty: number; unitPriceCents: number } => item !== null);

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

  const preorderTotal = preorderItems.reduce((sum, item) => sum + item.qty * item.priceCents, 0);

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
            <FlatList
              data={menuItems}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={() => addMenuItem(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.flex1}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>{centsToCurrency(item.priceCents)}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>

          <View style={styles.column}>
            <Text style={styles.sectionTitle}>{`Table ${selectedTable.zone}-${selectedTable.number} Orders`}</Text>

            <Text style={styles.subTitle}>Pre-Order</Text>
            <FlatList
              data={preorderItems}
              keyExtractor={(item) => String(item.menuId)}
              ListEmptyComponent={<Text style={styles.emptyText}>No pre-order items.</Text>}
              renderItem={({ item }) => {
                const menu = menuItems.find((menuItem) => menuItem.id === item.menuId);
                const title = menu?.name || `Menu ${item.menuId}`;
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
    paddingHorizontal: 12,
    paddingTop: 12
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10
  },
  title: {
    fontSize: 18,
    fontWeight: '600'
  },
  columnsContent: {
    flexGrow: 1,
    paddingBottom: 12
  },
  tablesColumn: {
    width: 220,
    maxWidth: 220
  },
  columns: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 1080
  },
  column: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 6
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  preorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  flex1: {
    flex: 1
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600'
  },
  itemPrice: {
    fontSize: 12,
    color: '#4B5563'
  },
  primaryButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  secondaryButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '600'
  },
  qtyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center'
  },
  qtyButtonText: {
    fontSize: 16,
    fontWeight: '700'
  },
  qtyText: {
    minWidth: 18,
    textAlign: 'center'
  },
  priceInput: {
    width: 76,
    borderColor: '#D1D5DB',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF'
  },
  footerRow: {
    marginTop: 8,
    marginBottom: 6
  },
  totalText: {
    fontWeight: '700',
    marginBottom: 6
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6
  },
  confirmedCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#FFFFFF'
  },
  orderId: {
    fontWeight: '700',
    marginBottom: 4
  },
  orderItemText: {
    fontSize: 13,
    marginBottom: 2
  },
  emptyText: {
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 8
  }
});
