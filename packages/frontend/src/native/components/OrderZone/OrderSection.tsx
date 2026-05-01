import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SelectedTable } from '../../app/app.types';
import { styles } from '../../app/App.styles';
import { MenuItem, Order, OrderItem, PaymentMethod, PreOrderItem, tableZoneLabel } from '../../types';

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
  onPrintTicket: (options?: { confirmedOrders?: Order[]; splitPeople?: number; ticketNote?: string }) => void;
  onPayTicket: (method: PaymentMethod, splitPeople?: number) => void;
  onPaySelectedItems: (method: PaymentMethod, items: Array<{ orderId: string; itemId: number; qty: number }>) => void;
  onRemoveOrder: (orderId: string) => void;
  onMoveConfirmedItemToPreOrder: (orderId: string, item: OrderItem) => void;
}

interface ConfirmedItemRow {
  key: string;
  orderId: string;
  order: Order;
  item: OrderItem;
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
  onPayTicket,
  onPaySelectedItems,
  onRemoveOrder,
  onMoveConfirmedItemToPreOrder
}: OrderSectionProps): React.JSX.Element {
  const [aaQtyByKey, setAaQtyByKey] = useState<Record<string, number>>({});
  const [isAaModalVisible, setIsAaModalVisible] = useState(false);
  const [splitPeopleText, setSplitPeopleText] = useState('2');

  const confirmedItems: ConfirmedItemRow[] = tableOrders.flatMap((order) =>
    order.items.map((item, index) => ({
      key: `${order.id}-${item.id ?? index}-${item.name}-${item.unitPriceCents ?? 0}`,
      orderId: order.id,
      order,
      item
    }))
  );

  const selectedAaItemCount = useMemo(
    () => Object.values(aaQtyByKey).reduce((sum, qty) => sum + qty, 0),
    [aaQtyByKey]
  );

  function setAaQty(key: string, nextQty: number, maxQty: number): void {
    setAaQtyByKey((current) => {
      const boundedQty = Math.max(0, Math.min(maxQty, nextQty));
      const next = { ...current };
      if (boundedQty === 0) {
        delete next[key];
      } else {
        next[key] = boundedQty;
      }
      return next;
    });
  }

  function buildAaOrders(): Order[] {
    const ordersById = new Map<string, Order>();

    for (const confirmedItem of confirmedItems) {
      const selectedQty = aaQtyByKey[confirmedItem.key] ?? 0;
      if (selectedQty <= 0) {
        continue;
      }

      const unitPriceCents = confirmedItem.item.unitPriceCents ?? 0;
      const order = ordersById.get(confirmedItem.orderId) ?? {
        ...confirmedItem.order,
        items: [],
      };

      order.items.push({
        ...confirmedItem.item,
        qty: selectedQty,
        unitPriceCents,
        totalPriceCents: unitPriceCents * selectedQty,
      });
      ordersById.set(confirmedItem.orderId, order);
    }

    return Array.from(ordersById.values());
  }

  function handleOpenAaModal(): void {
    setAaQtyByKey({});
    setIsAaModalVisible(true);
  }

  function handlePrintAaTicket(): void {
    if (selectedAaItemCount === 0) {
      Alert.alert('Sin selección AA', 'Selecciona al menos un artículo para imprimir un ticket individual.');
      return;
    }

    onPrintTicket({
      confirmedOrders: buildAaOrders(),
      ticketNote: 'AA - consumo individual',
    });
    setIsAaModalVisible(false);
    setAaQtyByKey({});
  }

  function handlePrintDividedTicket(): void {
    const splitPeople = Number(splitPeopleText.replace(',', '.').trim());
    if (!Number.isInteger(splitPeople) || splitPeople < 2) {
      Alert.alert('División no válida', 'Introduce un número entero de comensales mayor que 1.');
      return;
    }

    onPrintTicket({
      splitPeople,
      ticketNote: 'Cuenta dividida a partes iguales',
    });
  }

  function getSplitPeople(): number | null {
    const splitPeople = Number(splitPeopleText.replace(',', '.').trim());
    if (!Number.isInteger(splitPeople) || splitPeople < 2) {
      Alert.alert('División no válida', 'Introduce un número entero de comensales mayor que 1.');
      return null;
    }
    return splitPeople;
  }

  function buildAaPaymentItems(): Array<{ orderId: string; itemId: number; qty: number }> | null {
    const items: Array<{ orderId: string; itemId: number; qty: number }> = [];

    for (const confirmedItem of confirmedItems) {
      const selectedQty = aaQtyByKey[confirmedItem.key] ?? 0;
      if (selectedQty <= 0) {
        continue;
      }
      if (confirmedItem.item.id === undefined) {
        Alert.alert('No se puede pagar AA', 'Hay un artículo seleccionado sin identificador.');
        return null;
      }

      items.push({
        orderId: confirmedItem.orderId,
        itemId: confirmedItem.item.id,
        qty: selectedQty,
      });
    }

    if (items.length === 0) {
      Alert.alert('Sin selección AA', 'Selecciona al menos un artículo para registrar el pago AA.');
      return null;
    }

    return items;
  }

  function handlePayAa(method: PaymentMethod): void {
    const items = buildAaPaymentItems();
    if (!items) {
      return;
    }

    onPaySelectedItems(method, items);
    setIsAaModalVisible(false);
    setAaQtyByKey({});
  }

  return (
    <View style={styles.orderSection}>
      <Text style={styles.sectionTitle}>{`Pedidos mesa ${tableZoneLabel(selectedTable.zone)}-${selectedTable.number}`}</Text>

      <Text style={styles.subTitle}>Prepedido</Text>
      <FlatList
        data={preorderItems}
        style={styles.preorderList}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text style={styles.emptyText}>No hay artículos en el prepedido.</Text>}
        renderItem={({ item }) => {
          const title = item.menuItemId
            ? getMenuTitleById(menuByCategory, item.menuItemId)
            : item.name;
          return (
            <View style={styles.preorderRow}>
              <View style={styles.flex1}>
                <Text style={styles.itemName}>{title}</Text>
                <Text style={styles.itemPrice}>{formatPrice(item.unitPriceCents * item.qty)}</Text>
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
            <Text style={styles.primaryButtonText}>Enviar a cocina</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onClearPreOrder}>
            <Text style={styles.secondaryButtonText}>Limpiar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.subTitle}>Pedidos confirmados</Text>
        <View style={styles.confirmedActionBar}>
          <TouchableOpacity style={styles.compactPrimaryButton} onPress={() => onPrintTicket()}>
            <Text style={styles.primaryButtonText}>Imprimir ticket</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.compactSecondaryButton} onPress={handleOpenAaModal}>
            <Text style={styles.secondaryButtonText}>AA</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.compactSecondaryButton} onPress={() => onPayTicket('cash')}>
            <Text style={styles.secondaryButtonText}>Pagar efectivo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.compactSecondaryButton} onPress={() => onPayTicket('card')}>
            <Text style={styles.secondaryButtonText}>Pagar tarjeta</Text>
          </TouchableOpacity>
          <Text style={styles.compactLabel}>Comensales</Text>
          <TextInput
            style={styles.smallNumberInput}
            keyboardType="number-pad"
            value={splitPeopleText}
            onChangeText={setSplitPeopleText}
            placeholder="2"
          />
          <TouchableOpacity style={styles.compactSecondaryButton} onPress={handlePrintDividedTicket}>
            <Text style={styles.secondaryButtonText}>Imprimir dividido</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={confirmedItems}
        style={styles.confirmedList}
        contentContainerStyle={styles.confirmedListContent}
        keyExtractor={(item) => item.key}
        ListEmptyComponent={<Text style={styles.emptyText}>No hay pedidos confirmados.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.preorderRow, styles.confirmedPreorderRow]}>
            <View style={styles.flex1}>
              <Text style={styles.itemName}>{item.item.name}</Text>
              <Text style={styles.itemPrice}>{formatPrice((item.item.unitPriceCents ?? 0) * item.item.qty)}</Text>
            </View>

            <Text style={styles.confirmedQtyText}>{`x${item.item.qty}`}</Text>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => onMoveConfirmedItemToPreOrder(item.orderId, item.item)}>
                <Text style={styles.primaryButtonText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => onRemoveOrder(item.orderId)}>
                <Text style={styles.secondaryButtonText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal
        visible={isAaModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAaModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <View style={styles.flex1}>
                <Text style={styles.modalTitle}>Módulo AA</Text>
                <Text style={styles.helperText}>Selecciona los productos que paga este cliente.</Text>
              </View>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setIsAaModalVisible(false)}>
                <Text style={styles.secondaryButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={confirmedItems}
              keyExtractor={(item) => `aa-${item.key}`}
              ListEmptyComponent={<Text style={styles.emptyText}>No hay pedidos confirmados.</Text>}
              renderItem={({ item }) => (
                <View style={styles.aaSelectionRow}>
                  <View style={styles.flex1}>
                    <Text style={styles.itemName}>{item.item.name}</Text>
                    <Text style={styles.itemPrice}>
                      {`${formatPrice(item.item.unitPriceCents ?? 0)} · disponible x${item.item.qty}`}
                    </Text>
                  </View>

                  <View style={styles.qtyGroup}>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => setAaQty(item.key, (aaQtyByKey[item.key] ?? 0) - 1, item.item.qty)}
                    >
                      <Text style={styles.qtyButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{aaQtyByKey[item.key] ?? 0}</Text>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => setAaQty(item.key, (aaQtyByKey[item.key] ?? 0) + 1, item.item.qty)}
                    >
                      <Text style={styles.qtyButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setAaQtyByKey({})}>
                <Text style={styles.secondaryButtonText}>Limpiar AA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={handlePrintAaTicket}>
                <Text style={styles.primaryButtonText}>{`Imprimir AA (${selectedAaItemCount})`}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => handlePayAa('cash')}>
                <Text style={styles.secondaryButtonText}>Pagar efectivo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => handlePayAa('card')}>
                <Text style={styles.secondaryButtonText}>Pagar tarjeta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
