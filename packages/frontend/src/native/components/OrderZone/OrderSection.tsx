import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Platform, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SelectedTable } from '../../app/app.types';
import { styles } from '../../app/App.styles';
import { getItemDisplayName } from '../../helpers/itemDisplayName';
import { MenuItem, Order, OrderItem, PaymentMethod, PreOrderItem, tableZoneLabel } from '../../types';

interface OrderSectionProps {
  selectedTable: SelectedTable;
  preorderItems: PreOrderItem[];
  tableOrders: Order[];
  menuByCategory: Map<string, MenuItem[]>;
  preorderTotal: number;
  confirmedTotal: number;
  currentTableTotal: number;
  isMutating: boolean;
  paymentPending: boolean;
  priceDraftByItemId: Record<number, string>;
  getMenuTitleById: (menuByCategory: Map<string, MenuItem[]>, menuId: number) => string;
  formatPrice: (cents: number) => string;
  onRemovePendingItem: (itemId: number) => void;
  onAddPendingItem: (itemId: number) => void;
  onUpdatePriceDraft: (itemId: number, value: string) => void;
  onCommitPriceDraft: (itemId: number) => void;
  onAdjustItemPrice: (itemId: number, deltaCents: number) => void;
  onConfirmOrder: () => Promise<boolean>;
  onClearPreOrder: () => Promise<boolean>;
  onPrintTicket: (options?: { confirmedOrders?: Order[]; splitPeople?: number; ticketNote?: string }) => void;
  onPayTicket: (method: PaymentMethod, splitPeople?: number) => Promise<boolean>;
  onPaySelectedItems: (method: PaymentMethod, items: Array<{ orderId: string; itemId: number; qty: number }>) => Promise<boolean>;
  onRemoveSelectedItems: (items: Array<{ orderId: string; itemId: number; qty: number }>) => Promise<boolean>;
  onMoveConfirmedItemToPreOrder: (orderId: string, item: OrderItem) => void;
  onOpenCashDrawer: () => void;
}

interface ConfirmedItemRow {
  key: string;
  orderId: string;
  order: Order;
  item: OrderItem;
}

const PRICE_ADJUSTMENTS = [
  { label: '+0.10', deltaCents: 10 },
  { label: '+0.50', deltaCents: 50 },
  { label: '-0.10', deltaCents: -10 },
  { label: '-0.50', deltaCents: -50 }
];

export function confirmDestructiveAction(title: string, message: string, onConfirm: () => void): void {
  if (Platform.OS === 'web') {
    const webConfirm = (globalThis as typeof globalThis & { confirm?: (prompt: string) => boolean }).confirm;
    if (webConfirm?.(message)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Confirmar', style: 'destructive', onPress: onConfirm },
  ]);
}

export function OrderSection({
  selectedTable,
  preorderItems,
  tableOrders,
  menuByCategory,
  preorderTotal,
  confirmedTotal,
  currentTableTotal,
  isMutating,
  paymentPending,
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
  onRemoveSelectedItems,
  onMoveConfirmedItemToPreOrder,
  onOpenCashDrawer
}: OrderSectionProps): React.JSX.Element {
  const [aaQtyByKey, setAaQtyByKey] = useState<Record<string, number>>({});
  const [isAaModalVisible, setIsAaModalVisible] = useState(false);
  const [splitPeopleText, setSplitPeopleText] = useState('2');

  const confirmedItems: ConfirmedItemRow[] = useMemo(() =>
    tableOrders.flatMap((order) =>
      order.items.map((item, index) => ({
        key: `${order.id}-${item.id ?? index}-${item.name}-${item.unitPriceCents ?? 0}`,
        orderId: order.id,
        order,
        item
      }))
    ),
    [tableOrders]
  );

  const selectedAaItemCount = useMemo(
    () => Object.values(aaQtyByKey).reduce((sum, qty) => sum + qty, 0),
    [aaQtyByKey]
  );
  const selectedAaTotalCents = useMemo(
    () => confirmedItems.reduce((sum, confirmedItem) => {
      const selectedQty = aaQtyByKey[confirmedItem.key] ?? 0;
      return sum + selectedQty * (confirmedItem.item.unitPriceCents ?? 0);
    }, 0),
    [aaQtyByKey, confirmedItems]
  );
  const hasConfirmedItems = confirmedItems.length > 0;
  const checkoutDisabled = !hasConfirmedItems || isMutating || paymentPending;

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

  function buildAaSelectedItems(actionLabel: string): Array<{ orderId: string; itemId: number; qty: number }> | null {
    const items: Array<{ orderId: string; itemId: number; qty: number }> = [];

    for (const confirmedItem of confirmedItems) {
      const selectedQty = aaQtyByKey[confirmedItem.key] ?? 0;
      if (selectedQty <= 0) {
        continue;
      }
      if (confirmedItem.item.id === undefined) {
        Alert.alert(`No se puede ${actionLabel}`, 'Hay un artículo seleccionado sin identificador.');
        return null;
      }

      items.push({
        orderId: confirmedItem.orderId,
        itemId: confirmedItem.item.id,
        qty: selectedQty,
      });
    }

    if (items.length === 0) {
      Alert.alert('Sin selección AA', `Selecciona al menos un artículo para ${actionLabel}.`);
      return null;
    }

    return items;
  }

  async function handlePayAa(method: PaymentMethod): Promise<void> {
    const items = buildAaSelectedItems('registrar el pago AA');
    if (!items) {
      return;
    }

    if (await onPaySelectedItems(method, items)) {
      setAaQtyByKey({});
    }
  }

  async function handleRemoveSelectedAaItems(): Promise<void> {
    const items = buildAaSelectedItems('eliminar productos');
    if (!items) {
      return;
    }

    if (await onRemoveSelectedItems(items)) {
      setAaQtyByKey({});
    }
  }

  function handleRemoveConfirmedItem(item: ConfirmedItemRow): void {
    if (item.item.id === undefined) {
      Alert.alert('No se puede eliminar', 'Este producto de cocina no tiene identificador.');
      return;
    }

    confirmDestructiveAction(
      'Eliminar producto confirmado',
      `Se retirarán ${item.item.qty} unidad(es) de "${item.item.name}".`,
      () => {
        void onRemoveSelectedItems([{
          orderId: item.orderId,
          itemId: item.item.id!,
          qty: item.item.qty,
        }]);
      }
    );
  }

  function handleClearPreOrder(): void {
    confirmDestructiveAction(
      'Limpiar prepedido',
      'Se eliminarán todos los productos pendientes de esta mesa.',
      () => void onClearPreOrder()
    );
  }

  function confirmRemoveSelectedAaItems(): void {
    confirmDestructiveAction(
      'Quitar productos seleccionados',
      `Se retirarán ${selectedAaItemCount} unidad(es) de pedidos confirmados.`,
      () => void handleRemoveSelectedAaItems()
    );
  }

  return (
    <View style={styles.orderSection}>
      <Text style={styles.sectionTitle}>{`Cuenta mesa ${tableZoneLabel(selectedTable.zone)}-${selectedTable.number}`}</Text>

      <View style={styles.orderProductsColumns}>
        <View style={styles.orderProductsColumn}>
          <View style={styles.orderColumnHeader}>
            <Text style={styles.subTitle}>Prepedido</Text>
            <Text style={styles.orderColumnCount}>{String(preorderItems.length)}</Text>
          </View>

          <FlatList
            data={preorderItems}
            style={styles.orderColumnList}
            contentContainerStyle={styles.orderColumnListContent}
            keyExtractor={(item) => String(item.id)}
            ListEmptyComponent={<Text style={styles.emptyText}>No hay artículos en el prepedido.</Text>}
            renderItem={({ item }) => {
              const title = getItemDisplayName({
                name: item.menuItemId ? getMenuTitleById(menuByCategory, item.menuItemId) : item.name,
                primaryName: item.primaryName,
                secondaryName: item.secondaryName,
              });
              return (
                <View style={[styles.preorderRow, styles.preorderEditableRow]}>
                  <View style={styles.preorderMainRow}>
                    <View style={styles.flex1}>
                      <Text style={styles.itemName}>{title.primary}</Text>
                      {title.secondary ? <Text style={styles.itemPrice}>{title.secondary}</Text> : null}
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
                  </View>

                  <View style={styles.priceQuickActions}>
                    {PRICE_ADJUSTMENTS.map((adjustment) => (
                      <TouchableOpacity
                        key={adjustment.label}
                        style={styles.priceQuickButton}
                        onPress={() => onAdjustItemPrice(item.id, adjustment.deltaCents)}
                      >
                        <Text style={styles.priceQuickButtonText}>{adjustment.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            }}
          />

          <View style={styles.orderColumnFooter}>
            <Text style={styles.totalText}>{`Por enviar: ${formatPrice(preorderTotal)}`}</Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.primaryButton, (preorderItems.length === 0 || isMutating || paymentPending) && styles.aaDisabledButton]} onPress={() => void onConfirmOrder()} disabled={preorderItems.length === 0 || isMutating || paymentPending}>
                <Text style={styles.primaryButtonText}>{isMutating ? 'Guardando…' : 'Enviar a cocina'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, (preorderItems.length === 0 || isMutating || paymentPending) && styles.aaDisabledButton]} onPress={handleClearPreOrder} disabled={preorderItems.length === 0 || isMutating || paymentPending}>
                <Text style={styles.secondaryButtonText}>Limpiar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={[styles.orderProductsColumn, styles.confirmedOrderProductsColumn]}>
          <View style={styles.orderColumnHeader}>
            <Text style={styles.subTitle}>Pedidos confirmados</Text>
            <Text style={styles.orderColumnCount}>{String(confirmedItems.length)}</Text>
          </View>

          <FlatList
            data={confirmedItems}
            style={styles.orderColumnList}
            contentContainerStyle={styles.orderColumnListContent}
            keyExtractor={(item) => item.key}
            ListEmptyComponent={<Text style={styles.emptyText}>No hay pedidos confirmados.</Text>}
            renderItem={({ item }) => {
              const displayName = getItemDisplayName(item.item);
              return (
                <View style={[styles.preorderRow, styles.confirmedPreorderRow]}>
                  <View style={styles.flex1}>
                    <Text style={styles.itemName}>{displayName.primary}</Text>
                    {displayName.secondary ? <Text style={styles.itemPrice}>{displayName.secondary}</Text> : null}
                    <Text style={styles.itemPrice}>{formatPrice((item.item.unitPriceCents ?? 0) * item.item.qty)}</Text>
                  </View>

                  <Text style={styles.confirmedQtyText}>{`x${item.item.qty}`}</Text>

                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={[styles.primaryButton, (isMutating || paymentPending) && styles.aaDisabledButton]} onPress={() => onMoveConfirmedItemToPreOrder(item.orderId, item.item)} disabled={isMutating || paymentPending}>
                      <Text style={styles.primaryButtonText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.secondaryButton, (isMutating || paymentPending) && styles.aaDisabledButton]} onPress={() => handleRemoveConfirmedItem(item)} disabled={isMutating || paymentPending}>
                      <Text style={styles.secondaryButtonText}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        </View>
      </View>

      <View style={styles.checkoutPanel}>
        <View style={styles.checkoutTotalField}>
          <Text style={styles.checkoutTotalLabel}>Total confirmado</Text>
          <Text style={styles.checkoutTotalAmount}>{formatPrice(confirmedTotal)}</Text>
          {preorderTotal > 0 ? (
            <Text style={styles.helperText}>{`Pendiente sin incluir: ${formatPrice(preorderTotal)} · Cuenta completa: ${formatPrice(currentTableTotal)}`}</Text>
          ) : null}
          {paymentPending ? <Text style={styles.helperText}>Registrando pago…</Text> : null}
          {!paymentPending && isMutating ? <Text style={styles.helperText}>Guardando cambios…</Text> : null}
        </View>
        <View style={styles.checkoutActions}>
          <TouchableOpacity
            style={[styles.desktopCheckoutPrimaryButton, checkoutDisabled && styles.aaDisabledButton]}
            onPress={() => onPrintTicket()}
            disabled={checkoutDisabled}
          >
            <Text style={styles.desktopCheckoutPrimaryButtonText}>Imprimir ticket</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.desktopCheckoutSecondaryButton, checkoutDisabled && styles.aaDisabledButton]} onPress={handleOpenAaModal} disabled={checkoutDisabled}>
            <Text style={styles.desktopCheckoutSecondaryButtonText}>AA</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.desktopCheckoutSecondaryButton, checkoutDisabled && styles.aaDisabledButton]} onPress={() => void onPayTicket('cash')} disabled={checkoutDisabled}>
            <Text style={styles.desktopCheckoutSecondaryButtonText}>{paymentPending ? 'Pagando…' : 'Pagar efectivo'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.desktopCheckoutSecondaryButton, checkoutDisabled && styles.aaDisabledButton]} onPress={() => void onPayTicket('card')} disabled={checkoutDisabled}>
            <Text style={styles.desktopCheckoutSecondaryButtonText}>Pagar tarjeta</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.desktopCheckoutSecondaryButton} onPress={onOpenCashDrawer}>
            <Text style={styles.desktopCheckoutSecondaryButtonText}>Abrir caja</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.splitTicketControls}>
          <Text style={styles.splitTicketLabel}>Cuenta dividida: comensales</Text>
          <TextInput
            style={[styles.smallNumberInput, styles.splitPeopleInput]}
            keyboardType="number-pad"
            value={splitPeopleText}
            onChangeText={setSplitPeopleText}
            placeholder="2"
          />
          <TouchableOpacity style={[styles.desktopCheckoutSecondaryButton, checkoutDisabled && styles.aaDisabledButton]} onPress={handlePrintDividedTicket} disabled={checkoutDisabled}>
            <Text style={styles.desktopCheckoutSecondaryButtonText}>Imprimir dividido</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={isAaModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAaModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsAaModalVisible(false)}>
          <Pressable style={styles.modalPanel} onPress={(event) => event.stopPropagation()}>
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
              renderItem={({ item }) => {
                const displayName = getItemDisplayName(item.item);
                return (
                <View style={styles.aaSelectionRow}>
                  <View style={styles.flex1}>
                    <Text style={styles.itemName}>{displayName.primary}</Text>
                    {displayName.secondary ? <Text style={styles.itemPrice}>{displayName.secondary}</Text> : null}
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
                );
              }}
            />

            <View style={styles.modalFooter}>
              <View style={styles.aaSelectedSummary}>
                <Text style={styles.aaSelectedSummaryLabel}>{`Seleccionado (${selectedAaItemCount})`}</Text>
                <Text style={styles.aaSelectedSummaryAmount}>{formatPrice(selectedAaTotalCents)}</Text>
              </View>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setAaQtyByKey({})}>
                <Text style={styles.secondaryButtonText}>Limpiar AA</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, selectedAaItemCount === 0 ? styles.aaDisabledButton : null]}
                onPress={confirmRemoveSelectedAaItems}
                disabled={selectedAaItemCount === 0 || isMutating || paymentPending}
              >
                <Text style={styles.secondaryButtonText}>Quitar seleccionados</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, (selectedAaItemCount === 0 || isMutating || paymentPending) && styles.aaDisabledButton]} onPress={handlePrintAaTicket} disabled={selectedAaItemCount === 0 || isMutating || paymentPending}>
                <Text style={styles.primaryButtonText}>{`Imprimir AA (${selectedAaItemCount})`}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, (selectedAaItemCount === 0 || isMutating || paymentPending) && styles.aaDisabledButton]} onPress={() => void handlePayAa('cash')} disabled={selectedAaItemCount === 0 || isMutating || paymentPending}>
                <Text style={styles.secondaryButtonText}>{paymentPending ? 'Pagando…' : 'Pagar efectivo'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, (selectedAaItemCount === 0 || isMutating || paymentPending) && styles.aaDisabledButton]} onPress={() => void handlePayAa('card')} disabled={selectedAaItemCount === 0 || isMutating || paymentPending}>
                <Text style={styles.secondaryButtonText}>Pagar tarjeta</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
