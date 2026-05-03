import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  Alert,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { useTicketingController } from './src/native/controllers';
import { translateCategory } from './src/native/components/MenuZoneGroup/MenuCategoryGroup';
import { MenuItem, normalizeTableZone, PaidTicket, SessionSummary, tableZoneLabel } from './src/native/types';
import { apiService } from './src/native/services';
import { getOptionalXprinterTarget, getSimplifiedInvoiceConfig } from './src/native/helpers/kitchenTicketPrinter';
import { DesktopMainScreen } from './src/native/app/DesktopMainScreen';
import { MobileMainScreen } from './src/native/app/MobileMainScreen';
import { AppSection, MainScreenProps } from './src/native/app/MainScreen.types';
import {
  centsToCurrency,
  getMenuTitleById
} from './src/native/app/app.helpers';
import { styles } from './src/native/app/App.styles';

const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_RESULTS = 24;
const PRODUCT_IMAGE_MAX_SIZE = 512;
const PRODUCT_IMAGE_QUALITY = 0.82;
const AUTH_TOKEN_STORAGE_KEY = 'bar-ticketing-auth-token';
type AuthStatus = 'checking' | 'signedOut' | 'signedIn';

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildPaidTicketHtml(ticket: PaidTicket): string {
  const rows = ticket.items.map((item) => `
    <tr>
      <td>${item.qty}</td>
      <td>${escapeHtml(item.name)}</td>
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
    @page { size: A4; margin: 18mm; }
  </style>
</head>
<body>
  <section class="ticket">
    <h1>Factura simplificada ${escapeHtml(ticket.ticketNumber)}</h1>
    <div class="meta">Mesa ${escapeHtml(ticket.tableZone)}-${ticket.tableNumber} · ${formatDateTime(ticket.createdAt)} · ${ticket.method === 'cash' ? 'Efectivo' : 'Tarjeta'}</div>
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
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [accessCode, setAccessCode] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const { state, actions } = useTicketingController(authStatus === 'signedIn');
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

  useEffect(() => {
    async function restoreLogin(): Promise<void> {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      if (token) {
        apiService.setAuthToken(token);
        setAuthStatus('signedIn');
        return;
      }

      setAuthStatus('signedOut');
    }

    void restoreLogin();
  }, []);
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

  async function refreshSessionSummary(showFeedback = false): Promise<void> {
    try {
      const summary = await apiService.fetchSessionSummary();
      setSessionSummary(summary);
      if (showFeedback) {
        Alert.alert(
          'Resumen actualizado',
          summary.ticketCount > 0
            ? `${summary.ticketCount} tickets · ${centsToCurrency(summary.totalCents)}`
            : 'No hay ventas en la sesión actual.'
        );
      }
    } catch {
      Alert.alert('Error', 'No se pudo cargar el resumen de sesión.');
    }
  }

  async function handleLogin(): Promise<void> {
    const trimmedCode = accessCode.trim();
    if (!trimmedCode) {
      Alert.alert('Código requerido', 'Introduce el código de acceso.');
      return;
    }

    setLoginLoading(true);
    try {
      const result = await apiService.login(trimmedCode);
      await AsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, result.token);
      setAccessCode('');
      setActiveSection('home');
      setAuthStatus('signedIn');
    } catch {
      Alert.alert('Acceso denegado', 'El código de acceso no es correcto.');
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout(): Promise<void> {
    apiService.setAuthToken(null);
    await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setActiveSection('home');
    setAuthStatus('signedOut');
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

  async function downloadTicket(ticket: PaidTicket): Promise<void> {
    const html = buildPaidTicketHtml(ticket);

    if (Platform.OS === 'web') {
      const windowRef = (globalThis as typeof globalThis & { window?: Window }).window;
      const printWindow = windowRef?.open('', '_blank', 'width=820,height=900');
      if (!printWindow) {
        Alert.alert('PDF bloqueado', 'Permite ventanas emergentes para guardar el ticket como PDF.');
        return;
      }

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.setTimeout(() => printWindow.print(), 250);
      return;
    }

    try {
      const pdf = await Print.printToFileAsync({
        html,
        width: 595,
        height: 842,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('PDF generado', pdf.uri);
        return;
      }

      await Sharing.shareAsync(pdf.uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: `Guardar ${ticket.ticketNumber}.pdf`,
      });
    } catch {
      Alert.alert('Error', 'No se pudo generar el PDF del ticket.');
      return;
    }
  }

  async function printSimplifiedPaidTicket(ticket: PaidTicket): Promise<void> {
    const config = getSimplifiedInvoiceConfig();
    const lines = ticket.items.map((item) => ({
      name: item.name,
      qty: item.qty,
      unitPriceCents: item.unitPriceCents,
      totalPriceCents: item.totalPriceCents,
    }));

    try {
      await apiService.printXprinterTicket({
        businessName: config.businessName,
        tradeName: config.tradeName,
        nif: config.nif,
        address: config.address,
        city: config.city || null,
        phone: config.phone || null,
        invoiceNumber: ticket.ticketNumber,
        issuedAt: formatDateTime(ticket.createdAt),
        tableLabel: `${tableZoneLabel(normalizeTableZone(ticket.tableZone))} ${ticket.tableNumber}`,
        lines,
        taxableBaseCents: ticket.taxableBaseCents,
        vatCents: ticket.vatCents,
        vatRatePercent: ticket.vatRatePercent,
        totalCents: ticket.totalCents,
        ticketNote: ticket.mode === 'split' ? 'Cuenta dividida' : null,
        splitPeople: ticket.splitPeople ?? null,
        openCashDrawer: false,
        ...getOptionalXprinterTarget(),
      });
      Alert.alert('Ticket impreso', `Se ha enviado ${ticket.ticketNumber} a la impresora.`);
    } catch {
      Alert.alert('Error', 'No se pudo imprimir el ticket simplificado.');
    }
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
      void refreshSessionSummary();
    }
    if (activeSection === 'products') {
      void loadManagedProducts();
    }
  }, [activeSection]);

  if (authStatus === 'checking') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.title}>Comprobando acceso...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (authStatus === 'signedOut') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loginScreen}>
          <View style={styles.loginPanel}>
            <Text style={styles.loginTitle}>TPV Restaurante</Text>
            <Text style={styles.helperText}>Introduce el código de acceso para continuar.</Text>
            <TextInput
              style={styles.loginInput}
              value={accessCode}
              onChangeText={setAccessCode}
              placeholder="Código de acceso"
              placeholderTextColor="#6B7280"
              secureTextEntry
              autoFocus
              onSubmitEditing={() => void handleLogin()}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={() => void handleLogin()} disabled={loginLoading}>
              <Text style={styles.primaryButtonText}>{loginLoading ? 'Entrando...' : 'Entrar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.title}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const mainScreenProps: MainScreenProps = {
    activeSection,
    setActiveSection,
    onLogout: () => void handleLogout(),
    posScreenProps,
    sessionSummary,
    filteredPaidTickets,
    ticketSearchText,
    setTicketSearchText,
    refreshSessionSummary,
    loadTicketHistory,
    printSimplifiedPaidTicket,
    downloadTicket,
    managedCategories,
    managedMenuItems,
    productName,
    setProductName,
    productCategory,
    setProductCategory,
    productPrice,
    setProductPrice,
    productCost,
    setProductCost,
    productSku,
    setProductSku,
    productDescription,
    setProductDescription,
    productImageDataUrl,
    setProductImageDataUrl,
    importProductsCsv,
    chooseProductImage,
    saveNewProduct,
    updateProductCategory,
    updateProductPrice,
    updateProductCost,
    updateProductImage,
    removeProductImage,
    formatDateTime,
    centsToCurrency,
  };

  return useMobilePosLayout
    ? <MobileMainScreen {...mainScreenProps} />
    : <DesktopMainScreen {...mainScreenProps} />;
}
