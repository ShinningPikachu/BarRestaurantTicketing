import React from 'react';
import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SelectedTable } from '../../app/app.types';
import { styles } from '../../app/App.styles';
import { MenuItem, Order, OrderItem, PreOrderItem } from '../../types';

interface OrderSectionProps {
  selectedTable: SelectedTable;
  preorderItems: PreOrderItem[];
  tableOrders: Order[];
  menuByCategory: Map<string, MenuItem[]>;
  preorderTotal: number;
  priceDraftByItemId: Record<number, string>;
  getMenuTitleById: (menuByCategory: Map<string, MenuItem[]>, menuId: number) => string;
  formatPrice: (cents: number) => string;
  onRemovePendingItem: (itemId: number) => void;
  onAddPendingItem: (itemId: number) => void;
  onUpdatePriceDraft: (itemId: number, value: string) => void;
  onCommitPriceDraft: (itemId: number) => void;
  onAdjustItemPrice: (itemId: number, deltaCents: number) => void;
  onConfirmOrder: () => void;
  onClearPreOrder: () => void;
  onPrintTicket: () => void;
  onRemoveOrder: (orderId: string) => void;
  onMoveConfirmedItemToPreOrder: (orderId: string, item: OrderItem) => void;
}

export function OrderSection({
  selectedTable,
  preorderItems,
  tableOrders,
  menuByCategory,
  preorderTotal,
  priceDraftByItemId,
  getMenuTitleById,
  formatPrice,
  onRemovePendingItem,
  onAddPendingItem,
  onUpdatePriceDraft,
  onCommitPriceDraft,
  onAdjustItemPrice,
  onConfirmOrder,
  onClearPreOrder,
  onPrintTicket,
  onRemoveOrder,
  onMoveConfirmedItemToPreOrder
}: OrderSectionProps): React.JSX.Element {
  const confirmedItems = tableOrders.flatMap((order) =>
    order.items.map((item, index) => ({
      key: `${order.id}-${item.name}-${index}`,
      orderId: order.id,
      item
    }))
  );

  return (
    <>
      <Text style={styles.sectionTitle}>{`Table ${selectedTable.zone}-${selectedTable.number} Orders`}</Text>

      <Text style={styles.subTitle}>Pre-Order</Text>
      <FlatList
        data={preorderItems}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text style={styles.emptyText}>No pre-order items.</Text>}
        renderItem={({ item }) => {
          const title = item.menuItemId
            ? getMenuTitleById(menuByCategory, item.menuItemId)
            : item.name;
          return (
            <View style={styles.preorderRow}>
              <View style={styles.flex1}>
                <Text style={styles.itemName}>
                  {title}
                </Text>
                <Text style={styles.itemPrice}>
                  {formatPrice(item.unitPriceCents * item.qty)}
                </Text>
              </View>

              <View style={styles.qtyGroup}>
                <TouchableOpacity style={styles.qtyButton} onPress={() => onRemovePendingItem(item.id)}>
                  <Text style={styles.qtyButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.qty}</Text>
                <TouchableOpacity style={styles.qtyButton} onPress={() => onAddPendingItem(item.id)}>
                  <Text style={styles.qtyButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.priceInput}
                keyboardType="decimal-pad"
                value={priceDraftByItemId[item.id] ?? (item.unitPriceCents / 100).toFixed(2)}
                selectTextOnFocus
                placeholder="0.00"
                onChangeText={(value) => onUpdatePriceDraft(item.id, value)}
                onBlur={() => onCommitPriceDraft(item.id)}
                onSubmitEditing={() => onCommitPriceDraft(item.id)}
              />

              <View style={styles.priceQuickActions}>
                <TouchableOpacity style={styles.priceQuickButton} onPress={() => onAdjustItemPrice(item.id, 50)}>
                  <Text style={styles.priceQuickButtonText}>+0.50</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.priceQuickButton} onPress={() => onAdjustItemPrice(item.id, 100)}>
                  <Text style={styles.priceQuickButtonText}>+1.00</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.footerRow}>
        <Text style={styles.totalText}>{`Total: ${formatPrice(preorderTotal)}`}</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={onConfirmOrder}>
            <Text style={styles.primaryButtonText}>Send to Kitchen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onClearPreOrder}>
            <Text style={styles.secondaryButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.subTitle}>Kitchen Confirmed Orders</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={onPrintTicket}>
            <Text style={styles.primaryButtonText}>Print Kitchen Ticket</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={confirmedItems}
        keyExtractor={(item) => item.key}
        ListEmptyComponent={<Text style={styles.emptyText}>No confirmed orders.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.preorderRow, styles.confirmedPreorderRow]}>
            <View style={styles.flex1}>
              <Text style={styles.itemName}>{item.item.name}</Text>
              <Text style={styles.itemPrice}>{formatPrice((item.item.unitPriceCents ?? 0) * item.item.qty)}</Text>
            </View>

            <Text style={styles.confirmedQtyText}>{`x${item.item.qty}`}</Text>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => onMoveConfirmedItemToPreOrder(item.orderId, item.item)}>
                <Text style={styles.primaryButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => onRemoveOrder(item.orderId)}>
                <Text style={styles.secondaryButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </>
  );
}
