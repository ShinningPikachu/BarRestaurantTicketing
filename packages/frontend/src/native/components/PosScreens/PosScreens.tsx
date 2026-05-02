import React, { ComponentProps, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from '../../app/App.styles';
import { MenuItem, Order, OrderItem, PreOrderItem, TABLE_ZONES, TableId, TableZone, tableZoneLabel } from '../../types';
import { MenuCategoryGroup, translateCategory } from '../MenuZoneGroup/MenuCategoryGroup';
import { OrderSection } from '../OrderZone/OrderSection';
import { TableZoneGroup } from '../TableZoneGroup/TableZoneGroup';

type MenuLayout = 'desktop' | 'mobile';
type MobileTopMode = 'tables' | 'menu';

interface ConfirmedItemRow {
  key: string;
  orderId: string;
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
  formatPrice: (cents: number) => string;
}

interface TableSelectorProps {
  tables: Map<TableZone, number[]>;
  selectedTable: TableId;
  onSelectTable: (table: TableId) => void;
  onAddTable: (zone: TableZone) => void;
  onRemoveTable: (table: TableId) => void;
}

function TableSelector({ tables, selectedTable, onSelectTable, onAddTable, onRemoveTable }: TableSelectorProps): React.JSX.Element {
  return (
    <>
      {TABLE_ZONES.map((zone: TableZone) => (
        <TableZoneGroup
          key={zone}
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
    <View style={styles.mobileOrderItem}>
      <View style={styles.flex1}>
        <Text style={styles.itemName} numberOfLines={2}>{title}</Text>
        <Text style={styles.itemPrice}>{orderProps.formatPrice(item.unitPriceCents * item.qty)}</Text>
      </View>
      <View style={styles.qtyGroup}>
        <TouchableOpacity style={styles.qtyButton} onPress={() => orderProps.onRemovePendingItem(item.id)}>
          <Text style={styles.qtyButtonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.qty}</Text>
        <TouchableOpacity style={styles.qtyButton} onPress={() => orderProps.onAddPendingItem(item.id)}>
          <Text style={styles.qtyButtonText}>+</Text>
        </TouchableOpacity>
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
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.itemPrice}>
          {orderProps.formatPrice((item.unitPriceCents ?? 0) * item.qty)}
        </Text>
      </View>
      <Text style={styles.confirmedQtyText}>{`x${item.qty}`}</Text>
      <TouchableOpacity
        style={styles.compactSecondaryButton}
        onPress={() => orderProps.onMoveConfirmedItemToPreOrder(orderId, item)}
      >
        <Text style={styles.secondaryButtonText}>Editar</Text>
      </TouchableOpacity>
    </View>
  );
}

function MobileOrderSummary({ orderProps }: { orderProps: PosScreenProps['orderSectionProps'] }): React.JSX.Element {
  const confirmedItems = getConfirmedItems(orderProps.tableOrders);
  const hasPreorder = orderProps.preorderItems.length > 0;
  const hasConfirmed = confirmedItems.length > 0;

  return (
    <View style={styles.mobileOrderSection}>
      <View style={styles.mobileOrderHeader}>
        <View>
          <Text style={styles.sectionTitle}>
            {`Mesa ${tableZoneLabel(orderProps.selectedTable.zone)}-${orderProps.selectedTable.number}`}
          </Text>
          <Text style={styles.itemPrice}>
            {`${orderProps.preorderItems.length} prepedido · ${confirmedItems.length} cocina`}
          </Text>
        </View>
        <Text style={styles.totalText}>{orderProps.formatPrice(orderProps.preorderTotal)}</Text>
      </View>

      <ScrollView style={styles.mobileOrderScroll} showsVerticalScrollIndicator>
        <View style={styles.mobileOrderBlock}>
          <View style={styles.mobileOrderBlockHeader}>
            <Text style={styles.subTitle}>Prepedido</Text>
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
            style={[styles.primaryButton, !hasPreorder && styles.mobileDisabledButton]}
            onPress={orderProps.onConfirmOrder}
            disabled={!hasPreorder}
          >
            <Text style={styles.primaryButtonText}>Enviar a cocina</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, !hasPreorder && styles.mobileDisabledButton]}
            onPress={orderProps.onClearPreOrder}
            disabled={!hasPreorder}
          >
            <Text style={styles.secondaryButtonText}>Limpiar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mobileOrderBlock}>
          <View style={styles.mobileOrderBlockHeader}>
            <Text style={styles.subTitle}>En cocina / confirmados</Text>
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

      <View style={styles.mobilePayBar}>
        <TouchableOpacity
          style={[styles.compactPrimaryButton, !hasConfirmed && styles.mobileDisabledButton]}
          onPress={() => orderProps.onPrintTicket()}
          disabled={!hasConfirmed}
        >
          <Text style={styles.primaryButtonText}>Ticket</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.compactSecondaryButton, !hasConfirmed && styles.mobileDisabledButton]}
          onPress={() => orderProps.onPayTicket('cash')}
          disabled={!hasConfirmed}
        >
          <Text style={styles.secondaryButtonText}>Efectivo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.compactSecondaryButton, !hasConfirmed && styles.mobileDisabledButton]}
          onPress={() => orderProps.onPayTicket('card')}
          disabled={!hasConfirmed}
        >
          <Text style={styles.secondaryButtonText}>Tarjeta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function MobilePosScreen(props: PosScreenProps): React.JSX.Element {
  const [topMode, setTopMode] = useState<MobileTopMode>('tables');

  function handleSelectTable(table: TableId): void {
    props.onSelectTable(table);
    setTopMode('menu');
  }

  return (
    <View style={styles.mobilePosScreen}>
      <View style={styles.mobileTopPanel}>
        <View style={styles.mobileTopHeader}>
          <Text style={styles.sectionTitle}>TPV móvil</Text>
          <View style={styles.mobileModeSwitch}>
            <TouchableOpacity
              style={[styles.mobileModeButton, topMode === 'tables' && styles.mobileModeButtonSelected]}
              onPress={() => setTopMode('tables')}
            >
              <Text style={[styles.mobileModeButtonText, topMode === 'tables' && styles.mobileModeButtonTextSelected]}>
                Mesas
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mobileModeButton, topMode === 'menu' && styles.mobileModeButtonSelected]}
              onPress={() => setTopMode('menu')}
            >
              <Text style={[styles.mobileModeButtonText, topMode === 'menu' && styles.mobileModeButtonTextSelected]}>
                Menú
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.mobileContextRow}>
          <Text style={styles.mobileContextText}>
            {`Mesa ${tableZoneLabel(props.selectedTable.zone)}-${props.selectedTable.number}`}
          </Text>
          <Text style={styles.mobileContextText}>
            {topMode === 'tables' ? 'Selección de mesa' : 'Añadir productos'}
          </Text>
        </View>
        <ScrollView style={styles.mobileTopScroll} showsVerticalScrollIndicator={false}>
          {topMode === 'tables' ? (
            <TableSelector
              tables={props.tables}
              selectedTable={props.selectedTable}
              onSelectTable={handleSelectTable}
              onAddTable={props.onAddTable}
              onRemoveTable={props.onRemoveTable}
            />
          ) : (
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
              onAddMenuItem={props.onAddMenuItem}
              formatPrice={props.formatPrice}
            />
          )}
        </ScrollView>
      </View>

      <View style={styles.mobileTicketPanel}>
        <MobileOrderSummary orderProps={props.orderSectionProps} />
        <TouchableOpacity style={styles.mobileDrawerButton} onPress={props.onOpenCashDrawer}>
          <Text style={styles.secondaryButtonText}>Abrir caja</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function DesktopPosScreen(props: PosScreenProps): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
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
          <Text style={styles.sectionTitle}>Menú</Text>
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
          <View style={styles.drawerActionRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={props.onOpenCashDrawer}>
              <Text style={styles.secondaryButtonText}>Abrir caja</Text>
            </TouchableOpacity>
          </View>
          <OrderSection {...props.orderSectionProps} />
        </View>
      </View>
    </ScrollView>
  );
}
