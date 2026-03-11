import React from 'react';
import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SelectedTable } from '../../app/app.types';
import { styles } from '../../app/App.styles';
import { MenuItem, Order, PreOrderItem } from '../../types';

interface OrderSectionProps {
  selectedTable: SelectedTable;
  preorderItems: PreOrderItem[];
  tableOrders: Order[];
  menuByCategory: Map<string, MenuItem[]>;
  preorderTotal: number;
  priceDraftByItemId: Record<string, string>;
  getMenuTitleById: (menuByCategory: Map<string, MenuItem[]>, menuId: number) => string;
  formatPrice: (cents: number) => string;
  onRemovePendingItem: (itemId: string) => void;
  onAddPendingItem: (itemId: string) => void;
  onUpdatePriceDraft: (itemId: string, value: string) => void;
  onCommitPriceDraft: (itemId: string) => void;
  onAdjustItemPrice: (itemId: string, deltaCents: number) => void;
  onConfirmOrder: () => void;
  onClearPreOrder: () => void;
  onPrintTicket: () => void;
  onRemoveOrder: (orderId: string) => void;
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
  onRemoveOrder
}: OrderSectionProps): React.JSX.Element {
  return (
    <>
      <Text style={styles.sectionTitle}>{`Table ${selectedTable.zone}-${selectedTable.number} Orders`}</Text>

      <Text style={styles.subTitle}>Pre-Order</Text>
      <FlatList
        data={preorderItems}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.emptyText}>No pre-order items.</Text>}
        renderItem={({ item }) => {
          const title = getMenuTitleById(menuByCategory, item.menuId);
          const isPriceModified = item.priceCents !== item.originalPriceCents;
          return (
            <View style={styles.preorderRow}>
              <View style={styles.flex1}>
                <Text style={styles.itemName}>
                  {title}
                  {isPriceModified && <Text style={styles.modifiedLabel}> (Modified)</Text>}
                </Text>
                <Text style={styles.itemPrice}>
                  {formatPrice(item.priceCents * item.qty)}
                  {isPriceModified && (
                    <Text style={styles.originalPrice}>
                      {' '}(was {formatPrice(item.originalPriceCents * item.qty)})
                    </Text>
                  )}
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
                value={priceDraftByItemId[item.id] ?? (item.priceCents / 100).toFixed(2)}
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

      <Text style={styles.subTitle}>Kitchen Confirmed Orders</Text>
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
              <TouchableOpacity style={styles.secondaryButton} onPress={onPrintTicket}>
                <Text style={styles.secondaryButtonText}>Print</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => onRemoveOrder(item.id)}>
                <Text style={styles.secondaryButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </>
  );
}
