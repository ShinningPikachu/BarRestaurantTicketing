import React, { ComponentProps, useEffect, useState } from 'react';
import { Alert, BackHandler, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from '../../app/App.styles';
import { MenuItem, Order, OrderItem, PaymentMethod, PreOrderItem, TABLE_ZONES, TableId, TableZone, tableZoneLabel } from '../../types';
import { MenuCategoryGroup, translateCategory } from '../MenuZoneGroup/MenuCategoryGroup';
import { OrderSection } from '../OrderZone/OrderSection';
import { TableZoneGroup } from '../TableZoneGroup/TableZoneGroup';

type MenuLayout = 'desktop' | 'mobile';
type MobileTpvView = 'tables' | 'menu' | 'ticket';

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
  onOpenCashDrawer: () => void;
  onExit?: () => void;
  formatPrice: (cents: number) => string;
}

interface TableSelectorProps {
  layout?: MenuLayout;
  tables: Map<TableZone, number[]>;
  selectedTable: TableId;
  onSelectTable: (table: TableId) => void;
  onAddTable: (zone: TableZone) => void;
  onRemoveTable: (table: TableId) => void;
}

function TableSelector({ layout = 'desktop', tables, selectedTable, onSelectTable, onAddTable, onRemoveTable }: TableSelectorProps): React.JSX.Element {
  return (
    <>
      {TABLE_ZONES.map((zone: TableZone) => (
        <TableZoneGroup
          key={zone}
          layout={layout}
          zone={zone}
          numbers={tables.get(zone) ?? []}
          selectedTable={selectedTable}
          onSelectTable={onSelectTable}
          onAddTable={onAddTable}
          onRemoveTable={onRemoveTable}
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

function MobilePreorderItem({
  item,
  orderProps,
}: {
  item: PreOrderItem;
  orderProps: PosScreenProps['orderSectionProps'];
}): React.JSX.Element {
  const title = item.menuItemId
    ? orderProps.getMenuTitleById(orderProps.menuByCategory, item.menuItemId)
    : item.name;

  return (
    <View style={[styles.mobileOrderItem, styles.mobileEditableOrderItem]}>
      <View style={styles.mobilePreorderMainRow}>
        <View style={styles.flex1}>
          <Text style={styles.mobileOrderItemName} numberOfLines={2}>{title}</Text>
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

function MobileConfirmedItem({
  item,
  orderId,
  orderProps,
}: {
  item: OrderItem;
  orderId: string;
  orderProps: PosScreenProps['orderSectionProps'];
}): React.JSX.Element {
  return (
    <View style={styles.mobileOrderItem}>
      <View style={styles.flex1}>
        <Text style={styles.mobileOrderItemName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.mobileOrderItemPrice}>
          {orderProps.formatPrice((item.unitPriceCents ?? 0) * item.qty)}
        </Text>
      </View>
      <Text style={styles.mobileConfirmedQtyText}>{`x${item.qty}`}</Text>
      <TouchableOpacity
        style={styles.compactSecondaryButton}
        onPress={() => orderProps.onMoveConfirmedItemToPreOrder(orderId, item)}
      >
        <Text style={styles.compactButtonText}>Editar</Text>
      </TouchableOpacity>
    </View>
  );
}

function MobileOrderSummary({ orderProps }: { orderProps: PosScreenProps['orderSectionProps'] }): React.JSX.Element {
  const [aaQtyByKey, setAaQtyByKey] = useState<Record<string, number>>({});
  const [isAaModalVisible, setIsAaModalVisible] = useState(false);
  const [splitPeopleText, setSplitPeopleText] = useState('2');
  const confirmedItems = getConfirmedItems(orderProps.tableOrders);
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
        <Text style={styles.mobileOrderTotal}>{orderProps.formatPrice(orderProps.preorderTotal)}</Text>
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
            style={[styles.compactPrimaryButton, styles.flex1, !hasPreorder && styles.mobileDisabledButton]}
            onPress={orderProps.onConfirmOrder}
            disabled={!hasPreorder}
          >
            <Text style={styles.compactPrimaryButtonText}>Enviar a cocina</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.compactSecondaryButton, styles.flex1, !hasPreorder && styles.mobileDisabledButton]}
            onPress={orderProps.onClearPreOrder}
            disabled={!hasPreorder}
          >
            <Text style={styles.compactButtonText}>Limpiar</Text>
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

      <View style={styles.mobileTicketControls}>
        <View style={styles.mobileTicketActionsRow}>
          <TouchableOpacity
            style={[styles.compactPrimaryButton, styles.flex1, !hasConfirmed && styles.mobileDisabledButton]}
            onPress={() => orderProps.onPrintTicket()}
            disabled={!hasConfirmed}
          >
            <Text style={styles.compactPrimaryButtonText}>Imprimir</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.compactSecondaryButton, styles.flex1, !hasConfirmed && styles.mobileDisabledButton]}
            onPress={() => setIsAaModalVisible(true)}
            disabled={!hasConfirmed}
          >
            <Text style={styles.compactButtonText}>AA</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.mobileSplitRow}>
          <Text style={styles.mobileSplitLabel}>Comensales</Text>
          <TextInput
            style={[styles.smallNumberInput, styles.mobileSplitInput]}
            keyboardType="number-pad"
            value={splitPeopleText}
            onChangeText={setSplitPeopleText}
            placeholder="2"
          />
          <TouchableOpacity
            style={[styles.compactSecondaryButton, styles.flex1, !hasConfirmed && styles.mobileDisabledButton]}
            onPress={handlePrintDividedTicket}
            disabled={!hasConfirmed}
          >
            <Text style={styles.compactButtonText}>Imprimir dividido</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mobilePayBar}>
        <TouchableOpacity
          style={[styles.compactPrimaryButton, styles.flex1, !hasConfirmed && styles.mobileDisabledButton]}
          onPress={() => orderProps.onPayTicket('cash')}
          disabled={!hasConfirmed}
        >
          <Text style={styles.compactPrimaryButtonText}>Pagar efectivo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.compactSecondaryButton, styles.flex1, !hasConfirmed && styles.mobileDisabledButton]}
          onPress={() => orderProps.onPayTicket('card')}
          disabled={!hasConfirmed}
        >
          <Text style={styles.compactButtonText}>Pagar tarjeta</Text>
        </TouchableOpacity>
      </View>

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
              <TouchableOpacity style={styles.compactSecondaryButton} onPress={() => setIsAaModalVisible(false)}>
                <Text style={styles.compactButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.mobileAaList}>
              {confirmedItems.map((confirmedItem) => (
                <View key={`mobile-aa-${confirmedItem.key}`} style={styles.mobileAaSelectionRow}>
                  <View style={styles.flex1}>
                    <Text style={styles.mobileOrderItemName} numberOfLines={2}>{confirmedItem.item.name}</Text>
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
              ))}
              {confirmedItems.length === 0 ? <Text style={styles.emptyText}>No hay pedidos confirmados.</Text> : null}
            </ScrollView>

            <View style={styles.mobileAaFooter}>
              <TouchableOpacity style={styles.compactSecondaryButton} onPress={() => setAaQtyByKey({})}>
                <Text style={styles.compactButtonText}>Limpiar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.compactPrimaryButton} onPress={handlePrintAaTicket}>
                <Text style={styles.compactPrimaryButtonText}>{`Imprimir AA (${selectedAaItemCount})`}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.compactSecondaryButton} onPress={() => handlePayAa('cash')}>
                <Text style={styles.compactButtonText}>Pagar efectivo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.compactSecondaryButton} onPress={() => handlePayAa('card')}>
                <Text style={styles.compactButtonText}>Pagar tarjeta</Text>
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
  const selectedItemCount = props.orderSectionProps.preorderItems.reduce((total, item) => total + item.qty, 0);

  function handleBack(): void {
    if (activeView === 'ticket') {
      setActiveView('menu');
      return;
    }
    if (activeView === 'menu') {
      setActiveView('tables');
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
    setActiveView('menu');
  }

  function handleAddMenuItem(menuId: number): void {
    props.onAddMenuItem(menuId);
  }

  return (
    <View style={styles.mobilePosScreen}>
      <View style={styles.mobileViewSwitch}>
        {([
          ['tables', 'Mesa'],
          ['menu', 'Carta'],
          ['ticket', selectedItemCount > 0 ? `Cuenta (${selectedItemCount})` : 'Cuenta'],
        ] as Array<[MobileTpvView, string]>).map(([view, label]) => (
          <TouchableOpacity
            key={view}
            style={[styles.mobileViewButton, activeView === view && styles.mobileViewButtonSelected]}
            onPress={() => setActiveView(view)}
          >
            <Text style={[styles.mobileViewButtonText, activeView === view && styles.mobileViewButtonTextSelected]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.mobileContextRow}>
        <Text style={styles.mobileContextText}>
          {`Mesa ${tableZoneLabel(props.selectedTable.zone)}-${props.selectedTable.number}`}
        </Text>
        <Text style={styles.mobileContextText}>
          {activeView === 'tables'
            ? 'Selecciona una mesa'
            : activeView === 'menu'
              ? `${selectedItemCount} por enviar`
              : 'Revisar y cobrar'}
        </Text>
      </View>

      {activeView === 'tables' ? (
        <View style={styles.mobileSinglePanel}>
          <View style={styles.mobilePanelHeader}>
            <TouchableOpacity style={styles.mobileBackButton} onPress={handleBack}>
              <Text style={styles.compactButtonText}>Atras: inicio</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mobilePanelAction}
              onPress={() => props.onAddTable(props.selectedTable.zone)}
            >
              <Text style={styles.compactButtonText}>+ Mesa aquí</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.mobilePanelScroll} showsVerticalScrollIndicator={false}>
            <TableSelector
              layout="mobile"
              tables={props.tables}
              selectedTable={props.selectedTable}
              onSelectTable={handleSelectTable}
              onAddTable={props.onAddTable}
              onRemoveTable={props.onRemoveTable}
            />
          </ScrollView>
        </View>
      ) : null}

      {activeView === 'menu' ? (
        <View style={styles.mobileSinglePanel}>
          <View style={styles.mobilePanelHeader}>
            <TouchableOpacity style={styles.mobileBackButton} onPress={handleBack}>
              <Text style={styles.compactButtonText}>Atras: mesas</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mobilePanelAction} onPress={() => setActiveView('ticket')}>
              <Text style={styles.compactButtonText}>{`Ver cuenta (${selectedItemCount})`}</Text>
            </TouchableOpacity>
          </View>
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
      ) : null}

      {activeView === 'ticket' ? (
        <View style={styles.mobileSinglePanel}>
          <View style={styles.mobilePanelHeader}>
            <TouchableOpacity style={styles.mobileBackButton} onPress={handleBack}>
              <Text style={styles.compactButtonText}>Atras: carta</Text>
            </TouchableOpacity>
            <View style={styles.mobilePanelActions}>
              <TouchableOpacity style={styles.mobilePanelAction} onPress={() => setActiveView('menu')}>
                <Text style={styles.compactButtonText}>+ Productos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mobilePanelAction} onPress={props.onOpenCashDrawer}>
                <Text style={styles.compactButtonText}>Caja</Text>
              </TouchableOpacity>
            </View>
          </View>
          <MobileOrderSummary orderProps={props.orderSectionProps} />
        </View>
      ) : null}
    </View>
  );
}

export function DesktopPosScreen(props: PosScreenProps): React.JSX.Element {
  return (
    <View style={styles.desktopWorkspace}>
      <View style={styles.desktopContextBar}>
        <View style={styles.flex1}>
          <Text style={styles.desktopContextTitle}>
            {`Mesa ${tableZoneLabel(props.selectedTable.zone)}-${props.selectedTable.number}`}
          </Text>
          <Text style={styles.desktopContextText}>Selecciona productos, confirma el pedido y cobra desde la cuenta.</Text>
        </View>
        <TouchableOpacity style={styles.secondaryButton} onPress={props.onOpenCashDrawer}>
          <Text style={styles.secondaryButtonText}>Abrir caja</Text>
        </TouchableOpacity>
      </View>
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
                selectedTable={props.selectedTable}
                onSelectTable={props.onSelectTable}
                onAddTable={props.onAddTable}
                onRemoveTable={props.onRemoveTable}
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
