import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useTicketingController } from './src/native/controllers';
import { TableZoneGroup, MenuCategoryGroup } from './src/native/components';
import { translateCategory } from './src/native/components/MenuZoneGroup/MenuCategoryGroup';
import { OrderSection } from './src/native/components/OrderZone/OrderSection';
import { MenuItem, PaidTicket, TABLE_ZONES, TableZone } from './src/native/types';
import { apiService } from './src/native/services';
import {
  centsToCurrency,
  getMenuTitleById
} from './src/native/app/app.helpers';
import { styles } from './src/native/app/App.styles';

const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_RESULTS = 24;
type AppSection = 'home' | 'pos' | 'history' | 'products';

function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function getSearchRank(item: MenuItem, category: string, query: string): number | null {
  const name = normalizeSearchText(item.name);
  const sku = normalizeSearchText(item.sku);
  const description = normalizeSearchText(item.description);
  const categoryText = normalizeSearchText(category);
  const translatedCategory = normalizeSearchText(translateCategory(category));

  if (sku && sku === query) return 0;
  if (name === query) return 1;
  if (name.startsWith(query)) return 2;
  if (name.split(/\s+/).some((word) => word.startsWith(query))) return 3;
  if (sku && sku.includes(query)) return 4;
  if (name.includes(query)) return 5;
  if (description.includes(query)) return 6;
  if (categoryText.startsWith(query) || translatedCategory.startsWith(query)) return 7;

  return null;
}

function parsePriceToCents(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function buildPaidTicketHtml(ticket: PaidTicket): string {
  const rows = ticket.items.map((item) => `
    <tr>
      <td>${item.qty}</td>
      <td>${item.name}</td>
      <td>${centsToCurrency(item.unitPriceCents)}</td>
      <td>${centsToCurrency(item.totalPriceCents)}</td>
    </tr>`).join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${ticket.ticketNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
    .ticket { max-width: 420px; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    .meta { font-size: 12px; color: #475569; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px solid #E2E8F0; padding: 6px 4px; text-align: left; }
    td:last-child, th:last-child { text-align: right; }
    .totals { margin-top: 12px; font-size: 13px; }
    .totals div { display: flex; justify-content: space-between; padding: 3px 0; }
    .total { font-weight: 700; font-size: 15px; border-top: 1px solid #111827; padding-top: 8px; }
  </style>
</head>
<body>
  <section class="ticket">
    <h1>Factura simplificada ${ticket.ticketNumber}</h1>
    <div class="meta">Mesa ${ticket.tableZone}-${ticket.tableNumber} · ${formatDateTime(ticket.createdAt)} · ${ticket.method === 'cash' ? 'Efectivo' : 'Tarjeta'}</div>
    <table>
      <thead><tr><th>Ud.</th><th>Producto</th><th>Precio</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span>Base imponible</span><span>${centsToCurrency(ticket.taxableBaseCents)}</span></div>
      <div><span>IVA ${ticket.vatRatePercent}%</span><span>${centsToCurrency(ticket.vatCents)}</span></div>
      <div class="total"><span>Total</span><span>${centsToCurrency(ticket.totalCents)}</span></div>
    </div>
  </section>
</body>
</html>`;
}

export default function App(): React.JSX.Element {
  const { state, actions } = useTicketingController();
  const [activeSection, setActiveSection] = useState<AppSection>('home');
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string | null>(null);
  const [menuSearchText, setMenuSearchText] = useState('');
  const [paidTickets, setPaidTickets] = useState<PaidTicket[]>([]);
  const [ticketSearchText, setTicketSearchText] = useState('');
  const [managedMenuItems, setManagedMenuItems] = useState<MenuItem[]>([]);
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productSku, setProductSku] = useState('');
  const [productDescription, setProductDescription] = useState('');
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
  const menuCategories = useMemo(() => Array.from(menuByCategory.keys()), [menuByCategory]);
  const visibleMenuCategory = selectedMenuCategory && menuByCategory.has(selectedMenuCategory)
    ? selectedMenuCategory
    : (menuCategories[0] ?? null);
  const visibleMenuItems = visibleMenuCategory ? (menuByCategory.get(visibleMenuCategory) ?? []) : [];
  const normalizedMenuSearch = normalizeSearchText(menuSearchText);
  const searchedMenuItems = useMemo(() => {
    if (normalizedMenuSearch.length < MIN_SEARCH_LENGTH) {
      return [];
    }

    const matches: Array<{ item: MenuItem; rank: number }> = [];
    for (const [category, items] of menuByCategory.entries()) {
      for (const item of items) {
        const rank = getSearchRank(item, category, normalizedMenuSearch);
        if (rank !== null) {
          matches.push({ item, rank });
        }
      }
    }

    return matches
      .sort((left, right) => left.rank - right.rank || left.item.name.localeCompare(right.item.name))
      .slice(0, MAX_SEARCH_RESULTS)
      .map((match) => match.item);
  }, [menuByCategory, normalizedMenuSearch]);
  const isSearching = normalizedMenuSearch.length >= MIN_SEARCH_LENGTH;
  const displayedMenuCategory = isSearching ? 'Resultados' : visibleMenuCategory;
  const displayedMenuItems = isSearching ? searchedMenuItems : visibleMenuItems;
  const filteredPaidTickets = useMemo(() => {
    const query = normalizeSearchText(ticketSearchText);
    if (!query) return paidTickets;
    return paidTickets.filter((ticket) => {
      const searchableText = normalizeSearchText([
        ticket.ticketNumber,
        ticket.tableZone,
        String(ticket.tableNumber),
        ticket.method,
        ...ticket.items.map((item) => item.name),
      ].join(' '));
      return searchableText.includes(query);
    });
  }, [paidTickets, ticketSearchText]);
  const managedCategories = useMemo(
    () => Array.from(new Set(managedMenuItems.map((item) => item.category))).sort((a, b) => a.localeCompare(b)),
    [managedMenuItems]
  );

  useEffect(() => {
    if (!visibleMenuCategory) {
      setSelectedMenuCategory(null);
      return;
    }
    if (selectedMenuCategory !== visibleMenuCategory) {
      setSelectedMenuCategory(visibleMenuCategory);
    }
  }, [selectedMenuCategory, visibleMenuCategory]);

  async function loadTicketHistory(): Promise<void> {
    try {
      setPaidTickets(await apiService.fetchPaidTickets());
    } catch {
      Alert.alert('Error', 'No se pudo cargar el historial de tickets.');
    }
  }

  async function loadManagedProducts(): Promise<void> {
    try {
      setManagedMenuItems(await apiService.fetchManageMenu());
    } catch {
      Alert.alert('Error', 'No se pudo cargar la gestión de productos.');
    }
  }

  async function saveNewProduct(): Promise<void> {
    const priceCents = parsePriceToCents(productPrice);
    const name = productName.trim();
    const category = productCategory.trim();

    if (!name || !category || priceCents === null) {
      Alert.alert('Producto no válido', 'Introduce nombre, tipo y precio válido.');
      return;
    }

    try {
      await apiService.createMenuItem({
        name,
        category,
        priceCents,
        sku: productSku.trim() || null,
        description: productDescription.trim() || null,
        available: true,
      });
      setProductName('');
      setProductCategory('');
      setProductPrice('');
      setProductSku('');
      setProductDescription('');
      await loadManagedProducts();
      await actions.reloadMenu();
    } catch {
      Alert.alert('Error', 'No se pudo crear el producto.');
    }
  }

  async function updateProductPrice(item: MenuItem, value: string): Promise<void> {
    const priceCents = parsePriceToCents(value);
    if (priceCents === null) {
      Alert.alert('Precio no válido', 'Introduce un precio válido.');
      return;
    }

    try {
      await apiService.updateMenuItem(item.id, { priceCents });
      await loadManagedProducts();
      await actions.reloadMenu();
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el precio.');
    }
  }

  async function updateProductCategory(item: MenuItem, category: string): Promise<void> {
    const nextCategory = category.trim();
    if (!nextCategory) {
      Alert.alert('Tipo no válido', 'Introduce un tipo de producto.');
      return;
    }

    try {
      await apiService.updateMenuItem(item.id, { category: nextCategory });
      await loadManagedProducts();
      await actions.reloadMenu();
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el tipo.');
    }
  }

  function downloadTicket(ticket: PaidTicket): void {
    const html = buildPaidTicketHtml(ticket);
    if (Platform.OS !== 'web') {
      Alert.alert('Descarga no disponible', 'La descarga directa está disponible en la versión web.');
      return;
    }

    const documentRef = (globalThis as typeof globalThis & { document?: Document }).document;
    const urlApi = (globalThis as typeof globalThis & { URL?: typeof URL }).URL;
    const blobApi = (globalThis as typeof globalThis & { Blob?: typeof Blob }).Blob;
    if (!documentRef || !urlApi || !blobApi) {
      Alert.alert('Error', 'No se pudo preparar la descarga.');
      return;
    }

    const blob = new blobApi([html], { type: 'text/html;charset=utf-8' });
    const url = urlApi.createObjectURL(blob);
    const link = documentRef.createElement('a');
    link.href = url;
    link.download = `${ticket.ticketNumber}.html`;
    link.click();
    urlApi.revokeObjectURL(url);
  }

  useEffect(() => {
    if (activeSection === 'history') {
      void loadTicketHistory();
    }
    if (activeSection === 'products') {
      void loadManagedProducts();
    }
  }, [activeSection]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.title}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.header}>TPV Restaurante</Text>
        {activeSection !== 'home' ? (
          <TouchableOpacity style={styles.headerButton} onPress={() => setActiveSection('home')}>
            <Text style={styles.secondaryButtonText}>Inicio</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {activeSection === 'home' ? (
        <View style={styles.homeGrid}>
          <TouchableOpacity style={styles.homeButton} onPress={() => setActiveSection('pos')}>
            <Text style={styles.homeButtonTitle}>TPV</Text>
            <Text style={styles.homeButtonText}>Mesas, menú, pedidos, tickets y pagos.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeButton} onPress={() => setActiveSection('history')}>
            <Text style={styles.homeButtonTitle}>Historial de tickets</Text>
            <Text style={styles.homeButtonText}>Buscar tickets pagados y descargar copias.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeButton} onPress={() => setActiveSection('products')}>
            <Text style={styles.homeButtonTitle}>Productos</Text>
            <Text style={styles.homeButtonText}>Añadir productos, tipos y cambiar precios.</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {activeSection === 'history' ? (
        <View style={styles.fullPanel}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.sectionTitle}>Historial de tickets</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void loadTicketHistory()}>
              <Text style={styles.secondaryButtonText}>Actualizar</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.menuSearchInput}
            value={ticketSearchText}
            onChangeText={setTicketSearchText}
            placeholder="Buscar por número, mesa, pago o producto"
            placeholderTextColor="#6B7280"
          />
          <ScrollView style={styles.columnScroll}>
            {filteredPaidTickets.map((ticket) => (
              <View key={ticket.id} style={styles.historyRow}>
                <View style={styles.flex1}>
                  <Text style={styles.itemName}>{ticket.ticketNumber}</Text>
                  <Text style={styles.itemPrice}>
                    {`Mesa ${ticket.tableZone}-${ticket.tableNumber} · ${formatDateTime(ticket.createdAt)} · ${ticket.method === 'cash' ? 'Efectivo' : 'Tarjeta'}`}
                  </Text>
                  <Text style={styles.itemPrice}>{ticket.items.map((item) => `${item.qty}x ${item.name}`).join(', ')}</Text>
                </View>
                <Text style={styles.totalText}>{centsToCurrency(ticket.totalCents)}</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => downloadTicket(ticket)}>
                  <Text style={styles.secondaryButtonText}>Descargar</Text>
                </TouchableOpacity>
              </View>
            ))}
            {filteredPaidTickets.length === 0 ? <Text style={styles.emptyText}>No hay tickets.</Text> : null}
          </ScrollView>
        </View>
      ) : null}

      {activeSection === 'products' ? (
        <View style={styles.fullPanel}>
          <Text style={styles.sectionTitle}>Productos</Text>
          <View style={styles.productForm}>
            <TextInput style={styles.formInput} value={productName} onChangeText={setProductName} placeholder="Nombre" placeholderTextColor="#6B7280" />
            <TextInput style={styles.formInput} value={productCategory} onChangeText={setProductCategory} placeholder="Tipo / categoría" placeholderTextColor="#6B7280" />
            <TextInput style={styles.formInput} value={productPrice} onChangeText={setProductPrice} placeholder="Precio" placeholderTextColor="#6B7280" keyboardType="decimal-pad" />
            <TextInput style={styles.formInput} value={productSku} onChangeText={setProductSku} placeholder="SKU opcional" placeholderTextColor="#6B7280" />
            <TextInput style={[styles.formInput, styles.formInputWide]} value={productDescription} onChangeText={setProductDescription} placeholder="Descripción opcional" placeholderTextColor="#6B7280" />
            <TouchableOpacity style={styles.primaryButton} onPress={() => void saveNewProduct()}>
              <Text style={styles.primaryButtonText}>Añadir producto</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.menuTypeSelector}>
            {managedCategories.map((category) => (
              <TouchableOpacity key={category} style={styles.menuTypeButton} onPress={() => setProductCategory(category)}>
                <Text style={styles.menuTypeButtonText}>{category}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView style={styles.columnScroll}>
            {managedMenuItems.map((item) => (
              <View key={item.id} style={styles.productRow}>
                <View style={styles.flex1}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <TextInput
                    style={styles.formInput}
                    defaultValue={item.category}
                    onSubmitEditing={(event) => void updateProductCategory(item, event.nativeEvent.text)}
                    onEndEditing={(event) => void updateProductCategory(item, event.nativeEvent.text)}
                    placeholder="Tipo"
                    placeholderTextColor="#6B7280"
                  />
                </View>
                <TextInput
                  style={styles.priceInput}
                  defaultValue={(item.priceCents / 100).toFixed(2)}
                  keyboardType="decimal-pad"
                  onSubmitEditing={(event) => void updateProductPrice(item, event.nativeEvent.text)}
                  onEndEditing={(event) => void updateProductPrice(item, event.nativeEvent.text)}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {activeSection === 'pos' ? (
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
              {TABLE_ZONES.map((zone: TableZone) => {
                const numbers = tables.get(zone) ?? [];
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
                    onRemoveTable={(table) => {
                      void actions.removeTable(table);
                    }}
                  />
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Menú</Text>
            <TextInput
              style={styles.menuSearchInput}
              value={menuSearchText}
              onChangeText={setMenuSearchText}
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
                    onPress={() => setSelectedMenuCategory(category)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.menuTypeButtonText, isSelected && styles.menuTypeButtonTextSelected]}>
                      {translateCategory(category)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
              {normalizedMenuSearch.length > 0 && normalizedMenuSearch.length < MIN_SEARCH_LENGTH ? (
                <Text style={styles.emptyText}>Escribe al menos 2 letras para buscar.</Text>
              ) : displayedMenuCategory ? (
                <MenuCategoryGroup
                  category={displayedMenuCategory}
                  items={displayedMenuItems}
                  onSelectItem={(menuId) => {
                    void actions.addMenuItem(menuId);
                  }}
                  formatPrice={centsToCurrency}
                />
              ) : (
                <Text style={styles.emptyText}>No hay productos disponibles.</Text>
              )}
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
              onPrintTicket={(options) => {
                void actions.printTicket(options);
              }}
              onPayTicket={(method, splitPeople) => {
                void actions.payTable(method, splitPeople);
              }}
              onPaySelectedItems={(method, items) => {
                void actions.paySelectedItems(method, items);
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
      ) : null}
    </SafeAreaView>
  );
}
