import React, { useEffect, useMemo, useState } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import {
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { useTicketingController } from './src/native/controllers';
import { DesktopPosScreen, MobilePosScreen } from './src/native/components';
import { translateCategory } from './src/native/components/MenuZoneGroup/MenuCategoryGroup';
import { MenuItem, PaidTicket, SessionSummary } from './src/native/types';
import { apiService } from './src/native/services';
import {
  centsToCurrency,
  getMenuTitleById
} from './src/native/app/app.helpers';
import { styles } from './src/native/app/App.styles';

const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_RESULTS = 24;
const PRODUCT_IMAGE_MAX_SIZE = 512;
const PRODUCT_IMAGE_QUALITY = 0.82;
type AppSection = 'home' | 'pos' | 'history' | 'products';

interface ExpoLikeGlobal {
  process?: {
    env?: {
      EXPO_PUBLIC_TPV_SCREEN?: string;
    };
  };
}

function resizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      const source = String(reader.result ?? '');
      const image = new window.Image();
      image.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
      image.onload = () => {
        const scale = Math.min(1, PRODUCT_IMAGE_MAX_SIZE / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('No se pudo preparar la imagen.'));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', PRODUCT_IMAGE_QUALITY));
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}

async function resizeNativeImage(uri: string, width?: number, height?: number): Promise<string> {
  const largestSide = Math.max(width ?? 0, height ?? 0);
  const resizeAction = largestSide > PRODUCT_IMAGE_MAX_SIZE && width && height
    ? [{
        resize: width >= height
          ? { width: PRODUCT_IMAGE_MAX_SIZE }
          : { height: PRODUCT_IMAGE_MAX_SIZE }
      }]
    : [];

  const image = await ImageManipulator.manipulateAsync(
    uri,
    resizeAction,
    {
      compress: PRODUCT_IMAGE_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  if (!image.base64) {
    throw new Error('No se pudo convertir la imagen.');
  }

  return `data:image/jpeg;base64,${image.base64}`;
}

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
  const { width } = useWindowDimensions();
  const [activeSection, setActiveSection] = useState<AppSection>('home');
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string | null>(null);
  const [menuSearchText, setMenuSearchText] = useState('');
  const [paidTickets, setPaidTickets] = useState<PaidTicket[]>([]);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [ticketSearchText, setTicketSearchText] = useState('');
  const [managedMenuItems, setManagedMenuItems] = useState<MenuItem[]>([]);
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productCost, setProductCost] = useState('');
  const [productSku, setProductSku] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productImageDataUrl, setProductImageDataUrl] = useState<string | null>(null);
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
  const forcedTpvScreen = (globalThis as ExpoLikeGlobal).process?.env?.EXPO_PUBLIC_TPV_SCREEN;
  const useMobilePosLayout = forcedTpvScreen === 'mobile'
    ? true
    : forcedTpvScreen === 'desktop'
      ? false
      : Platform.OS !== 'web' || width < 760;

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

  async function loadSessionSummary(): Promise<void> {
    try {
      setSessionSummary(await apiService.fetchSessionSummary());
    } catch {
      Alert.alert('Error', 'No se pudo cargar el resumen de sesión.');
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
    const costCents = productCost.trim() ? parsePriceToCents(productCost) : null;
    const name = productName.trim();
    const category = productCategory.trim();

    if (!name || !category || priceCents === null) {
      Alert.alert('Producto no válido', 'Introduce nombre, tipo y precio válido.');
      return;
    }
    if (costCents === null && productCost.trim()) {
      Alert.alert('Coste no válido', 'Introduce un coste válido o deja el campo vacío.');
      return;
    }

    try {
      await apiService.createMenuItem({
        name,
        category,
        priceCents,
        costCents,
        sku: productSku.trim() || null,
        description: productDescription.trim() || null,
        imageDataUrl: productImageDataUrl,
        available: true,
      });
      setProductName('');
      setProductCategory('');
      setProductPrice('');
      setProductCost('');
      setProductSku('');
      setProductDescription('');
      setProductImageDataUrl(null);
      await loadManagedProducts();
      await actions.reloadMenu();
    } catch {
      Alert.alert('Error', 'No se pudo crear el producto.');
    }
  }

  async function chooseProductImage(onSelected: (imageDataUrl: string) => void): Promise<void> {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso de cámara', 'Activa el permiso de cámara para hacer la foto del producto.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: PRODUCT_IMAGE_QUALITY,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      try {
        const asset = result.assets[0];
        onSelected(await resizeNativeImage(asset.uri, asset.width, asset.height));
      } catch {
        Alert.alert('Error', 'No se pudo preparar la imagen.');
      }
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      resizeImageFile(file)
        .then(onSelected)
        .catch(() => Alert.alert('Error', 'No se pudo preparar la imagen.'));
    };
    input.click();
  }

  async function updateProductImage(item: MenuItem): Promise<void> {
    await chooseProductImage((imageDataUrl) => {
      void (async () => {
        try {
          await apiService.updateMenuItem(item.id, { imageDataUrl });
          await loadManagedProducts();
          await actions.reloadMenu();
        } catch {
          Alert.alert('Error', 'No se pudo guardar la imagen del producto.');
        }
      })();
    });
  }

  async function removeProductImage(item: MenuItem): Promise<void> {
    try {
      await apiService.updateMenuItem(item.id, { imageDataUrl: null });
      await loadManagedProducts();
      await actions.reloadMenu();
    } catch {
      Alert.alert('Error', 'No se pudo quitar la imagen del producto.');
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

  async function updateProductCost(item: MenuItem, value: string): Promise<void> {
    const trimmedValue = value.trim();
    const costCents = trimmedValue ? parsePriceToCents(trimmedValue) : null;
    if (costCents === null && trimmedValue) {
      Alert.alert('Coste no válido', 'Introduce un coste válido o deja el campo vacío.');
      return;
    }

    try {
      await apiService.updateMenuItem(item.id, { costCents });
      await loadManagedProducts();
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el coste interno.');
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

  function importProductsCsv(): void {
    if (Platform.OS !== 'web') {
      Alert.alert('Importación CSV', 'Importa CSV desde la pantalla de ordenador.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      file.text()
        .then(async (csv) => {
          const result = await apiService.importMenuCsv(csv);
          Alert.alert('CSV importado', `${result.created} creados, ${result.updated} actualizados.`);
          await loadManagedProducts();
          await actions.reloadMenu();
        })
        .catch(() => Alert.alert('Error', 'No se pudo importar el CSV.'));
    };
    input.click();
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

  async function openCashDrawer(): Promise<void> {
    try {
      await apiService.openXprinterCashDrawer();
      Alert.alert('Caja abierta', 'Se ha enviado la orden de apertura a la caja.');
    } catch {
      Alert.alert('Error', 'No se pudo abrir la caja.');
    }
  }

  const orderSectionProps = {
    selectedTable,
    preorderItems,
    tableOrders: tableConfirmedOrders,
    menuByCategory,
    preorderTotal,
    priceDraftByItemId,
    getMenuTitleById,
    formatPrice: centsToCurrency,
    onRemovePendingItem: (itemId: number) => {
      void actions.decrementPendingItem(itemId);
    },
    onAddPendingItem: (itemId: number) => {
      void actions.incrementPendingItem(itemId);
    },
    onUpdatePriceDraft: actions.updatePriceDraft,
    onCommitPriceDraft: (itemId: number) => {
      void actions.commitPriceDraft(itemId);
    },
    onAdjustItemPrice: (itemId: number, deltaCents: number) => {
      void actions.adjustItemPrice(itemId, deltaCents);
    },
    onConfirmOrder: () => {
      void actions.sendToKitchen();
    },
    onClearPreOrder: () => {
      void actions.clearPreOrder();
    },
    onPrintTicket: (options?: Parameters<typeof actions.printTicket>[0]) => {
      void actions.printTicket(options);
    },
    onPayTicket: (method: Parameters<typeof actions.payTable>[0], splitPeople?: number) => {
      void actions.payTable(method, splitPeople);
    },
    onPaySelectedItems: (
      method: Parameters<typeof actions.paySelectedItems>[0],
      items: Parameters<typeof actions.paySelectedItems>[1]
    ) => {
      void actions.paySelectedItems(method, items);
    },
    onRemoveOrder: (orderId: string) => {
      void actions.removeOrder(orderId);
    },
    onMoveConfirmedItemToPreOrder: (
      orderId: Parameters<typeof actions.moveConfirmedItemToPreOrder>[0],
      item: Parameters<typeof actions.moveConfirmedItemToPreOrder>[1]
    ) => {
      void actions.moveConfirmedItemToPreOrder(orderId, item);
    },
  };

  const posScreenProps = {
    tables,
    selectedTable,
    menuCategories,
    visibleMenuCategory,
    menuSearchText,
    normalizedMenuSearch,
    displayedMenuCategory,
    displayedMenuItems,
    minSearchLength: MIN_SEARCH_LENGTH,
    orderSectionProps,
    onMenuSearchTextChange: setMenuSearchText,
    onSelectMenuCategory: setSelectedMenuCategory,
    onSelectTable: (table: typeof selectedTable) => {
      void actions.selectTable(table);
    },
    onAddTable: (zone: Parameters<typeof actions.addTable>[0]) => {
      void actions.addTable(zone);
    },
    onRemoveTable: (table: typeof selectedTable) => {
      void actions.removeTable(table);
    },
    onAddMenuItem: (menuId: number) => {
      void actions.addMenuItem(menuId);
    },
    onOpenCashDrawer: () => {
      void openCashDrawer();
    },
    formatPrice: centsToCurrency,
  };

  useEffect(() => {
    if (activeSection === 'history') {
      void loadTicketHistory();
      void loadSessionSummary();
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
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => void loadSessionSummary()}>
                <Text style={styles.secondaryButtonText}>Resumen sesión</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => void loadTicketHistory()}>
                <Text style={styles.secondaryButtonText}>Actualizar</Text>
              </TouchableOpacity>
            </View>
          </View>
          {sessionSummary ? (
            <View style={styles.sessionSummaryPanel}>
              <View style={styles.panelHeaderRow}>
                <View>
                  <Text style={styles.itemName}>{`Sesión ${sessionSummary.sessionDate}`}</Text>
                  <Text style={styles.itemPrice}>
                    {`${formatDateTime(sessionSummary.startAt)} - ${formatDateTime(sessionSummary.endAt)} · ${sessionSummary.ticketCount} tickets`}
                  </Text>
                </View>
                <Text style={styles.totalText}>{centsToCurrency(sessionSummary.totalCents)}</Text>
              </View>
              <View style={styles.sessionSummaryGrid}>
                <Text style={styles.itemPrice}>{`Efectivo: ${centsToCurrency(sessionSummary.paymentTotals.cash)}`}</Text>
                <Text style={styles.itemPrice}>{`Tarjeta: ${centsToCurrency(sessionSummary.paymentTotals.card)}`}</Text>
                <Text style={styles.itemPrice}>{`Base: ${centsToCurrency(sessionSummary.taxableBaseCents)}`}</Text>
                <Text style={styles.itemPrice}>{`IVA: ${centsToCurrency(sessionSummary.vatCents)}`}</Text>
              </View>
              <Text style={styles.subTitle}>Productos vendidos</Text>
              {sessionSummary.items.slice(0, 8).map((item) => (
                <View key={item.name} style={styles.sessionSummaryRow}>
                  <Text style={styles.itemPrice}>{`${item.qty}x ${item.name}`}</Text>
                  <Text style={styles.itemPrice}>{centsToCurrency(item.totalCents)}</Text>
                </View>
              ))}
              {sessionSummary.items.length === 0 ? <Text style={styles.emptyText}>No hay ventas en esta sesión.</Text> : null}
            </View>
          ) : null}
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
          <View style={styles.panelHeaderRow}>
            <Text style={styles.helperText}>CSV recomendado: name, price, cost, sku, category, description, available</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={importProductsCsv}>
              <Text style={styles.secondaryButtonText}>Importar CSV</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.productForm}>
            <TextInput style={styles.formInput} value={productName} onChangeText={setProductName} placeholder="Nombre" placeholderTextColor="#6B7280" />
            <TextInput style={styles.formInput} value={productCategory} onChangeText={setProductCategory} placeholder="Tipo / categoría" placeholderTextColor="#6B7280" />
            <TextInput style={styles.formInput} value={productPrice} onChangeText={setProductPrice} placeholder="Precio" placeholderTextColor="#6B7280" keyboardType="decimal-pad" />
            <TextInput style={styles.formInput} value={productCost} onChangeText={setProductCost} placeholder="Coste interno" placeholderTextColor="#6B7280" keyboardType="decimal-pad" />
            <TextInput style={styles.formInput} value={productSku} onChangeText={setProductSku} placeholder="SKU opcional" placeholderTextColor="#6B7280" />
            <TextInput style={[styles.formInput, styles.formInputWide]} value={productDescription} onChangeText={setProductDescription} placeholder="Descripción opcional" placeholderTextColor="#6B7280" />
            <View style={styles.productImagePicker}>
              {productImageDataUrl ? (
                <Image source={{ uri: productImageDataUrl }} style={styles.productImagePreview} resizeMode="contain" />
              ) : (
                <View style={styles.productImagePlaceholder}>
                  <Text style={styles.itemPrice}>Imagen</Text>
                </View>
              )}
              <TouchableOpacity style={styles.secondaryButton} onPress={() => void chooseProductImage(setProductImageDataUrl)}>
                <Text style={styles.secondaryButtonText}>{productImageDataUrl ? 'Cambiar imagen' : Platform.OS === 'web' ? 'Añadir imagen' : 'Hacer foto'}</Text>
              </TouchableOpacity>
              {productImageDataUrl ? (
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setProductImageDataUrl(null)}>
                  <Text style={styles.secondaryButtonText}>Quitar</Text>
                </TouchableOpacity>
              ) : null}
            </View>
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
                {item.imageDataUrl ? (
                  <Image source={{ uri: item.imageDataUrl }} style={styles.productRowImage} resizeMode="contain" />
                ) : (
                  <View style={styles.productRowImagePlaceholder}>
                    <Text style={styles.itemPrice}>Sin imagen</Text>
                  </View>
                )}
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
                <TextInput
                  style={styles.priceInput}
                  defaultValue={item.costCents !== null && item.costCents !== undefined ? (item.costCents / 100).toFixed(2) : ''}
                  keyboardType="decimal-pad"
                  placeholder="Coste"
                  placeholderTextColor="#6B7280"
                  onSubmitEditing={(event) => void updateProductCost(item, event.nativeEvent.text)}
                  onEndEditing={(event) => void updateProductCost(item, event.nativeEvent.text)}
                />
                <TouchableOpacity style={styles.secondaryButton} onPress={() => void updateProductImage(item)}>
                  <Text style={styles.secondaryButtonText}>{item.imageDataUrl ? 'Cambiar' : 'Imagen'}</Text>
                </TouchableOpacity>
                {item.imageDataUrl ? (
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => void removeProductImage(item)}>
                    <Text style={styles.secondaryButtonText}>Quitar</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {activeSection === 'pos' && useMobilePosLayout ? (
        <MobilePosScreen {...posScreenProps} />
      ) : null}

      {activeSection === 'pos' && !useMobilePosLayout ? (
        <DesktopPosScreen {...posScreenProps} />
      ) : null}
    </SafeAreaView>
  );
}
