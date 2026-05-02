import React, { ComponentProps, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { styles } from '../../app/App.styles';
import { MenuItem, TABLE_ZONES, TableId, TableZone, tableZoneLabel } from '../../types';
import { MenuCategoryGroup, translateCategory } from '../MenuZoneGroup/MenuCategoryGroup';
import { OrderSection } from '../OrderZone/OrderSection';
import { TableZoneGroup } from '../TableZoneGroup/TableZoneGroup';

type MenuLayout = 'desktop' | 'mobile';
type MobileTopMode = 'tables' | 'menu';

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
        <OrderSection {...props.orderSectionProps} />
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

        <View style={styles.column}>
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

        <View style={styles.column}>
          <OrderSection {...props.orderSectionProps} />
        </View>
      </View>
    </ScrollView>
  );
}
