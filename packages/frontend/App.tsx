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
import type { MenuItem, Order, PreOrderItem, TableDef, TableZone } from './src/native/types';

function centsToCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function App(): React.JSX.Element {
  const [tables, setTables] = useState<TableDef[]>([]);
  const [selectedTable, setSelectedTable] = useState(1);
  const [preorderItems, setPreorderItems] = useState<PreOrderItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init(): Promise<void> {
      try {
        const loadedTables = await storageService.loadTables();
        const initialTable = loadedTables[0]?.number ?? 1;
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
    () => orders.filter((order) => order.table?.number === selectedTable),
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

  async function switchTable(tableNumber: number): Promise<void> {
    await storageService.savePreOrderItems(selectedTable, preorderItems);
    const nextItems = await storageService.loadPreOrderItems(tableNumber);
    setSelectedTable(tableNumber);
    setPreorderItems(nextItems);
  }

  async function addTable(zone: TableZone): Promise<void> {
    const maxNumber = tables.reduce((max, table) => Math.max(max, table.number), 0);
    const newTable: TableDef = { number: maxNumber + 1, zone };
    const updatedTables = [...tables, newTable];

    await storageService.savePreOrderItems(selectedTable, preorderItems);
    await storageService.saveTables(updatedTables);

    setTables(updatedTables);
    setSelectedTable(newTable.number);
    setPreorderItems([]);
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
      await apiService.createOrder(selectedTable, items);
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
            <FlatList
              data={tables}
              keyExtractor={(item) => String(item.number)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.tableButton, selectedTable === item.number && styles.tableButtonSelected]}
                  onPress={() => {
                    switchTable(item.number).catch(() => Alert.alert('Error', 'Failed to switch table.'));
                  }}
                >
                  <Text style={styles.tableButtonText}>{`Table ${item.number}`}</Text>
                  <Text style={styles.tableZoneText}>{item.zone}</Text>
                </TouchableOpacity>
              )}
            />

            <View style={styles.addTableColumn}>
              <Text style={styles.subTitle}>Add Table</Text>
              {(['outside', 'floor1', 'floor2'] as TableZone[]).map((zone) => (
                <TouchableOpacity key={zone} style={styles.secondaryButton} onPress={() => void addTable(zone)}>
                  <Text style={styles.secondaryButtonText}>{`+ ${zone}`}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
            <Text style={styles.sectionTitle}>{`Table ${selectedTable} Orders`}</Text>

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
  tableButton: {
    width: '100%',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  tableButtonSelected: {
    backgroundColor: '#1D4ED8'
  },
  tableButtonText: {
    color: '#111827',
    fontWeight: '700'
  },
  tableZoneText: {
    marginTop: 2,
    color: '#374151',
    fontSize: 12
  },
  addTableColumn: {
    marginTop: 8,
    gap: 8
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
