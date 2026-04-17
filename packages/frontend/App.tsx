import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  View
} from 'react-native';
import { useTicketingController } from './src/native/controllers';
import { TableZoneGroup, MenuCategoryGroup } from './src/native/components';
import { OrderSection } from './src/native/components/OrderZone/OrderSection';
import { MenuItem, TABLE_ZONES, TableZone } from './src/native/types';
import {
  centsToCurrency,
  getMenuTitleById
} from './src/native/app/app.helpers';
import { styles } from './src/native/app/App.styles';

export default function App(): React.JSX.Element {
  const { state, actions } = useTicketingController();
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
              {TABLE_ZONES.map((zone: TableZone) => {
                const numbers = tables.get(zone) ?? [];
                if (numbers.length === 0) {
                  return null;
                }

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
                  />
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Menu</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {Array.from(menuByCategory.entries()).map(([category, items]: [string, MenuItem[]]) => (
                <MenuCategoryGroup
                  key={category}
                  category={category}
                  items={items}
                  onSelectItem={(menuId) => {
                    void actions.addMenuItem(menuId);
                  }}
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
              onPrintTicket={() => {
                void actions.printTicket();
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
