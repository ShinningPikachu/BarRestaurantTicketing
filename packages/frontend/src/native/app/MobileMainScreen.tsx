import React, { useEffect, useState } from 'react';
import { Image, Platform, RefreshControl, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MobilePosScreen, PrinterStatusPanel } from '../components';
import { AppSection, MainScreenProps } from './MainScreen.types';
import { mobileStyles as styles } from './MobileMain.styles';
import { MenuItem, PaidTicket, TicketPeriodPreset, normalizeTableZone, tableZoneLabel } from '../types';

type ProductEditValues = {
  name: string;
  primaryName: string;
  secondaryName: string;
  category: string;
  price: string;
  cost: string;
};

function getProductEditValues(item: MenuItem): ProductEditValues {
  return {
    name: item.name,
    primaryName: item.primaryName ?? '',
    secondaryName: item.secondaryName ?? '',
    category: item.category,
    price: (item.priceCents / 100).toFixed(2),
    cost: item.costCents !== null && item.costCents !== undefined ? (item.costCents / 100).toFixed(2) : '',
  };
}

function valuesChanged(first: ProductEditValues, second: ProductEditValues): boolean {
  return (
    first.name !== second.name ||
    first.primaryName !== second.primaryName ||
    first.secondaryName !== second.secondaryName ||
    first.category !== second.category ||
    first.price !== second.price ||
    first.cost !== second.cost
  );
}

const screenTitles: Record<AppSection, string> = {
  home: 'TPV Restaurante',
  pos: 'Venta',
  history: 'Tickets',
  products: 'Productos',
  printer: 'Impresora',
  'mobile-connect': 'Conectar movil',
};

const screenSubtitles: Record<AppSection, string> = {
  home: 'Elige la zona de trabajo',
  pos: 'Mesas, pedidos y cobro',
  history: 'Copias, PDF y resumen de caja',
  products: 'Menu, precios e imagenes',
  printer: 'Estado, cola y diagnósticos',
  'mobile-connect': 'Emparejar telefono',
};

function MobileHeader(props: MainScreenProps): React.JSX.Element {
  return (
    <View style={styles.headerBar}>
      <View style={styles.headerTitleBlock}>
        <Text style={styles.header}>{screenTitles[props.activeSection]}</Text>
        <Text style={styles.headerSubtitle}>{screenSubtitles[props.activeSection]}</Text>
      </View>
      <View style={styles.headerActions}>
        {props.activeSection === 'home' || props.activeSection === 'pos' ? (
          <TouchableOpacity style={styles.headerButton} onPress={props.onConfigureConnection}>
            <Text style={styles.secondaryButtonText}>Conectar</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.headerButton} onPress={props.onRefreshData} disabled={props.isRefreshingData}>
          <Text style={styles.secondaryButtonText}>{props.isRefreshingData ? '...' : 'Actualizar'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerButton} onPress={props.onLogout}>
          <Text style={styles.secondaryButtonText}>Salir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MobileBottomTabs({
  activeSection,
  setActiveSection,
  goHome,
}: {
  activeSection: AppSection;
  setActiveSection: (section: AppSection) => void;
  goHome: () => void;
}): React.JSX.Element {
  const tabs: Array<{ section: AppSection; label: string }> = [
    { section: 'home', label: 'Inicio' },
    { section: 'pos', label: 'TPV' },
    { section: 'history', label: 'Tickets' },
    { section: 'products', label: 'Productos' },
    { section: 'printer', label: 'Impresora' },
  ];

  return (
    <View style={styles.bottomTabs}>
      {tabs.map((tab) => {
        const isSelected = activeSection === tab.section;
        return (
          <TouchableOpacity
            key={tab.section}
            style={[styles.bottomTabButton, isSelected && styles.bottomTabButtonSelected]}
            onPress={() => tab.section === 'home' ? goHome() : setActiveSection(tab.section)}
            activeOpacity={0.8}
          >
            <Text style={[styles.bottomTabText, isSelected && styles.bottomTabTextSelected]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MobileHomeScreen(props: MainScreenProps): React.JSX.Element {
  return (
    <ScrollView contentContainerStyle={styles.homeGrid}>
      <TouchableOpacity style={styles.homeButton} onPress={() => props.setActiveSection('pos')}>
        <Text style={styles.homeButtonTitle}>TPV</Text>
        <Text style={styles.homeButtonText}>Mesas, menu, pedidos y pagos.</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.homeButton} onPress={() => props.setActiveSection('history')}>
        <Text style={styles.homeButtonTitle}>Historial de tickets</Text>
        <Text style={styles.homeButtonText}>Buscar tickets pagados, imprimir copias y crear PDF.</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.homeButton} onPress={() => props.setActiveSection('products')}>
        <Text style={styles.homeButtonTitle}>Productos</Text>
        <Text style={styles.homeButtonText}>Añadir productos, tipos, precios e imagenes.</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.homeButton} onPress={() => props.setActiveSection('printer')}>
        <Text style={styles.homeButtonTitle}>Impresora</Text>
        <Text style={styles.homeButtonText}>Comprobar conexión, cola y prueba segura.</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const ticketPeriodOptions: Array<{ value: TicketPeriodPreset; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'thisWeek', label: 'Semana' },
  { value: 'thisMonth', label: 'Mes' },
  { value: 'previousMonth', label: 'Mes ant.' },
  { value: 'custom', label: 'Fechas' },
];

function getPaymentLabel(method: string): string {
  return method === 'cash' ? 'Efectivo' : method === 'card' ? 'Tarjeta' : method;
}

function getStatusLabel(status: string | null | undefined): string {
  if (status === 'refunded') return 'Devuelto';
  if (status === 'cancelled') return 'Cancelado';
  return 'Cobrado';
}

function getModeLabel(mode: string): string {
  if (mode === 'aa') return 'AA/parcial';
  if (mode === 'split') return 'Dividida';
  return 'Completo';
}

function getTicketBusinessLine(ticket: PaidTicket): string {
  return [
    ticket.tradeName,
    ticket.businessName,
  ].filter(Boolean).join(' · ') || 'Empresa no registrada';
}

function getTicketBusinessTaxId(ticket: PaidTicket): string {
  return ticket.businessTaxId || 'No registrado';
}

function getTicketLineSummary(ticket: PaidTicket): string {
  return ticket.items.map((item) => `${item.qty}x ${item.name}`).join(', ');
}

function MobileTicketPeriodControls(props: MainScreenProps): React.JSX.Element {
  return (
    <View style={styles.historyFiltersPanel}>
      <View style={styles.periodButtonRow}>
        {ticketPeriodOptions.map((option) => {
          const selected = props.ticketPeriodPreset === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.periodButton, selected ? styles.periodButtonSelected : null]}
              onPress={() => props.setTicketPeriodPreset(option.value)}
            >
              <Text style={[styles.periodButtonText, selected ? styles.periodButtonTextSelected : null]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {props.ticketPeriodPreset === 'custom' ? (
        <View style={styles.customDateRow}>
          <TextInput
            style={[styles.formInput, styles.dateInput]}
            value={props.ticketCustomStartDate}
            onChangeText={props.setTicketCustomStartDate}
            placeholder="AAAA-MM-DD inicio"
            placeholderTextColor="#6B7280"
          />
          <TextInput
            style={[styles.formInput, styles.dateInput]}
            value={props.ticketCustomEndDate}
            onChangeText={props.setTicketCustomEndDate}
            placeholder="AAAA-MM-DD fin"
            placeholderTextColor="#6B7280"
          />
        </View>
      ) : null}
      <View style={styles.historyToolbar}>
        <TextInput
          style={[styles.menuSearchInput, styles.historySearchInput]}
          value={props.ticketSearchText}
          onChangeText={props.setTicketSearchText}
          placeholder="Buscar numero, NIF, mesa, pago o producto"
          placeholderTextColor="#6B7280"
        />
        <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.loadTicketHistory()}>
          <Text style={styles.secondaryButtonText}>Actualizar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MobileHistorySummary(props: MainScreenProps): React.JSX.Element {
  const summary = props.ticketHistorySummary;
  return (
    <View style={styles.sessionSummaryPanel}>
      <View style={styles.summaryTopRow}>
        <View style={styles.flex1}>
          <Text style={styles.itemName}>Resultado financiero</Text>
          <Text style={styles.itemPrice}>{props.ticketDateRangeLabel}</Text>
          {props.ticketDateRangeError ? <Text style={styles.errorText}>{props.ticketDateRangeError}</Text> : null}
        </View>
        <View style={styles.summaryTotalBlock}>
          <Text style={styles.totalText}>{props.centsToCurrency(summary.totalCents)}</Text>
          <Text style={styles.itemPrice}>{`${summary.ticketCount} tickets`}</Text>
        </View>
      </View>
      <View style={styles.sessionSummaryGrid}>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatLabel}>Base</Text>
          <Text style={styles.summaryStatValue}>{props.centsToCurrency(summary.taxableBaseCents)}</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatLabel}>IVA</Text>
          <Text style={styles.summaryStatValue}>{props.centsToCurrency(summary.vatCents)}</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatLabel}>Efectivo</Text>
          <Text style={styles.summaryStatValue}>{props.centsToCurrency(summary.paymentTotals.cash)}</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatLabel}>Tarjeta</Text>
          <Text style={styles.summaryStatValue}>{props.centsToCurrency(summary.paymentTotals.card)}</Text>
        </View>
      </View>
      <View style={styles.historyInlineActions}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.printFilteredTicketSummary()} disabled={summary.ticketCount === 0}>
          <Text style={styles.secondaryButtonText}>Imprimir resumen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.downloadFilteredTicketPdfs()}>
          <Text style={styles.secondaryButtonText}>Exportar PDFs</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MobileTicketDetail({ ticket, props }: { ticket: PaidTicket; props: MainScreenProps }): React.JSX.Element {
  return (
    <View style={styles.ticketDetailPanel}>
      <View style={styles.historyCardHeader}>
        <View style={styles.flex1}>
          <Text style={styles.itemName}>{ticket.ticketNumber}</Text>
          <Text style={styles.itemPrice}>{`${getTicketBusinessLine(ticket)} · NIF ${getTicketBusinessTaxId(ticket)}`}</Text>
        </View>
        <TouchableOpacity style={styles.secondaryButton} onPress={props.clearSelectedPaidTicket}>
          <Text style={styles.secondaryButtonText}>Cerrar</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.ticketDetailGrid}>
        <Text style={styles.itemPrice}>{`Fecha: ${props.formatDateTime(ticket.createdAt)}`}</Text>
        <Text style={styles.itemPrice}>{`Mesa: ${tableZoneLabel(normalizeTableZone(ticket.tableZone))} ${ticket.tableNumber}`}</Text>
        <Text style={styles.itemPrice}>{`Pago: ${getPaymentLabel(ticket.method)} · ${getModeLabel(ticket.mode)}`}</Text>
        <Text style={styles.itemPrice}>{`Estado: ${getStatusLabel(ticket.status)}`}</Text>
        <Text style={styles.itemPrice}>{`Terminal: ${ticket.terminalId || 'No registrado'}`}</Text>
        <Text style={styles.itemPrice}>{`Cajero: ${ticket.cashierName || 'No registrado'}`}</Text>
        <Text style={styles.itemPrice}>{`Cliente: ${ticket.customerName || 'No registrado'} · NIF ${ticket.customerTaxId || 'No registrado'}`}</Text>
        <Text style={styles.itemPrice}>{`Relacionado: ${ticket.relatedTicketNumber || 'No aplica'}`}</Text>
        <Text style={styles.itemPrice}>{`PDF: ${ticket.pdfFileReference || 'Generado desde datos estructurados'}`}</Text>
        <Text style={styles.itemPrice}>{`ID auditoria: ${ticket.id}`}</Text>
      </View>
      <View style={styles.ticketDetailTotals}>
        <Text style={styles.itemPrice}>{`Base ${props.centsToCurrency(ticket.taxableBaseCents)}`}</Text>
        <Text style={styles.itemPrice}>{`IVA ${props.centsToCurrency(ticket.vatCents)}`}</Text>
        <Text style={styles.totalText}>{props.centsToCurrency(ticket.totalCents)}</Text>
      </View>
      {ticket.items.map((item) => {
        const lineBase = Math.round(item.totalPriceCents / (1 + ticket.vatRatePercent / 100));
        const lineVat = item.totalPriceCents - lineBase;
        return (
          <View key={item.id} style={styles.ticketLineRow}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.itemPrice}>{`${item.qty} x ${props.centsToCurrency(item.unitPriceCents)} · Base ${props.centsToCurrency(lineBase)} · IVA ${props.centsToCurrency(lineVat)} · ${props.centsToCurrency(item.totalPriceCents)}`}</Text>
          </View>
        );
      })}
      <View style={styles.historyInlineActions}>
        <TouchableOpacity style={[styles.secondaryButton, props.ticketPrintCoolingDown && styles.disabledButton]} onPress={() => void props.printSimplifiedPaidTicket(ticket)} disabled={props.ticketPrintCoolingDown}>
          <Text style={styles.secondaryButtonText}>Imprimir</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.downloadTicket(ticket)}>
          <Text style={styles.secondaryButtonText}>PDF fiscal</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MobileHistoryScreen(props: MainScreenProps): React.JSX.Element {
  const refreshControl = <RefreshControl refreshing={props.isRefreshingData} onRefresh={props.onRefreshData} />;

  return (
    <View style={styles.fullPanel}>
      <MobileTicketPeriodControls {...props} />
      <MobileHistorySummary {...props} />
      {props.selectedPaidTicket ? <MobileTicketDetail ticket={props.selectedPaidTicket} props={props} /> : null}

      <ScrollView style={styles.columnScroll} contentContainerStyle={styles.listContent} refreshControl={refreshControl}>
        {props.filteredPaidTickets.map((ticket) => (
          <View key={ticket.id} style={styles.historyRow}>
            <View style={styles.historyCardHeader}>
              <View style={styles.flex1}>
                <Text style={styles.itemName}>{ticket.ticketNumber}</Text>
                <Text style={styles.itemPrice}>
                  {`${getPaymentLabel(ticket.method)} · ${getModeLabel(ticket.mode)} · ${getStatusLabel(ticket.status)}`}
                </Text>
              </View>
              <Text style={styles.totalText}>{props.centsToCurrency(ticket.totalCents)}</Text>
            </View>
            <Text style={styles.itemPrice}>{`${props.formatDateTime(ticket.createdAt)} · Mesa ${tableZoneLabel(normalizeTableZone(ticket.tableZone))} ${ticket.tableNumber}`}</Text>
            <Text style={styles.itemPrice}>{`${getTicketBusinessLine(ticket)} · NIF ${getTicketBusinessTaxId(ticket)}`}</Text>
            <Text style={styles.itemPrice}>{`Base ${props.centsToCurrency(ticket.taxableBaseCents)} · IVA ${props.centsToCurrency(ticket.vatCents)} · PDF ${ticket.pdfFileReference || 'generable'}`}</Text>
            <Text style={styles.itemPrice} numberOfLines={2}>{getTicketLineSummary(ticket)}</Text>
            <View style={styles.historyInlineActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => props.selectPaidTicket(ticket)}>
                <Text style={styles.secondaryButtonText}>Detalle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryButton, props.ticketPrintCoolingDown && styles.disabledButton]} onPress={() => void props.printSimplifiedPaidTicket(ticket)} disabled={props.ticketPrintCoolingDown}>
                <Text style={styles.secondaryButtonText}>Imprimir ticket</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.downloadTicket(ticket)}>
                <Text style={styles.secondaryButtonText}>PDF completo</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {props.filteredPaidTickets.length === 0 ? <Text style={styles.emptyText}>No hay tickets.</Text> : null}
      </ScrollView>
    </View>
  );
}

function MobileProductEditRow({ item, props }: { item: MenuItem; props: MainScreenProps }): React.JSX.Element {
  const [values, setValues] = useState<ProductEditValues>(() => getProductEditValues(item));
  const [savedValues, setSavedValues] = useState<ProductEditValues>(() => getProductEditValues(item));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    const nextValues = getProductEditValues(item);
    setValues(nextValues);
    setSavedValues(nextValues);
    setSaveState((current) => current === 'saving' || current === 'saved' ? 'saved' : 'idle');
  }, [item.id, item.name, item.primaryName, item.secondaryName, item.category, item.priceCents, item.costCents]);

  const hasChanges = valuesChanged(values, savedValues);
  const saveDisabled = !hasChanges || saveState === 'saving';
  const statusText = saveState === 'saving' ? 'Guardando...' : saveState === 'saved' ? 'Guardado' : hasChanges ? 'Cambios sin guardar' : 'Sin cambios';

  const updateValue = (field: keyof ProductEditValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setSaveState('idle');
  };

  const saveChanges = async () => {
    if (saveDisabled) {
      return;
    }

    setSaveState('saving');
    const didSave = await props.updateProductDetails(item, values);
    if (didSave) {
      setSavedValues(values);
      setSaveState('saved');
      return;
    }
    setSaveState('idle');
  };

  return (
    <View style={styles.productRow}>
      {item.imageDataUrl ? (
        <Image source={{ uri: item.imageDataUrl }} style={styles.productRowImage} resizeMode="contain" />
      ) : (
        <View style={styles.productRowImagePlaceholder}>
          <Text style={styles.itemPrice}>Sin imagen</Text>
        </View>
      )}
      <View style={styles.productRowBody}>
        <View style={styles.productRowTopLine}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          <TextInput
            style={styles.productCategoryInput}
            value={values.category}
            onChangeText={(value) => updateValue('category', value)}
            placeholder="Tipo"
            placeholderTextColor="#6B7280"
          />
        </View>
        <View style={styles.productEditRow}>
          <TextInput
            style={styles.formInput}
            value={values.name}
            onChangeText={(value) => updateValue('name', value)}
            placeholder="Nombre"
            placeholderTextColor="#6B7280"
          />
          <TextInput
            style={[styles.formInput, styles.formHalfInput]}
            value={values.primaryName}
            onChangeText={(value) => updateValue('primaryName', value)}
            placeholder="Principal"
            placeholderTextColor="#6B7280"
          />
          <TextInput
            style={[styles.formInput, styles.formHalfInput]}
            value={values.secondaryName}
            onChangeText={(value) => updateValue('secondaryName', value)}
            placeholder="Secundario"
            placeholderTextColor="#6B7280"
          />
        </View>
        <View style={styles.productRowControls}>
          <TextInput style={styles.priceInput} value={values.price} keyboardType="decimal-pad" onChangeText={(value) => updateValue('price', value)} placeholder="Precio" placeholderTextColor="#6B7280" />
          <TextInput style={styles.priceInput} value={values.cost} keyboardType="decimal-pad" placeholder="Coste" placeholderTextColor="#6B7280" onChangeText={(value) => updateValue('cost', value)} />
          <TouchableOpacity style={[styles.productRowActionButton, styles.productSaveChangesButton, saveDisabled ? styles.productSaveChangesButtonDisabled : null]} onPress={() => void saveChanges()} disabled={saveDisabled}>
            <Text style={[styles.productSaveChangesText, saveDisabled ? styles.productSaveChangesTextDisabled : null]}>{saveState === 'saving' ? 'Guardando' : 'Guardar'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.productRowActionButton} onPress={() => void props.updateProductImage(item)}>
            <Text style={styles.secondaryButtonText}>{item.imageDataUrl ? 'Cambiar' : 'Imagen'}</Text>
          </TouchableOpacity>
          {item.imageDataUrl ? (
            <TouchableOpacity style={styles.productRowActionButton} onPress={() => void props.removeProductImage(item)}>
              <Text style={styles.secondaryButtonText}>Quitar</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.productRowActionButton} onPress={() => props.removeProduct(item)}>
            <Text style={styles.secondaryButtonText}>Eliminar</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.productSaveStatus, saveState === 'saved' ? styles.productSaveStatusSuccess : null]}>{statusText}</Text>
      </View>
    </View>
  );
}

function MobileProductsScreen(props: MainScreenProps): React.JSX.Element {
  const refreshControl = <RefreshControl refreshing={props.isRefreshingData} onRefresh={props.onRefreshData} />;

  return (
    <View style={styles.fullPanel}>
      <ScrollView style={styles.columnScroll} contentContainerStyle={styles.productsContent} showsVerticalScrollIndicator refreshControl={refreshControl}>
        <View style={styles.productForm}>
          <View style={styles.productFormHeader}>
            <Text style={styles.subTitle}>Nuevo producto</Text>
            <TouchableOpacity style={styles.compactSecondaryButton} onPress={props.importProductsCsv}>
              <Text style={styles.secondaryButtonText}>CSV</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.formTwoColumnRow}>
            <TextInput style={[styles.formInput, styles.formWideInput]} value={props.productName} onChangeText={props.setProductName} placeholder="Nombre" placeholderTextColor="#6B7280" />
            <TextInput style={[styles.formInput, styles.formHalfInput]} value={props.productPrimaryName} onChangeText={props.setProductPrimaryName} placeholder="Principal" placeholderTextColor="#6B7280" />
            <TextInput style={[styles.formInput, styles.formHalfInput]} value={props.productSecondaryName} onChangeText={props.setProductSecondaryName} placeholder="Secundario" placeholderTextColor="#6B7280" />
          </View>
          <View style={styles.formTwoColumnRow}>
            <TextInput style={[styles.formInput, styles.formCompactInput]} value={props.productCategory} onChangeText={props.setProductCategory} placeholder="Tipo" placeholderTextColor="#6B7280" />
            <TextInput style={[styles.formInput, styles.formHalfInput]} value={props.productPrice} onChangeText={props.setProductPrice} placeholder="Precio" placeholderTextColor="#6B7280" keyboardType="decimal-pad" />
            <TextInput style={[styles.formInput, styles.formHalfInput]} value={props.productCost} onChangeText={props.setProductCost} placeholder="Coste" placeholderTextColor="#6B7280" keyboardType="decimal-pad" />
            <TextInput style={[styles.formInput, styles.formHalfInput]} value={props.productSku} onChangeText={props.setProductSku} placeholder="SKU" placeholderTextColor="#6B7280" />
          </View>
          <TextInput style={styles.formInput} value={props.productDescription} onChangeText={props.setProductDescription} placeholder="Descripcion opcional" placeholderTextColor="#6B7280" />
          <View style={styles.productImagePicker}>
            {props.productImageDataUrl ? (
              <Image source={{ uri: props.productImageDataUrl }} style={styles.productImagePreview} resizeMode="contain" />
            ) : (
              <View style={styles.productImagePlaceholder}>
                <Text style={styles.itemPrice}>Imagen</Text>
              </View>
            )}
            <View style={styles.productImageActions}>
              <TouchableOpacity style={styles.compactSecondaryButton} onPress={() => void props.chooseProductImage(props.setProductImageDataUrl)}>
                <Text style={styles.secondaryButtonText}>{props.productImageDataUrl ? 'Cambiar' : Platform.OS === 'web' ? 'Imagen' : 'Foto'}</Text>
              </TouchableOpacity>
              {props.productImageDataUrl ? (
                <TouchableOpacity style={styles.compactSecondaryButton} onPress={() => props.setProductImageDataUrl(null)}>
                  <Text style={styles.secondaryButtonText}>Quitar</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[styles.primaryButton, styles.productSaveButton]} onPress={() => void props.saveNewProduct()}>
                <Text style={styles.primaryButtonText}>Añadir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Text style={styles.compactSectionLabel}>Tipos</Text>
        <View style={styles.menuTypeSelector}>
          {props.managedCategories.map((category) => (
            <TouchableOpacity key={category} style={styles.menuTypeButton} onPress={() => props.setProductCategory(category)}>
              <Text style={styles.menuTypeButtonText}>{category}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.compactSectionLabel}>Menu actual</Text>
        {props.managedMenuItems.map((item) => (
          <MobileProductEditRow key={item.id} item={item} props={props} />
        ))}
      </ScrollView>
    </View>
  );
}

export function MobileMainScreen(props: MainScreenProps): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <MobileHeader {...props} />
      <View style={styles.screenBody}>
        {props.activeSection === 'home' ? <MobileHomeScreen {...props} /> : null}
        {props.activeSection === 'history' ? <MobileHistoryScreen {...props} /> : null}
        {props.activeSection === 'products' ? <MobileProductsScreen {...props} /> : null}
        {props.activeSection === 'printer' ? (
          <PrinterStatusPanel
            status={props.printerStatus}
            diagnostics={props.printerDiagnostics}
            action={props.printerAction}
            onRefresh={props.refreshPrinterStatus}
            onReconnect={props.reconnectPrinter}
            onTestPrint={props.runPrinterTest}
            onCancelPending={props.cancelPendingPrinterJobs}
            onOpenDiagnostics={props.openPrinterDiagnostics}
          />
        ) : null}
        {props.activeSection === 'pos' ? <MobilePosScreen {...props.posScreenProps} /> : null}
      </View>
      <MobileBottomTabs activeSection={props.activeSection} setActiveSection={props.setActiveSection} goHome={props.goHome} />
    </SafeAreaView>
  );
}
