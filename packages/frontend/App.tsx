import React, { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  Alert,
  AppState,
  BackHandler,
  Modal,
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
import { MenuItem, normalizeTableZone, PaidTicket, SessionSummary, tableZoneLabel, TicketHistorySummary, TicketPeriodPreset } from './src/native/types';
import { apiService, setApiUnauthorizedHandler } from './src/native/services';
import { ApiRequestError, getApiBaseUrl, setApiBaseUrl, testApiConnection } from './src/native/services/api';
import { getItemDisplayName } from './src/native/helpers/itemDisplayName';
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
const API_BASE_URL_STORAGE_KEY = 'bar-ticketing-api-base-url';
const DATA_SYNC_SIGNAL_INTERVAL_MS = 5000;
const DATA_SYNC_MIN_REFRESH_INTERVAL_MS = 5000;
type AuthStatus = 'checking' | 'signedOut' | 'signedIn';

interface TicketDateRangeState {
  startAt: string | null;
  endAt: string | null;
  label: string;
  error: string | null;
}

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

function formatDateOnly(value: Date): string {
  return value.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateInputValue(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, months: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

function startOfWeek(value: Date): Date {
  const start = startOfDay(value);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(start, offset);
}

function resolveTicketDateRange(
  preset: TicketPeriodPreset,
  customStartDate: string,
  customEndDate: string,
  reference = new Date()
): TicketDateRangeState {
  const today = startOfDay(reference);
  let start: Date;
  let end: Date;

  if (preset === 'today') {
    start = today;
    end = addDays(today, 1);
  } else if (preset === 'yesterday') {
    start = addDays(today, -1);
    end = today;
  } else if (preset === 'thisWeek') {
    start = startOfWeek(today);
    end = addDays(start, 7);
  } else if (preset === 'thisMonth') {
    start = startOfMonth(today);
    end = addMonths(start, 1);
  } else if (preset === 'previousMonth') {
    end = startOfMonth(today);
    start = addMonths(end, -1);
  } else {
    const customStart = parseDateInputValue(customStartDate);
    const customEnd = parseDateInputValue(customEndDate);
    if (!customStart || !customEnd) {
      return {
        startAt: null,
        endAt: null,
        label: 'Rango personalizado',
        error: 'Usa fechas con formato AAAA-MM-DD.',
      };
    }
    start = startOfDay(customStart);
    end = addDays(startOfDay(customEnd), 1);
  }

  if (start >= end) {
    return {
      startAt: null,
      endAt: null,
      label: 'Rango no válido',
      error: 'La fecha inicial debe ser anterior o igual a la fecha final.',
    };
  }

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    label: `${formatDateOnly(start)} - ${formatDateOnly(addDays(end, -1))}`,
    error: null,
  };
}

function getPaymentMethodLabel(method: string): string {
  return method === 'cash' ? 'Efectivo' : method === 'card' ? 'Tarjeta' : method;
}

function getTicketModeLabel(mode: string): string {
  if (mode === 'aa') {
    return 'Pago parcial / AA';
  }
  if (mode === 'split') {
    return 'Cuenta dividida';
  }
  return 'Ticket completo';
}

function getTicketStatusLabel(status: string | null | undefined): string {
  if (status === 'refunded') {
    return 'Devuelto';
  }
  if (status === 'cancelled') {
    return 'Cancelado';
  }
  return 'Cobrado';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildPaidTicketArticle(ticket: PaidTicket): string {
  const invoiceConfig = getSimplifiedInvoiceConfig();
  const businessName = ticket.businessName || invoiceConfig.businessName;
  const tradeName = ticket.tradeName || invoiceConfig.tradeName;
  const businessTaxId = ticket.businessTaxId || invoiceConfig.nif;
  const businessAddress = ticket.businessAddress || invoiceConfig.address;
  const businessCity = ticket.businessCity || invoiceConfig.city;
  const businessPhone = ticket.businessPhone || invoiceConfig.phone;
  const terminalId = ticket.terminalId || 'TPV-1';
  const cashierName = ticket.cashierName || 'No registrado';
  const customerName = ticket.customerName || 'Cliente no identificado';
  const customerTaxId = ticket.customerTaxId || 'No registrado';
  const rows = ticket.items.map((item) => {
    const displayName = getItemDisplayName(item);
    const lineTaxableBaseCents = Math.round(item.totalPriceCents / (1 + ticket.vatRatePercent / 100));
    const lineVatCents = item.totalPriceCents - lineTaxableBaseCents;
    return `
      <tr>
        <td>${item.qty}</td>
        <td>
          <div class="item-primary">${escapeHtml(displayName.primary)}</div>
          ${displayName.secondary ? `<div class="item-secondary">${escapeHtml(displayName.secondary)}</div>` : ''}
        </td>
        <td>${centsToCurrency(item.unitPriceCents)}</td>
        <td>${centsToCurrency(lineTaxableBaseCents)}</td>
        <td>${ticket.vatRatePercent}%</td>
        <td>${centsToCurrency(lineVatCents)}</td>
        <td>${centsToCurrency(item.totalPriceCents)}</td>
      </tr>`;
  }).join('');

  return `
  <section class="ticket">
    <header class="ticket-header">
      <div>
        <h1>Factura simplificada ${escapeHtml(ticket.ticketNumber)}</h1>
        <div class="meta">${escapeHtml(tradeName)} · ${escapeHtml(businessName)}</div>
        <div class="meta">NIF/CIF: ${escapeHtml(businessTaxId)}</div>
        <div class="meta">${escapeHtml(businessAddress)}${businessCity ? ` · ${escapeHtml(businessCity)}` : ''}${businessPhone ? ` · Tel. ${escapeHtml(businessPhone)}` : ''}</div>
      </div>
      <div class="status-box">${escapeHtml(getTicketStatusLabel(ticket.status))}</div>
    </header>
    <section class="meta-grid">
      <div><strong>Numero / factura</strong>${escapeHtml(ticket.ticketNumber)}</div>
      <div><strong>Fecha y hora</strong>${escapeHtml(formatDateTime(ticket.createdAt))}</div>
      <div><strong>Mesa</strong>${escapeHtml(tableZoneLabel(normalizeTableZone(ticket.tableZone)))} ${ticket.tableNumber}</div>
      <div><strong>Terminal</strong>${escapeHtml(terminalId)}</div>
      <div><strong>Cajero / usuario</strong>${escapeHtml(cashierName)}</div>
      <div><strong>Pago</strong>${escapeHtml(getPaymentMethodLabel(ticket.method))}</div>
      <div><strong>Modalidad</strong>${escapeHtml(getTicketModeLabel(ticket.mode))}</div>
      <div><strong>Cliente</strong>${escapeHtml(customerName)}</div>
      <div><strong>NIF cliente</strong>${escapeHtml(customerTaxId)}</div>
      <div><strong>Ticket relacionado</strong>${escapeHtml(ticket.relatedTicketNumber || 'No aplica')}</div>
    </section>
    <table>
      <thead>
        <tr>
          <th>Ud.</th>
          <th>Concepto</th>
          <th>Precio</th>
          <th>Base</th>
          <th>IVA</th>
          <th>Cuota</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span>Descuentos</span><span>${centsToCurrency(0)}</span></div>
      <div><span>Base imponible</span><span>${centsToCurrency(ticket.taxableBaseCents)}</span></div>
      <div><span>IVA ${ticket.vatRatePercent}%</span><span>${centsToCurrency(ticket.vatCents)}</span></div>
      <div class="total"><span>Total</span><span>${centsToCurrency(ticket.totalCents)}</span></div>
    </div>
  </section>`;
}

function buildPaidTicketDocumentHtml(content: string, title: string): string {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; color: #111827; }
    .ticket { width: 100%; max-width: 174mm; min-height: calc(297mm - 36mm); margin: 0 auto; break-after: page; page-break-after: always; break-inside: avoid; page-break-inside: avoid; }
    .ticket:last-child { break-after: auto; page-break-after: auto; }
    .ticket-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 14px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .meta { font-size: 12px; color: #475569; margin-bottom: 3px; }
    .status-box { border: 1px solid #111827; padding: 8px 10px; font-weight: 700; font-size: 12px; text-transform: uppercase; white-space: nowrap; }
    .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 12px; margin-bottom: 14px; font-size: 12px; }
    .meta-grid strong { display: block; color: #475569; font-size: 10px; text-transform: uppercase; margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px solid #E2E8F0; padding: 6px 4px; text-align: left; }
    td:last-child, th:last-child { text-align: right; }
    td:nth-child(3), th:nth-child(3),
    td:nth-child(4), th:nth-child(4),
    td:nth-child(5), th:nth-child(5),
    td:nth-child(6), th:nth-child(6) { text-align: right; }
    .item-primary { font-weight: 700; }
    .item-secondary { color: #475569; font-size: 11px; margin-top: 2px; }
    .totals { margin-top: 12px; font-size: 13px; }
    .totals div { display: flex; justify-content: space-between; padding: 3px 0; }
    .total { font-weight: 700; font-size: 15px; border-top: 1px solid #111827; padding-top: 8px; }
    @page { size: A4; margin: 18mm; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
}

function buildPaidTicketHtml(ticket: PaidTicket): string {
  return buildPaidTicketDocumentHtml(buildPaidTicketArticle(ticket), ticket.ticketNumber);
}

function buildPaidTicketBatchHtml(tickets: PaidTicket[], title: string): string {
  return buildPaidTicketDocumentHtml(tickets.map(buildPaidTicketArticle).join('\n'), title);
}

export default function App(): React.JSX.Element {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [accessCode, setAccessCode] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [, requestCameraPermission] = useCameraPermissions();
  const [configuredApiBaseUrl, setConfiguredApiBaseUrl] = useState(getApiBaseUrl());
  const [apiBaseUrlDraft, setApiBaseUrlDraft] = useState(getApiBaseUrl());
  const [isConnectionModalVisible, setIsConnectionModalVisible] = useState(false);
  const [isPairingScannerVisible, setIsPairingScannerVisible] = useState(false);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [isHandlingPairScan, setIsHandlingPairScan] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const isRefreshingDataRef = useRef(false);
  const isCheckingSyncRevisionRef = useRef(false);
  const lastSyncRevisionRef = useRef<number | null>(null);
  const lastOperationalSyncAtRef = useRef(0);
  const pendingSyncRevisionRef = useRef<number | null>(null);
  const syncRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { state, actions } = useTicketingController(authStatus === 'signedIn');
  const { width } = useWindowDimensions();
  const [activeSection, setActiveSection] = useState<AppSection>('home');
  const [sectionHistory, setSectionHistory] = useState<AppSection[]>([]);
  const [selectedMenuCategory, setSelectedMenuCategory] = useState<string | null>(null);
  const [menuSearchText, setMenuSearchText] = useState('');
  const [paidTickets, setPaidTickets] = useState<PaidTicket[]>([]);
  const [selectedPaidTicket, setSelectedPaidTicket] = useState<PaidTicket | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [ticketSearchText, setTicketSearchText] = useState('');
  const [ticketPeriodPreset, setTicketPeriodPreset] = useState<TicketPeriodPreset>('today');
  const [ticketCustomStartDate, setTicketCustomStartDate] = useState(() => formatDateInputValue(new Date()));
  const [ticketCustomEndDate, setTicketCustomEndDate] = useState(() => formatDateInputValue(new Date()));
  const [managedMenuItems, setManagedMenuItems] = useState<MenuItem[]>([]);
  const [productName, setProductName] = useState('');
  const [productPrimaryName, setProductPrimaryName] = useState('');
  const [productSecondaryName, setProductSecondaryName] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productCost, setProductCost] = useState('');
  const [productSku, setProductSku] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productImageDataUrl, setProductImageDataUrl] = useState<string | null>(null);
  const {
    loading,
    tables,
    tableTotals,
    tableKitchenStatuses,
    selectedTable,
    menuByCategory,
    preorderItems,
    tableConfirmedOrders,
    preorderTotal,
    currentTableTotal,
    priceDraftByItemId
  } = state;

  function resetNavigation(): void {
    setSectionHistory([]);
    setActiveSection('home');
  }

  function navigateToSection(section: AppSection): void {
    if (section === activeSection) {
      return;
    }

    setSectionHistory((previous) => [...previous, activeSection].slice(-12));
    setActiveSection(section);
  }

  function goHome(): void {
    resetNavigation();
  }

  function goBack(): void {
    if (activeSection === 'home') {
      return;
    }

    const previousSection = sectionHistory[sectionHistory.length - 1] ?? 'home';
    setSectionHistory((previous) => previous.slice(0, -1));
    setActiveSection(previousSection);
  }

  function openConnectionSetup(): void {
    setApiBaseUrlDraft(configuredApiBaseUrl);
    setIsPairingScannerVisible(false);
    setIsHandlingPairScan(false);
    setIsConnectionModalVisible(true);
  }

  async function beginPairingScan(): Promise<void> {
    const permission = await requestCameraPermission();
    if (!permission.granted) {
      Alert.alert('Permiso de cámara', 'Activa la cámara para escanear el código del ordenador.');
      return;
    }

    setIsHandlingPairScan(false);
    setIsPairingScannerVisible(true);
  }

  async function saveConnection(value: string): Promise<void> {
    setIsSavingConnection(true);
    try {
      const normalizedUrl = await testApiConnection(value);
      setApiBaseUrl(normalizedUrl);
      await AsyncStorage.setItem(API_BASE_URL_STORAGE_KEY, normalizedUrl);
      apiService.setAuthToken(null);
      await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      setConfiguredApiBaseUrl(normalizedUrl);
      setApiBaseUrlDraft(normalizedUrl);
      setIsPairingScannerVisible(false);
      setIsConnectionModalVisible(false);
      resetNavigation();
      setAuthStatus('signedOut');
      Alert.alert('Ordenador conectado', 'Introduce el código de acceso del TPV para continuar.');
    } catch {
      setIsHandlingPairScan(false);
      Alert.alert(
        'No se encuentra el ordenador',
        'Comprueba que el TPV esté abierto en el ordenador y que el teléfono esté en la misma red Wi-Fi o conectado al hotspot del ordenador.'
      );
    } finally {
      setIsSavingConnection(false);
    }
  }

  function handlePairingCodeScanned(result: BarcodeScanningResult): void {
    if (isHandlingPairScan) {
      return;
    }

    setIsHandlingPairScan(true);
    setIsPairingScannerVisible(false);
    setApiBaseUrlDraft(result.data);
    void saveConnection(result.data);
  }

  useEffect(() => {
    setApiUnauthorizedHandler(() => {
      apiService.setAuthToken(null);
      void AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      setAuthStatus('signedOut');
      resetNavigation();
    });

    async function restoreLogin(): Promise<void> {
      const savedApiBaseUrl = await AsyncStorage.getItem(API_BASE_URL_STORAGE_KEY);
      if (savedApiBaseUrl) {
        try {
          const restoredUrl = setApiBaseUrl(savedApiBaseUrl);
          setConfiguredApiBaseUrl(restoredUrl);
          setApiBaseUrlDraft(restoredUrl);
        } catch {
          await AsyncStorage.removeItem(API_BASE_URL_STORAGE_KEY);
        }
      }

      const token = await AsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      if (token) {
        apiService.setAuthToken(token);
        setAuthStatus('signedIn');
        return;
      }

      setAuthStatus('signedOut');
    }

    void restoreLogin();

    return () => setApiUnauthorizedHandler(null);
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
  const ticketDateRange = useMemo(
    () => resolveTicketDateRange(ticketPeriodPreset, ticketCustomStartDate, ticketCustomEndDate),
    [ticketPeriodPreset, ticketCustomStartDate, ticketCustomEndDate]
  );
  const filteredPaidTickets = useMemo(() => {
    const query = normalizeSearchText(ticketSearchText);
    if (!query) return paidTickets;
    return paidTickets.filter((ticket) => {
      const searchableText = normalizeSearchText([
        ticket.ticketNumber,
        ticket.tableZone,
        String(ticket.tableNumber),
        ticket.method,
        ticket.mode,
        ticket.status,
        ticket.businessName,
        ticket.tradeName,
        ticket.businessTaxId,
        ticket.customerName,
        ticket.customerTaxId,
        ...ticket.items.map((item) => item.name),
      ].join(' '));
      return searchableText.includes(query);
    });
  }, [paidTickets, ticketSearchText]);
  const ticketHistorySummary = useMemo<TicketHistorySummary>(() => {
    return filteredPaidTickets.reduce<TicketHistorySummary>((summary, ticket) => {
      summary.ticketCount += 1;
      summary.itemQuantity += ticket.items.reduce((sum, item) => sum + item.qty, 0);
      summary.totalCents += ticket.totalCents;
      summary.taxableBaseCents += ticket.taxableBaseCents;
      summary.vatCents += ticket.vatCents;
      summary.paymentTotals[ticket.method] = (summary.paymentTotals[ticket.method] ?? 0) + ticket.totalCents;
      return summary;
    }, {
      ticketCount: 0,
      itemQuantity: 0,
      totalCents: 0,
      taxableBaseCents: 0,
      vatCents: 0,
      paymentTotals: {
        cash: 0,
        card: 0,
      },
    });
  }, [filteredPaidTickets]);
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

  useEffect(() => {
    if (!selectedPaidTicket) {
      return;
    }

    const refreshedTicket = paidTickets.find((ticket) => ticket.id === selectedPaidTicket.id);
    setSelectedPaidTicket(refreshedTicket ?? null);
  }, [paidTickets, selectedPaidTicket?.id]);

  useEffect(() => {
    if (Platform.OS === 'web' || authStatus !== 'signedIn' || activeSection === 'home' || activeSection === 'pos') {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });

    return () => subscription.remove();
  }, [activeSection, authStatus, sectionHistory]);

  async function loadTicketHistory(options: { showError?: boolean } = {}): Promise<void> {
    if (ticketDateRange.error || !ticketDateRange.startAt || !ticketDateRange.endAt) {
      if (options.showError !== false) {
        Alert.alert('Rango de fechas no válido', ticketDateRange.error ?? 'Selecciona un periodo válido.');
      }
      return;
    }

    try {
      setPaidTickets(await apiService.fetchPaidTickets({
        startAt: ticketDateRange.startAt,
        endAt: ticketDateRange.endAt,
      }));
    } catch {
      if (options.showError !== false) {
        Alert.alert('Error', 'No se pudo cargar el historial de tickets.');
      }
    }
  }

  async function refreshSessionSummary(showFeedback = false, options: { showError?: boolean } = {}): Promise<void> {
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
      if (options.showError !== false) {
        Alert.alert('Error', 'No se pudo cargar el resumen de sesión.');
      }
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
      resetNavigation();
      setAuthStatus('signedIn');
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'INVALID_LOGIN') {
        Alert.alert('Acceso denegado', 'El código de acceso no es correcto.');
      } else {
        Alert.alert(
          'No se pudo conectar',
          `El teléfono no puede conectar con el servidor.\n\nServidor configurado:\n${getApiBaseUrl()}\n\nComprueba que la aplicación esté abierta en el ordenador y que el teléfono esté en la misma red Wi-Fi o conectado al hotspot del ordenador.`
        );
      }
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout(): Promise<void> {
    apiService.setAuthToken(null);
    await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    resetNavigation();
    setAuthStatus('signedOut');
  }

  async function loadManagedProducts(options: { showError?: boolean } = {}): Promise<void> {
    try {
      setManagedMenuItems(await apiService.fetchManageMenu());
    } catch {
      if (options.showError !== false) {
        Alert.alert('Error', 'No se pudo cargar la gestión de productos.');
      }
    }
  }

  async function refreshOperationalData(options: { showFeedback?: boolean; showError?: boolean } = {}): Promise<boolean> {
    if (authStatus !== 'signedIn' || isRefreshingDataRef.current) {
      return false;
    }

    isRefreshingDataRef.current = true;
    setIsRefreshingData(true);

    try {
      await actions.refreshData();

      if (activeSection === 'history') {
        await Promise.all([
          loadTicketHistory({ showError: options.showError }),
          refreshSessionSummary(false, { showError: options.showError }),
        ]);
      }

      if (activeSection === 'products') {
        await loadManagedProducts({ showError: options.showError });
      }

      lastOperationalSyncAtRef.current = Date.now();

      if (options.showFeedback) {
        Alert.alert('Datos actualizados', 'Ordenador y móvil están sincronizados con el servidor.');
      }
      return true;
    } catch {
      if (options.showError !== false) {
        Alert.alert('Error', 'No se pudieron actualizar los datos.');
      }
      return false;
    } finally {
      isRefreshingDataRef.current = false;
      setIsRefreshingData(false);
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
        primaryName: productPrimaryName.trim() || null,
        secondaryName: productSecondaryName.trim() || null,
        category,
        priceCents,
        costCents,
        sku: productSku.trim() || null,
        description: productDescription.trim() || null,
        imageDataUrl: productImageDataUrl,
        available: true,
      });
      setProductName('');
      setProductPrimaryName('');
      setProductSecondaryName('');
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

  function removeProduct(item: MenuItem): void {
    const message = `Se eliminará "${item.name}" del menú. Los tickets y pedidos existentes conservarán sus datos. Esta acción no se puede deshacer.`;
    const onConfirm = () => {
      void (async () => {
        try {
          await apiService.deleteMenuItem(item.id);
          await loadManagedProducts();
          await actions.reloadMenu();
        } catch {
          Alert.alert('Error', 'No se pudo eliminar el producto.');
        }
      })();
    };

    if (Platform.OS === 'web') {
      const webConfirm = (globalThis as typeof globalThis & { confirm?: (prompt: string) => boolean }).confirm;
      if (!webConfirm || webConfirm(message)) {
        onConfirm();
      }
      return;
    }

    Alert.alert(
      'Eliminar producto',
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: onConfirm },
      ]
    );
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

  async function updateProductDetails(
    item: MenuItem,
    values: { name: string; primaryName: string; secondaryName: string; category: string; price: string; cost: string }
  ): Promise<boolean> {
    const nextName = values.name.trim();
    const nextCategory = values.category.trim();
    const priceCents = parsePriceToCents(values.price);
    const trimmedCost = values.cost.trim();
    const costCents = trimmedCost ? parsePriceToCents(trimmedCost) : null;

    if (!nextName) {
      Alert.alert('Nombre no válido', 'Introduce un nombre de producto.');
      return false;
    }
    if (!nextCategory) {
      Alert.alert('Tipo no válido', 'Introduce un tipo de producto.');
      return false;
    }
    if (priceCents === null) {
      Alert.alert('Precio no válido', 'Introduce un precio válido.');
      return false;
    }
    if (costCents === null && trimmedCost) {
      Alert.alert('Coste no válido', 'Introduce un coste válido o deja el campo vacío.');
      return false;
    }

    try {
      await apiService.updateMenuItem(item.id, {
        name: nextName,
        primaryName: values.primaryName.trim() || null,
        secondaryName: values.secondaryName.trim() || null,
        category: nextCategory,
        priceCents,
        costCents,
      });
      await loadManagedProducts();
      await actions.reloadMenu();
      return true;
    } catch {
      Alert.alert('Error', 'No se pudieron guardar los cambios del producto.');
      return false;
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

  async function updateProductDisplayNames(item: MenuItem, primaryName: string, secondaryName: string): Promise<void> {
    try {
      await apiService.updateMenuItem(item.id, {
        primaryName: primaryName.trim() || null,
        secondaryName: secondaryName.trim() || null,
      });
      await loadManagedProducts();
      await actions.reloadMenu();
    } catch {
      Alert.alert('Error', 'No se pudieron actualizar los nombres del producto.');
    }
  }

  async function updateProductName(item: MenuItem, name: string): Promise<void> {
    const nextName = name.trim();
    if (!nextName) {
      Alert.alert('Nombre no válido', 'Introduce un nombre de producto.');
      return;
    }

    try {
      await apiService.updateMenuItem(item.id, { name: nextName });
      await loadManagedProducts();
      await actions.reloadMenu();
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el nombre del producto.');
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

  async function downloadFilteredTicketPdfs(): Promise<void> {
    if (filteredPaidTickets.length === 0) {
      Alert.alert('Sin tickets', 'No hay tickets en el periodo y búsqueda seleccionados.');
      return;
    }

    const title = `Tickets ${ticketDateRange.label}`;
    const html = buildPaidTicketBatchHtml(filteredPaidTickets, title);

    if (Platform.OS === 'web') {
      const windowRef = (globalThis as typeof globalThis & { window?: Window }).window;
      const printWindow = windowRef?.open('', '_blank', 'width=900,height=900');
      if (!printWindow) {
        Alert.alert('PDF bloqueado', 'Permite ventanas emergentes para guardar los tickets como PDF.');
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
        dialogTitle: `Guardar tickets ${ticketDateRange.label}.pdf`,
      });
    } catch {
      Alert.alert('Error', 'No se pudieron generar los PDFs del periodo.');
    }
  }

  async function printSimplifiedPaidTicket(ticket: PaidTicket): Promise<void> {
    const config = getSimplifiedInvoiceConfig();
    const lines = ticket.items.map((item) => ({
      name: item.name,
      primaryName: item.primaryName,
      secondaryName: item.secondaryName,
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
      await apiService.openXprinterCashDrawer(getOptionalXprinterTarget());
      Alert.alert('Caja abierta', 'Se ha enviado la orden de apertura a la caja.');
    } catch (error) {
      const details = error instanceof ApiRequestError ? `\n\n${error.message}` : '';
      Alert.alert('Error', `No se pudo abrir la caja.${details}`);
    }
  }

  const orderSectionProps = {
    selectedTable,
    preorderItems,
    tableOrders: tableConfirmedOrders,
    menuByCategory,
    preorderTotal,
    currentTableTotal,
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
    onRemoveSelectedItems: (items: Parameters<typeof actions.removeSelectedItems>[0]) => {
      void actions.removeSelectedItems(items);
    },
    onMoveConfirmedItemToPreOrder: (
      orderId: Parameters<typeof actions.moveConfirmedItemToPreOrder>[0],
      item: Parameters<typeof actions.moveConfirmedItemToPreOrder>[1]
    ) => {
      void actions.moveConfirmedItemToPreOrder(orderId, item);
    },
    onOpenCashDrawer: () => {
      void openCashDrawer();
    },
  };

  const posScreenProps = {
    tables,
    tableTotals,
    tableKitchenStatuses,
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
    onRefreshData: () => void refreshOperationalData({ showFeedback: true }),
    isRefreshingData,
    onExit: goBack,
    formatPrice: centsToCurrency,
  };

  useEffect(() => {
    if (activeSection !== 'history' || ticketDateRange.error || !ticketDateRange.startAt || !ticketDateRange.endAt) {
      return;
    }

    void loadTicketHistory({ showError: false });
  }, [activeSection, ticketDateRange.startAt, ticketDateRange.endAt, ticketDateRange.error]);

  useEffect(() => {
    if (activeSection === 'history') {
      void refreshSessionSummary();
    }
    if (activeSection === 'products') {
      void loadManagedProducts();
    }
  }, [activeSection]);

  useEffect(() => {
    if (authStatus !== 'signedIn' || loading) {
      lastSyncRevisionRef.current = null;
      pendingSyncRevisionRef.current = null;
      if (syncRefreshTimeoutRef.current) {
        clearTimeout(syncRefreshTimeoutRef.current);
        syncRefreshTimeoutRef.current = null;
      }
      return;
    }

    let active = true;

    const clearScheduledSyncRefresh = () => {
      if (syncRefreshTimeoutRef.current) {
        clearTimeout(syncRefreshTimeoutRef.current);
        syncRefreshTimeoutRef.current = null;
      }
    };

    const scheduleSyncRefresh = (revision: number, delayOverride?: number) => {
      pendingSyncRevisionRef.current = revision;
      if (syncRefreshTimeoutRef.current) {
        return;
      }

      const elapsedSinceLastSync = Date.now() - lastOperationalSyncAtRef.current;
      const delay = delayOverride ?? Math.max(0, DATA_SYNC_MIN_REFRESH_INTERVAL_MS - elapsedSinceLastSync);
      syncRefreshTimeoutRef.current = setTimeout(() => {
        syncRefreshTimeoutRef.current = null;
        const pendingRevision = pendingSyncRevisionRef.current;
        if (pendingRevision !== null) {
          void synchronizeChangedRevision(pendingRevision);
        }
      }, delay);
    };

    async function synchronizeChangedRevision(revision: number): Promise<void> {
      if (!active) {
        return;
      }

      if (isRefreshingDataRef.current) {
        scheduleSyncRefresh(revision, 250);
        return;
      }

      const elapsedSinceLastSync = Date.now() - lastOperationalSyncAtRef.current;
      if (elapsedSinceLastSync < DATA_SYNC_MIN_REFRESH_INTERVAL_MS) {
        scheduleSyncRefresh(revision);
        return;
      }

      pendingSyncRevisionRef.current = null;
      const refreshed = await refreshOperationalData({ showError: false });
      if (!active) {
        return;
      }

      if (refreshed) {
        lastSyncRevisionRef.current = revision;
      } else {
        scheduleSyncRefresh(revision, DATA_SYNC_SIGNAL_INTERVAL_MS);
      }
    }

    const checkSyncRevision = async () => {
      if (!active || isCheckingSyncRevisionRef.current || isRefreshingDataRef.current) {
        return;
      }

      isCheckingSyncRevisionRef.current = true;
      try {
        const syncRevision = await apiService.fetchSyncRevision();
        const previousRevision = lastSyncRevisionRef.current;

        if (previousRevision === null) {
          lastSyncRevisionRef.current = syncRevision.revision;
          lastOperationalSyncAtRef.current = Date.now();
          return;
        }

        if (syncRevision.revision !== previousRevision) {
          await synchronizeChangedRevision(syncRevision.revision);
        }
      } catch {
        // The regular refresh path handles visible connection errors.
      } finally {
        isCheckingSyncRevisionRef.current = false;
      }
    };

    void checkSyncRevision();
    const interval = setInterval(checkSyncRevision, DATA_SYNC_SIGNAL_INTERVAL_MS);
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void checkSyncRevision();
      }
    });

    let visibilityHandler: (() => void) | null = null;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      visibilityHandler = () => {
        if (!document.hidden) {
          void checkSyncRevision();
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);
    }

    return () => {
      active = false;
      clearScheduledSyncRefresh();
      clearInterval(interval);
      appStateSubscription.remove();
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
      }
    };
  }, [activeSection, authStatus, loading, selectedTable.number, selectedTable.zone]);

  const connectionModal = (
    <Modal
      visible={isConnectionModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setIsConnectionModalVisible(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalPanel, styles.connectionPanel]}>
          <Text style={styles.modalTitle}>Conectar con el ordenador</Text>
          <Text style={styles.helperText}>
            En el ordenador, abre el TPV. En la terminal de inicio aparece el código de emparejamiento.
          </Text>
          <TextInput
            style={styles.connectionInput}
            value={apiBaseUrlDraft}
            onChangeText={setApiBaseUrlDraft}
            placeholder="http://192.168.1.50:3000/api"
            placeholderTextColor="#6B7280"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          {isPairingScannerVisible ? (
            <View style={styles.scannerFrame}>
              <CameraView
                style={styles.scannerCamera}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={isHandlingPairScan ? undefined : handlePairingCodeScanned}
              />
              <Text style={styles.scannerHelp}>Apunta al código QR mostrado en el ordenador.</Text>
            </View>
          ) : null}
          <View style={styles.connectionActions}>
            {Platform.OS !== 'web' ? (
              <TouchableOpacity style={styles.primaryButton} onPress={() => void beginPairingScan()} disabled={isSavingConnection}>
                <Text style={styles.primaryButtonText}>Escanear QR</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void saveConnection(apiBaseUrlDraft)} disabled={isSavingConnection}>
              <Text style={styles.secondaryButtonText}>{isSavingConnection ? 'Comprobando...' : 'Conectar manualmente'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setIsConnectionModalVisible(false)}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

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
      <>
        <SafeAreaView style={styles.container}>
          <View style={styles.loginScreen}>
            <View style={styles.loginPanel}>
              <Text style={styles.loginTitle}>TPV Restaurante</Text>
              <Text style={styles.helperText}>Introduce el código de acceso para continuar.</Text>
              <Text style={styles.helperText}>{`Servidor: ${configuredApiBaseUrl}`}</Text>
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
              <TouchableOpacity style={styles.connectionSetupButton} onPress={openConnectionSetup}>
                <Text style={styles.secondaryButtonText}>Conectar con otro ordenador</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
        {connectionModal}
      </>
    );
  }

  if (loading) {
    return (
      <>
        <SafeAreaView style={styles.container}>
          <View style={styles.centered}>
            <Text style={styles.title}>Cargando...</Text>
            <Text style={styles.loadingConnectionHelp}>Si has cambiado de red, conecta el teléfono de nuevo.</Text>
            <TouchableOpacity style={styles.connectionSetupButton} onPress={openConnectionSetup}>
              <Text style={styles.secondaryButtonText}>Conectar con otro ordenador</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
        {connectionModal}
      </>
    );
  }

  const mainScreenProps: MainScreenProps = {
    activeSection,
    setActiveSection: navigateToSection,
    goBack,
    goHome,
    onConfigureConnection: openConnectionSetup,
    onLogout: () => void handleLogout(),
    onRefreshData: () => void refreshOperationalData({ showFeedback: true }),
    isRefreshingData,
    computerPairingUrl: getApiBaseUrl(),
    posScreenProps,
    sessionSummary,
    ticketHistorySummary,
    filteredPaidTickets,
    selectedPaidTicket,
    ticketSearchText,
    setTicketSearchText,
    ticketPeriodPreset,
    setTicketPeriodPreset,
    ticketCustomStartDate,
    setTicketCustomStartDate,
    ticketCustomEndDate,
    setTicketCustomEndDate,
    ticketDateRangeLabel: ticketDateRange.label,
    ticketDateRangeError: ticketDateRange.error,
    selectPaidTicket: setSelectedPaidTicket,
    clearSelectedPaidTicket: () => setSelectedPaidTicket(null),
    refreshSessionSummary,
    loadTicketHistory,
    printSimplifiedPaidTicket,
    downloadTicket,
    downloadFilteredTicketPdfs,
    managedCategories,
    managedMenuItems,
    productName,
    setProductName,
    productPrimaryName,
    setProductPrimaryName,
    productSecondaryName,
    setProductSecondaryName,
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
    updateProductDetails,
    updateProductName,
    updateProductDisplayNames,
    updateProductCategory,
    updateProductPrice,
    updateProductCost,
    updateProductImage,
    removeProductImage,
    removeProduct,
    formatDateTime,
    centsToCurrency,
  };

  return (
    <>
      {useMobilePosLayout
        ? <MobileMainScreen {...mainScreenProps} />
        : <DesktopMainScreen {...mainScreenProps} />}
      {connectionModal}
    </>
  );
}
