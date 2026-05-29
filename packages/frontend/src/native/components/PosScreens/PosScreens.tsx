import React, { ComponentProps, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  LayoutChangeEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { styles } from '../../app/App.styles';
import { getItemDisplayName } from '../../helpers/itemDisplayName';
import { getSimplifiedInvoiceConfig } from '../../helpers/kitchenTicketPrinter';
import { MenuItem, Order, OrderItem, PaymentMethod, PreOrderItem, TABLE_ZONES, TableId, TableZone, tableZoneLabel } from '../../types';
import { MenuCategoryGroup, translateCategory } from '../MenuZoneGroup/MenuCategoryGroup';
import { OrderSection } from '../OrderZone/OrderSection';
import { TableZoneGroup } from '../TableZoneGroup/TableZoneGroup';

type MenuLayout = 'desktop' | 'mobile';
type MobileTpvView = 'tables' | 'menu' | 'ticket';
const MOBILE_TPV_VIEWS: MobileTpvView[] = ['tables', 'menu', 'ticket'];

const MOBILE_PRICE_ADJUSTMENTS = [
  { label: '-0,50', deltaCents: -50 },
  { label: '-0,10', deltaCents: -10 },
  { label: '+0,10', deltaCents: 10 },
  { label: '+0,50', deltaCents: 50 },
];

interface ConfirmedItemRow {
  key: string;
  orderId: string;
  order: Order;
  item: OrderItem;
}

export interface PosScreenProps {
  tables: Map<TableZone, number[]>;
  tableTotals: Map<string, number>;
  selectedTable: TableId;
  menuCategories: string[];
  visibleMenuCategory: string | null;
  menuSearchText: string;
  normalizedMenuSearch: string;
  displayedMenuCategory: string | null;
  displayedMenuItems: MenuItem[];
  minSearchLength: number;
  orderSectionProps: ComponentProps<typeof OrderSection>;
  onMenuSearchTextChange: (value: string) => void;
  onSelectMenuCategory: (category: string) => void;
  onSelectTable: (table: TableId) => void;
  onAddTable: (zone: TableZone) => void;
  onRemoveTable: (table: TableId) => void;
  onAddMenuItem: (menuId: number) => void;
  onExit?: () => void;
  formatPrice: (cents: number) => string;
}

interface TableSelectorProps {
  layout?: MenuLayout;
  tables: Map<TableZone, number[]>;
  tableTotals: Map<string, number>;
  selectedTable: TableId;
  onSelectTable: (table: TableId) => void;
  onAddTable: (zone: TableZone) => void;
  onRemoveTable: (table: TableId) => void;
  formatPrice: (cents: number) => string;
}

function TableSelector({ layout = 'desktop', tables, tableTotals, selectedTable, onSelectTable, onAddTable, onRemoveTable, formatPrice }: TableSelectorProps): React.JSX.Element {
  return (
    <>
      {TABLE_ZONES.map((zone: TableZone) => (
        <TableZoneGroup
          key={zone}
          layout={layout}
          zone={zone}
          numbers={tables.get(zone) ?? []}
          tableTotals={tableTotals}
          selectedTable={selectedTable}
          onSelectTable={onSelectTable}
          onAddTable={onAddTable}
          onRemoveTable={onRemoveTable}
          formatPrice={formatPrice}
        />
      ))}
    </>
  );
}

interface MenuSelectorProps {
  layout: MenuLayout;
  menuCategories: string[];
  visibleMenuCategory: string | null;
  menuSearchText: string;
  normalizedMenuSearch: string;
  displayedMenuCategory: string | null;
  displayedMenuItems: MenuItem[];
  minSearchLength: number;
  onMenuSearchTextChange: (value: string) => void;
  onSelectMenuCategory: (category: string) => void;
  onAddMenuItem: (menuId: number) => void;
  formatPrice: (cents: number) => string;
}

function MenuSelector({
  layout,
  menuCategories,
  visibleMenuCategory,
  menuSearchText,
  normalizedMenuSearch,
  displayedMenuCategory,
  displayedMenuItems,
  minSearchLength,
  onMenuSearchTextChange,
  onSelectMenuCategory,
  onAddMenuItem,
  formatPrice,
}: MenuSelectorProps): React.JSX.Element {
  return (
    <>
      <TextInput
        style={styles.menuSearchInput}
        value={menuSearchText}
        onChangeText={onMenuSearchTextChange}
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
              onPress={() => onSelectMenuCategory(category)}
              activeOpacity={0.75}
            >
              <Text style={[styles.menuTypeButtonText, isSelected && styles.menuTypeButtonTextSelected]}>
                {translateCategory(category)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {normalizedMenuSearch.length > 0 && normalizedMenuSearch.length < minSearchLength ? (
        <Text style={styles.emptyText}>Escribe al menos 2 letras para buscar.</Text>
      ) : displayedMenuCategory ? (
        <MenuCategoryGroup
          category={displayedMenuCategory}
          items={displayedMenuItems}
          onSelectItem={onAddMenuItem}
          formatPrice={formatPrice}
          layout={layout}
        />
      ) : (
        <Text style={styles.emptyText}>No hay productos disponibles.</Text>
      )}
    </>
  );
}

function getConfirmedItems(tableOrders: Order[]): ConfirmedItemRow[] {
  return tableOrders.flatMap((order) =>
    order.items.map((item, index) => ({
      key: `${order.id}-${item.id ?? index}-${item.name}-${item.unitPriceCents ?? 0}`,
      orderId: order.id,
      order,
      item,
    }))
  );
}

function getCombinedConfirmedLines(confirmedItems: ConfirmedItemRow[]): Array<{ key: string; name: string; primaryName?: string | null; secondaryName?: string | null; qty: number; unitPriceCents: number; totalPriceCents: number }> {
  const lineByKey = new Map<string, { key: string; name: string; primaryName?: string | null; secondaryName?: string | null; qty: number; unitPriceCents: number; totalPriceCents: number }>();

  for (const confirmedItem of confirmedItems) {
    const unitPriceCents = confirmedItem.item.unitPriceCents ?? 0;
    const key = `${confirmedItem.item.name.trim().toLowerCase()}|${unitPriceCents}`;
    const existing = lineByKey.get(key);
    const totalPriceCents = unitPriceCents * confirmedItem.item.qty;

    if (existing) {
      existing.qty += confirmedItem.item.qty;
      existing.totalPriceCents += totalPriceCents;
    } else {
      lineByKey.set(key, {
        key,
        name: confirmedItem.item.name,
        primaryName: confirmedItem.item.primaryName,
        secondaryName: confirmedItem.item.secondaryName,
        qty: confirmedItem.item.qty,
        unitPriceCents,
        totalPriceCents,
      });
    }
  }

  return Array.from(lineByKey.values());
}

function MobilePreorderItem({
  item,
  orderProps,
}: {
  item: PreOrderItem;
  orderProps: PosScreenProps['orderSectionProps'];
}): React.JSX.Element {
  const title = getItemDisplayName({
    name: item.menuItemId ? orderProps.getMenuTitleById(orderProps.menuByCategory, item.menuItemId) : item.name,
    primaryName: item.primaryName,
    secondaryName: item.secondaryName,
  });

  return (
    <View style={[styles.mobileOrderItem, styles.mobileEditableOrderItem]}>
      <View style={styles.mobilePreorderMainRow}>
        <View style={styles.flex1}>
          <Text style={styles.mobileOrderItemName} numberOfLines={1}>{title.primary}</Text>
          {title.secondary ? <Text style={styles.mobileOrderItemPrice} numberOfLines={2}>{title.secondary}</Text> : null}
          <Text style={styles.mobileOrderItemPrice}>{orderProps.formatPrice(item.unitPriceCents * item.qty)}</Text>
        </View>
        <View style={styles.qtyGroup}>
          <TouchableOpacity style={[styles.qtyButton, styles.mobileQtyButton]} onPress={() => orderProps.onRemovePendingItem(item.id)}>
            <Text style={styles.mobileQtyButtonText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.mobileQtyText}>{item.qty}</Text>
          <TouchableOpacity style={[styles.qtyButton, styles.mobileQtyButton]} onPress={() => orderProps.onAddPendingItem(item.id)}>
            <Text style={styles.mobileQtyButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.mobilePriceEditRow}>
        <TextInput
          style={[styles.priceInput, styles.mobilePriceInput]}
          keyboardType="decimal-pad"
          value={orderProps.priceDraftByItemId[item.id] ?? (item.unitPriceCents / 100).toFixed(2)}
          selectTextOnFocus
          placeholder="0.00"
          placeholderTextColor="#6B7280"
          onChangeText={(value) => orderProps.onUpdatePriceDraft(item.id, value)}
          onBlur={() => orderProps.onCommitPriceDraft(item.id)}
          onSubmitEditing={() => orderProps.onCommitPriceDraft(item.id)}
        />
        <View style={styles.mobilePriceQuickActions}>
          {MOBILE_PRICE_ADJUSTMENTS.map((adjustment) => (
            <TouchableOpacity
              key={adjustment.label}
              style={styles.mobilePriceQuickButton}
              onPress={() => orderProps.onAdjustItemPrice(item.id, adjustment.deltaCents)}
            >
              <Text style={styles.mobilePriceQuickButtonText}>{adjustment.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

function MobileCartaPreorderSidebar({ orderProps }: { orderProps: PosScreenProps['orderSectionProps'] }): React.JSX.Element {
  const hasItems = orderProps.preorderItems.length > 0;

  return (
    <View style={styles.mobileCartaSidebar}>
      <View style={styles.mobileCartaSidebarHeader}>
        <Text style={styles.mobileCartaSidebarTitle}>Pend.</Text>
        <Text style={styles.mobileCartaSidebarCount}>{String(orderProps.preorderItems.length)}</Text>
      </View>
      <ScrollView style={styles.mobileCartaSidebarList} showsVerticalScrollIndicator={false}>
        {hasItems ? (
          orderProps.preorderItems.map((item) => {
            const title = getItemDisplayName({
              name: item.menuItemId ? orderProps.getMenuTitleById(orderProps.menuByCategory, item.menuItemId) : item.name,
              primaryName: item.primaryName,
              secondaryName: item.secondaryName,
            });

            return (
              <View key={item.id} style={styles.mobileCartaSidebarItem}>
                <Text style={styles.mobileCartaSidebarQty}>{`x${item.qty}`}</Text>
                <View style={styles.flex1}>
                  <Text style={styles.mobileCartaSidebarName} numberOfLines={1}>{title.primary}</Text>
                  {title.secondary ? <Text style={styles.mobileOrderItemPrice} numberOfLines={1}>{title.secondary}</Text> : null}
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.mobileCartaSidebarEmpty}>Sin pendientes</Text>
        )}
      </ScrollView>
      <Text style={styles.mobileCartaSidebarTotal} numberOfLines={1}>
        {orderProps.formatPrice(orderProps.preorderTotal)}
      </Text>
      <TouchableOpacity
        style={[styles.mobileCartaSidebarSendButton, !hasItems && styles.mobileDisabledButton]}
        onPress={orderProps.onConfirmOrder}
        disabled={!hasItems}
      >
        <Text style={styles.mobileCartaSidebarSendText}>Enviar</Text>
      </TouchableOpacity>
    </View>
  );
}

function MobileConfirmedItem({
  item,
  orderId,
  orderProps,
}: {
  item: OrderItem;
  orderId: string;
  orderProps: PosScreenProps['orderSectionProps'];
}): React.JSX.Element {
  const displayName = getItemDisplayName(item);
  return (
    <View style={styles.mobileOrderItem}>
      <View style={styles.flex1}>
        <Text style={styles.mobileOrderItemName} numberOfLines={1}>{displayName.primary}</Text>
        {displayName.secondary ? <Text style={styles.mobileOrderItemPrice} numberOfLines={2}>{displayName.secondary}</Text> : null}
        <Text style={styles.mobileOrderItemPrice}>
          {orderProps.formatPrice((item.unitPriceCents ?? 0) * item.qty)}
        </Text>
      </View>
      <Text style={styles.mobileConfirmedQtyText}>{`x${item.qty}`}</Text>
      <TouchableOpacity
        style={styles.mobileOrderSecondaryButton}
        onPress={() => orderProps.onMoveConfirmedItemToPreOrder(orderId, item)}
      >
        <Text style={styles.mobileOrderButtonText}>Editar</Text>
      </TouchableOpacity>
    </View>
  );
}

function MobileOrderSummary({ orderProps }: { orderProps: PosScreenProps['orderSectionProps'] }): React.JSX.Element {
  const [aaQtyByKey, setAaQtyByKey] = useState<Record<string, number>>({});
  const [isAaModalVisible, setIsAaModalVisible] = useState(false);
  const [isCustomerTicketVisible, setIsCustomerTicketVisible] = useState(false);
  const [splitPeopleText, setSplitPeopleText] = useState('2');
  const confirmedItems = getConfirmedItems(orderProps.tableOrders);
  const customerTicketLines = getCombinedConfirmedLines(confirmedItems);
  const invoiceConfig = getSimplifiedInvoiceConfig();
  const ticketTotalCents = customerTicketLines.reduce((sum, item) => sum + item.totalPriceCents, 0);
  const vatRate = invoiceConfig.vatRatePercent / 100;
  const taxableBaseCents = Math.round(ticketTotalCents / (1 + vatRate));
  const vatCents = ticketTotalCents - taxableBaseCents;
  const customerTicketIssuedAt = new Date();
  const hasPreorder = orderProps.preorderItems.length > 0;
  const hasConfirmed = confirmedItems.length > 0;
  const selectedAaItemCount = Object.values(aaQtyByKey).reduce((sum, qty) => sum + qty, 0);

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

  function getSplitPeople(): number | null {
    const splitPeople = Number(splitPeopleText.replace(',', '.').trim());
    if (!Number.isInteger(splitPeople) || splitPeople < 2) {
      Alert.alert('División no válida', 'Introduce un número entero de comensales mayor que 1.');
      return null;
    }
    return splitPeople;
  }

  function handlePrintDividedTicket(): void {
    const splitPeople = getSplitPeople();
    if (!splitPeople) {
      return;
    }

    orderProps.onPrintTicket({
      splitPeople,
      ticketNote: 'Cuenta dividida a partes iguales',
    });
  }

  function handlePrintAaTicket(): void {
    if (selectedAaItemCount === 0) {
      Alert.alert('Sin selección AA', 'Selecciona al menos un artículo para imprimir un ticket individual.');
      return;
    }

    orderProps.onPrintTicket({
      confirmedOrders: buildAaOrders(),
      ticketNote: 'AA - consumo individual',
    });
    setIsAaModalVisible(false);
    setAaQtyByKey({});
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

    orderProps.onPaySelectedItems(method, items);
    setIsAaModalVisible(false);
    setAaQtyByKey({});
  }

  return (
    <View style={styles.mobileOrderSection}>
      <View style={styles.mobileOrderHeader}>
        <View>
          <Text style={styles.mobileOrderTitle}>
            {`Mesa ${tableZoneLabel(orderProps.selectedTable.zone)}-${orderProps.selectedTable.number}`}
          </Text>
          <Text style={styles.mobileOrderItemPrice}>
            {`${orderProps.preorderItems.length} prepedido · ${confirmedItems.length} cocina`}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.mobileOrderScroll} showsVerticalScrollIndicator>
        <View style={styles.mobileOrderBlock}>
          <View style={styles.mobileOrderBlockHeader}>
            <Text style={styles.mobileOrderBlockTitle}>Prepedido</Text>
            <Text style={styles.mobileBadge}>{String(orderProps.preorderItems.length)}</Text>
          </View>
          {hasPreorder ? (
            orderProps.preorderItems.map((item) => (
              <MobilePreorderItem key={item.id} item={item} orderProps={orderProps} />
            ))
          ) : (
            <Text style={styles.emptyText}>No hay productos seleccionados.</Text>
          )}
        </View>

        <View style={styles.mobileStickyActions}>
          <TouchableOpacity
            style={[styles.mobileOrderPrimaryButton, styles.flex1, !hasPreorder && styles.mobileDisabledButton]}
            onPress={orderProps.onConfirmOrder}
            disabled={!hasPreorder}
          >
            <Text style={styles.mobileOrderPrimaryButtonText}>Enviar a cocina</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mobileOrderSecondaryButton, styles.flex1, !hasPreorder && styles.mobileDisabledButton]}
            onPress={orderProps.onClearPreOrder}
            disabled={!hasPreorder}
          >
            <Text style={styles.mobileOrderButtonText}>Limpiar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mobileOrderBlock}>
          <View style={styles.mobileOrderBlockHeader}>
            <Text style={styles.mobileOrderBlockTitle}>En cocina / confirmados</Text>
            <Text style={styles.mobileBadge}>{String(confirmedItems.length)}</Text>
          </View>
          {hasConfirmed ? (
            confirmedItems.map((confirmedItem) => (
              <MobileConfirmedItem
                key={confirmedItem.key}
                item={confirmedItem.item}
                orderId={confirmedItem.orderId}
                orderProps={orderProps}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>No hay productos enviados a cocina.</Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.mobileCheckoutPanel}>
        <View style={styles.mobileCheckoutTotalField}>
          <Text style={styles.mobileCheckoutTotalLabel}>Total</Text>
          <Text style={styles.mobileOrderTotal}>{orderProps.formatPrice(orderProps.currentTableTotal)}</Text>
        </View>
        <View style={styles.mobileTicketActionsRow}>
          <TouchableOpacity
            style={[styles.mobileOrderPrimaryButton, styles.mobileCheckoutActionButton, !hasConfirmed && styles.mobileDisabledButton]}
            onPress={() => orderProps.onPrintTicket()}
            disabled={!hasConfirmed}
          >
            <Text style={styles.mobileOrderPrimaryButtonText}>Imprimir</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mobileOrderSecondaryButton, styles.mobileCheckoutActionButton, !hasConfirmed && styles.mobileDisabledButton]}
            onPress={() => setIsCustomerTicketVisible(true)}
            disabled={!hasConfirmed}
          >
            <Text style={styles.mobileOrderButtonText}>Ver ticket</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mobileOrderSecondaryButton, styles.mobileCheckoutActionButton, !hasConfirmed && styles.mobileDisabledButton]}
            onPress={() => setIsAaModalVisible(true)}
            disabled={!hasConfirmed}
          >
            <Text style={styles.mobileOrderButtonText}>AA</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.mobileOrderSecondaryButton, styles.mobileCheckoutActionButton]} onPress={orderProps.onOpenCashDrawer}>
            <Text style={styles.mobileOrderButtonText}>Caja</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mobileOrderSecondaryButton, styles.mobileCheckoutActionButton, !hasConfirmed && styles.mobileDisabledButton]}
            onPress={() => orderProps.onPayTicket('cash')}
            disabled={!hasConfirmed}
          >
            <Text style={styles.mobileOrderButtonText}>Efectivo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mobileOrderSecondaryButton, styles.mobileCheckoutActionButton, !hasConfirmed && styles.mobileDisabledButton]}
            onPress={() => orderProps.onPayTicket('card')}
            disabled={!hasConfirmed}
          >
            <Text style={styles.mobileOrderButtonText}>Tarjeta</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.smallNumberInput, styles.mobileSplitInput, !hasConfirmed && styles.mobileDisabledButton]}
            keyboardType="number-pad"
            value={splitPeopleText}
            onChangeText={setSplitPeopleText}
            placeholder="2"
            editable={hasConfirmed}
          />
          <TouchableOpacity
            style={[styles.mobileOrderSecondaryButton, styles.mobileCheckoutActionButton, !hasConfirmed && styles.mobileDisabledButton]}
            onPress={handlePrintDividedTicket}
            disabled={!hasConfirmed}
          >
            <Text style={styles.mobileOrderButtonText}>Dividir</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={isCustomerTicketVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCustomerTicketVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalPanel, styles.mobileCustomerTicketPanel]}>
            <View style={styles.mobileCustomerTicketHeader}>
              <TouchableOpacity style={styles.mobileOrderSecondaryButton} onPress={() => setIsCustomerTicketVisible(false)}>
                <Text style={styles.mobileOrderButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.mobileCustomerTicketList}>
              <View style={styles.mobileCustomerTicketPaper}>
                <Text style={styles.mobileCustomerTicketBusinessName}>{invoiceConfig.businessName}</Text>
                <Text style={styles.mobileCustomerTicketTradeName}>{invoiceConfig.tradeName}</Text>
                <Text style={styles.mobileCustomerTicketSmall}>{`NIF ${invoiceConfig.nif}`}</Text>
                <Text style={styles.mobileCustomerTicketSmall}>{invoiceConfig.address}</Text>
                <Text style={styles.mobileCustomerTicketSmall}>{invoiceConfig.city}</Text>
                <Text style={styles.mobileCustomerTicketSmall}>{`Tel. ${invoiceConfig.phone}`}</Text>
                <View style={styles.mobileCustomerTicketDivider} />
                <Text style={styles.mobileCustomerTicketTitle}>Factura simplificada</Text>
                <View style={styles.mobileCustomerTicketMeta}>
                  <Text style={styles.mobileCustomerTicketSmall}>{`Mesa ${tableZoneLabel(orderProps.selectedTable.zone)}-${orderProps.selectedTable.number}`}</Text>
                  <Text style={styles.mobileCustomerTicketSmall}>
                    {customerTicketIssuedAt.toLocaleString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={styles.mobileCustomerTicketDivider} />
                <View style={styles.mobileCustomerTicketTableHeader}>
                  <Text style={styles.mobileCustomerTicketQtyHeader}>Ud</Text>
                  <Text style={styles.mobileCustomerTicketNameHeader}>Producto</Text>
                  <Text style={styles.mobileCustomerTicketMoneyHeader}>P.Unit</Text>
                  <Text style={styles.mobileCustomerTicketMoneyHeader}>Total</Text>
                </View>
                {customerTicketLines.map((item) => {
                  const displayName = getItemDisplayName(item);
                  return (
                    <View key={`customer-ticket-${item.key}`} style={styles.mobileCustomerTicketRow}>
                      <Text style={styles.mobileCustomerTicketQty}>{String(item.qty)}</Text>
                      <View style={styles.mobileCustomerTicketNameCell}>
                        <Text style={styles.mobileCustomerTicketItemName} numberOfLines={1}>{displayName.primary}</Text>
                        {displayName.secondary ? <Text style={styles.mobileCustomerTicketSmall} numberOfLines={2}>{displayName.secondary}</Text> : null}
                      </View>
                      <Text style={styles.mobileCustomerTicketAmount}>{orderProps.formatPrice(item.unitPriceCents)}</Text>
                      <Text style={styles.mobileCustomerTicketAmount}>{orderProps.formatPrice(item.totalPriceCents)}</Text>
                    </View>
                  );
                })}
                {customerTicketLines.length === 0 ? <Text style={styles.emptyText}>No hay productos enviados a cocina.</Text> : null}
                <View style={styles.mobileCustomerTicketDivider} />
                <View style={styles.mobileCustomerTicketSummaryRow}>
                  <Text style={styles.mobileCustomerTicketSmall}>{`Base imponible IVA ${invoiceConfig.vatRatePercent.toFixed(0)}%`}</Text>
                  <Text style={styles.mobileCustomerTicketAmount}>{orderProps.formatPrice(taxableBaseCents)}</Text>
                </View>
                <View style={styles.mobileCustomerTicketSummaryRow}>
                  <Text style={styles.mobileCustomerTicketSmall}>{`IVA ${invoiceConfig.vatRatePercent.toFixed(0)}%`}</Text>
                  <Text style={styles.mobileCustomerTicketAmount}>{orderProps.formatPrice(vatCents)}</Text>
                </View>
                <View style={styles.mobileCustomerTicketTotal}>
                  <Text style={styles.mobileCheckoutTotalLabel}>Total IVA incluido</Text>
                  <Text style={styles.mobileCustomerTicketTotalAmount}>{orderProps.formatPrice(ticketTotalCents)}</Text>
                </View>
                <Text style={styles.mobileCustomerTicketFooter}>IVA incluido. Vista previa para cliente.</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isAaModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAaModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalPanel, styles.mobileAaModalPanel]}>
            <View style={styles.modalHeader}>
              <View style={styles.flex1}>
                <Text style={styles.modalTitle}>Módulo AA</Text>
                <Text style={styles.mobileOrderItemPrice}>Selecciona productos para este cliente.</Text>
              </View>
              <TouchableOpacity style={styles.mobileOrderSecondaryButton} onPress={() => setIsAaModalVisible(false)}>
                <Text style={styles.mobileOrderButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.mobileAaList}>
              {confirmedItems.map((confirmedItem) => {
                const displayName = getItemDisplayName(confirmedItem.item);
                return (
                <View key={`mobile-aa-${confirmedItem.key}`} style={styles.mobileAaSelectionRow}>
                  <View style={styles.flex1}>
                    <Text style={styles.mobileOrderItemName} numberOfLines={1}>{displayName.primary}</Text>
                    {displayName.secondary ? <Text style={styles.mobileOrderItemPrice} numberOfLines={2}>{displayName.secondary}</Text> : null}
                    <Text style={styles.mobileOrderItemPrice}>
                      {`${orderProps.formatPrice(confirmedItem.item.unitPriceCents ?? 0)} · disponible x${confirmedItem.item.qty}`}
                    </Text>
                  </View>

                  <View style={styles.qtyGroup}>
                    <TouchableOpacity
                      style={[styles.qtyButton, styles.mobileQtyButton]}
                      onPress={() => setAaQty(confirmedItem.key, (aaQtyByKey[confirmedItem.key] ?? 0) - 1, confirmedItem.item.qty)}
                    >
                      <Text style={styles.mobileQtyButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.mobileQtyText}>{aaQtyByKey[confirmedItem.key] ?? 0}</Text>
                    <TouchableOpacity
                      style={[styles.qtyButton, styles.mobileQtyButton]}
                      onPress={() => setAaQty(confirmedItem.key, (aaQtyByKey[confirmedItem.key] ?? 0) + 1, confirmedItem.item.qty)}
                    >
                      <Text style={styles.mobileQtyButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                );
              })}
              {confirmedItems.length === 0 ? <Text style={styles.emptyText}>No hay pedidos confirmados.</Text> : null}
            </ScrollView>

            <View style={styles.mobileAaFooter}>
              <TouchableOpacity style={styles.mobileOrderSecondaryButton} onPress={() => setAaQtyByKey({})}>
                <Text style={styles.mobileOrderButtonText}>Limpiar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileOrderPrimaryButton} onPress={handlePrintAaTicket}>
                <Text style={styles.mobileOrderPrimaryButtonText}>{`Imprimir AA (${selectedAaItemCount})`}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileOrderSecondaryButton} onPress={() => handlePayAa('cash')}>
                <Text style={styles.mobileOrderButtonText}>Pagar efectivo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobileOrderSecondaryButton} onPress={() => handlePayAa('card')}>
                <Text style={styles.mobileOrderButtonText}>Pagar tarjeta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function MobilePosScreen(props: PosScreenProps): React.JSX.Element {
  const [activeView, setActiveView] = useState<MobileTpvView>('tables');
  const [pageWidth, setPageWidth] = useState(0);
  const pagerRef = useRef<ScrollView>(null);
  const currentTableTotal = props.orderSectionProps.currentTableTotal;

  function goToView(view: MobileTpvView, animated = true): void {
    setActiveView(view);
    if (pageWidth > 0) {
      pagerRef.current?.scrollTo({
        x: MOBILE_TPV_VIEWS.indexOf(view) * pageWidth,
        animated,
      });
    }
  }

  function handleBack(): void {
    if (activeView === 'ticket') {
      goToView('menu');
      return;
    }
    if (activeView === 'menu') {
      goToView('tables');
      return;
    }
    props.onExit?.();
  }

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });

    return () => subscription.remove();
  }, [activeView, props.onExit]);

  function handleSelectTable(table: TableId): void {
    props.onSelectTable(table);
  }

  function handleAddMenuItem(menuId: number): void {
    props.onAddMenuItem(menuId);
  }

  function handlePagerLayout(event: LayoutChangeEvent): void {
    const nextWidth = event.nativeEvent.layout.width;
    setPageWidth(nextWidth);
  }

  function handlePagerMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>): void {
    if (pageWidth <= 0) {
      return;
    }

    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    const nextView = MOBILE_TPV_VIEWS[Math.max(0, Math.min(nextIndex, MOBILE_TPV_VIEWS.length - 1))];
    setActiveView(nextView);
  }

  useEffect(() => {
    if (pageWidth > 0) {
      pagerRef.current?.scrollTo({
        x: MOBILE_TPV_VIEWS.indexOf(activeView) * pageWidth,
        animated: false,
      });
    }
  }, [activeView, pageWidth]);

  return (
    <View style={styles.mobilePosScreen}>
      <View style={styles.mobileViewSwitch}>
        {([
          ['tables', 'Mesa'],
          ['menu', 'Carta'],
          ['ticket', `Cuenta ${props.formatPrice(currentTableTotal)}`],
        ] as Array<[MobileTpvView, string]>).map(([view, label]) => (
          <TouchableOpacity
            key={view}
            style={[styles.mobileViewButton, activeView === view && styles.mobileViewButtonSelected]}
            onPress={() => goToView(view)}
          >
            <Text style={[styles.mobileViewButtonText, activeView === view && styles.mobileViewButtonTextSelected]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.mobilePager} onLayout={handlePagerLayout}>
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.mobilePagerScroll}
          contentContainerStyle={styles.mobilePagerContent}
          onMomentumScrollEnd={handlePagerMomentumEnd}
          scrollEventThrottle={16}
        >
          <View style={[styles.mobilePagerPage, pageWidth > 0 ? { width: pageWidth } : null]}>
            <View style={styles.mobileSinglePanel}>
              <ScrollView style={styles.mobilePanelScroll} showsVerticalScrollIndicator={false}>
                <TableSelector
                  layout="mobile"
                  tables={props.tables}
                  tableTotals={props.tableTotals}
                  selectedTable={props.selectedTable}
                  onSelectTable={handleSelectTable}
                  onAddTable={props.onAddTable}
                  onRemoveTable={props.onRemoveTable}
                  formatPrice={props.formatPrice}
                />
              </ScrollView>
            </View>
          </View>

          <View style={[styles.mobilePagerPage, pageWidth > 0 ? { width: pageWidth } : null]}>
            <View style={styles.mobileSinglePanel}>
              <View style={styles.mobileCartaLayout}>
                <MobileCartaPreorderSidebar orderProps={props.orderSectionProps} />
                <View style={styles.mobileCartaMenuPane}>
                  <Text style={styles.mobileGuidanceText}>Toca varios productos y abre la cuenta cuando hayas terminado.</Text>
                  <ScrollView style={styles.mobilePanelScroll} showsVerticalScrollIndicator={false}>
                    <MenuSelector
                      layout="mobile"
                      menuCategories={props.menuCategories}
                      visibleMenuCategory={props.visibleMenuCategory}
                      menuSearchText={props.menuSearchText}
                      normalizedMenuSearch={props.normalizedMenuSearch}
                      displayedMenuCategory={props.displayedMenuCategory}
                      displayedMenuItems={props.displayedMenuItems}
                      minSearchLength={props.minSearchLength}
                      onMenuSearchTextChange={props.onMenuSearchTextChange}
                      onSelectMenuCategory={props.onSelectMenuCategory}
                      onAddMenuItem={handleAddMenuItem}
                      formatPrice={props.formatPrice}
                    />
                  </ScrollView>
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.mobilePagerPage, pageWidth > 0 ? { width: pageWidth } : null]}>
            <View style={styles.mobileSinglePanel}>
              <MobileOrderSummary orderProps={props.orderSectionProps} />
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

export function DesktopPosScreen(props: PosScreenProps): React.JSX.Element {
  return (
    <View style={styles.desktopWorkspace}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        style={styles.columnsScroll}
        contentContainerStyle={styles.columnsContent}
      >
        <View style={styles.columns}>
          <View style={[styles.column, styles.tablesColumn]}>
            <Text style={styles.sectionTitle}>Mesas</Text>
            <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
              <TableSelector
                tables={props.tables}
                tableTotals={props.tableTotals}
                selectedTable={props.selectedTable}
                onSelectTable={props.onSelectTable}
                onAddTable={props.onAddTable}
                onRemoveTable={props.onRemoveTable}
                formatPrice={props.formatPrice}
              />
            </ScrollView>
          </View>

          <View style={[styles.column, styles.menuColumn]}>
            <Text style={styles.sectionTitle}>Carta</Text>
            <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
              <MenuSelector
                layout="desktop"
                menuCategories={props.menuCategories}
                visibleMenuCategory={props.visibleMenuCategory}
                menuSearchText={props.menuSearchText}
                normalizedMenuSearch={props.normalizedMenuSearch}
                displayedMenuCategory={props.displayedMenuCategory}
                displayedMenuItems={props.displayedMenuItems}
                minSearchLength={props.minSearchLength}
                onMenuSearchTextChange={props.onMenuSearchTextChange}
                onSelectMenuCategory={props.onSelectMenuCategory}
                onAddMenuItem={props.onAddMenuItem}
                formatPrice={props.formatPrice}
              />
            </ScrollView>
          </View>

          <View style={[styles.column, styles.ticketColumn]}>
            <OrderSection {...props.orderSectionProps} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
