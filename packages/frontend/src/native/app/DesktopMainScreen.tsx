import React, { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Platform, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { toQR } from 'toqr';
import { DesktopPosScreen, PrinterStatusPanel } from '../components';
import { MainScreenProps } from './MainScreen.types';
import { desktopStyles as styles } from './DesktopMain.styles';
import { MenuItem, PaidTicket, TicketPeriodPreset, tableZoneLabel, normalizeTableZone } from '../types';

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

function DesktopProductEditRow({ item, props }: { item: MenuItem; props: MainScreenProps }): React.JSX.Element {
  const [values, setValues] = useState<ProductEditValues>(() => getProductEditValues(item));
  const [savedValues, setSavedValues] = useState<ProductEditValues>(() => getProductEditValues(item));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isExpanded, setIsExpanded] = useState(false);

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
      <TouchableOpacity
        style={styles.productRowSummary}
        onPress={() => setIsExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={`${isExpanded ? 'Cerrar edición de' : 'Editar'} ${item.name}`}
      >
        {item.imageDataUrl ? (
          <Image source={{ uri: item.imageDataUrl }} style={styles.productRowImage} resizeMode="contain" />
        ) : (
          <View style={styles.productRowImagePlaceholder}>
            <Text style={styles.itemPrice}>—</Text>
          </View>
        )}
        <View style={styles.productRowSummaryContent}>
          <View style={styles.productRowSummaryTitle}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.productRowSummaryPrice}>{props.centsToCurrency(item.priceCents)}</Text>
          </View>
          <Text style={styles.productRowMeta} numberOfLines={1}>
            {item.sku ? `${item.category} · SKU ${item.sku}` : item.category}
          </Text>
        </View>
        <View style={styles.productRowToggle}>
          <Text style={styles.secondaryButtonText}>{isExpanded ? 'Cerrar' : 'Editar'}</Text>
        </View>
      </TouchableOpacity>

      {isExpanded ? (
        <View style={styles.productRowEditor}>
          <TextInput
            style={[styles.formInput, styles.productFullNameInput]}
            value={values.name}
            onChangeText={(value) => updateValue('name', value)}
            placeholder="Nombre"
            placeholderTextColor="#6B7280"
          />
          <View style={styles.productNameEditRow}>
            <TextInput
              style={[styles.formInput, styles.productNameInput]}
              value={values.primaryName}
              onChangeText={(value) => updateValue('primaryName', value)}
              placeholder="Principal"
              placeholderTextColor="#6B7280"
            />
            <TextInput
              style={[styles.formInput, styles.productNameInput]}
              value={values.secondaryName}
              onChangeText={(value) => updateValue('secondaryName', value)}
              placeholder="Secundario"
              placeholderTextColor="#6B7280"
            />
          </View>
          <View style={styles.productEditorFields}>
            <TextInput
              style={[styles.formInput, styles.productEditorCategoryInput]}
              value={values.category}
              onChangeText={(value) => updateValue('category', value)}
              placeholder="Tipo"
              placeholderTextColor="#6B7280"
            />
            <TextInput style={styles.priceInput} value={values.price} keyboardType="decimal-pad" onChangeText={(value) => updateValue('price', value)} placeholder="Precio" placeholderTextColor="#6B7280" />
            <TextInput style={styles.priceInput} value={values.cost} keyboardType="decimal-pad" placeholder="Coste" placeholderTextColor="#6B7280" onChangeText={(value) => updateValue('cost', value)} />
          </View>
          <View style={styles.productEditorActions}>
            <TouchableOpacity style={[styles.secondaryButton, styles.productSaveChangesButton, saveDisabled ? styles.productSaveChangesButtonDisabled : null]} onPress={() => void saveChanges()} disabled={saveDisabled}>
              <Text style={[styles.productSaveChangesText, saveDisabled ? styles.productSaveChangesTextDisabled : null]}>{saveState === 'saving' ? 'Guardando...' : 'Guardar cambios'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.updateProductImage(item)}>
              <Text style={styles.secondaryButtonText}>{item.imageDataUrl ? 'Cambiar imagen' : 'Añadir imagen'}</Text>
            </TouchableOpacity>
            {item.imageDataUrl ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.removeProductImage(item)}>
                <Text style={styles.secondaryButtonText}>Quitar imagen</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.secondaryButton} onPress={() => props.removeProduct(item)}>
              <Text style={styles.secondaryButtonText}>Eliminar</Text>
            </TouchableOpacity>
            <Text style={[styles.productSaveStatus, saveState === 'saved' ? styles.productSaveStatusSuccess : null]}>{statusText}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function DesktopNewProductModal({
  props,
  visible,
  onClose,
}: {
  props: MainScreenProps;
  visible: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const saveProduct = async () => {
    if (await props.saveNewProduct()) {
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.productModalBackdrop}>
        <View style={styles.productModal}>
          <View style={styles.productModalHeader}>
            <Text style={styles.subTitle}>Nuevo producto</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.productModalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.productForm}>
              <View style={styles.productNameCreateRow}>
                <TextInput style={[styles.formInput, styles.productNameCreateInput]} value={props.productName} onChangeText={props.setProductName} placeholder="Nombre" placeholderTextColor="#6B7280" />
                <TextInput style={[styles.formInput, styles.productNameCreateInput]} value={props.productPrimaryName} onChangeText={props.setProductPrimaryName} placeholder="Nombre principal" placeholderTextColor="#6B7280" />
                <TextInput style={[styles.formInput, styles.productNameCreateInput]} value={props.productSecondaryName} onChangeText={props.setProductSecondaryName} placeholder="Nombre secundario" placeholderTextColor="#6B7280" />
              </View>
              <TextInput style={styles.formInput} value={props.productCategory} onChangeText={props.setProductCategory} placeholder="Tipo / categoria" placeholderTextColor="#6B7280" />
              <TextInput style={styles.formInput} value={props.productPrice} onChangeText={props.setProductPrice} placeholder="Precio" placeholderTextColor="#6B7280" keyboardType="decimal-pad" />
              <TextInput style={styles.formInput} value={props.productCost} onChangeText={props.setProductCost} placeholder="Coste interno" placeholderTextColor="#6B7280" keyboardType="decimal-pad" />
              <TextInput style={styles.formInput} value={props.productSku} onChangeText={props.setProductSku} placeholder="SKU opcional" placeholderTextColor="#6B7280" />
              <TextInput style={[styles.formInput, styles.formInputWide]} value={props.productDescription} onChangeText={props.setProductDescription} placeholder="Descripcion opcional" placeholderTextColor="#6B7280" />
              <View style={styles.productImagePicker}>
                {props.productImageDataUrl ? (
                  <Image source={{ uri: props.productImageDataUrl }} style={styles.productImagePreview} resizeMode="contain" />
                ) : (
                  <View style={styles.productImagePlaceholder}>
                    <Text style={styles.itemPrice}>Imagen</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.chooseProductImage(props.setProductImageDataUrl)}>
                  <Text style={styles.secondaryButtonText}>{props.productImageDataUrl ? 'Cambiar imagen' : Platform.OS === 'web' ? 'Añadir imagen' : 'Hacer foto'}</Text>
                </TouchableOpacity>
                {props.productImageDataUrl ? (
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => props.setProductImageDataUrl(null)}>
                    <Text style={styles.secondaryButtonText}>Quitar</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.menuTypeSelector}>
                {props.managedCategories.map((category) => (
                  <TouchableOpacity key={category} style={styles.menuTypeButton} onPress={() => props.setProductCategory(category)}>
                    <Text style={styles.menuTypeButtonText}>{category}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={() => void saveProduct()}>
                <Text style={styles.primaryButtonText}>Añadir producto</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PairingQrCode({ value }: { value: string }): React.JSX.Element {
  const qr = useMemo(() => {
    const modules = toQR(value);
    const size = Math.sqrt(modules.length);
    const rows: number[][] = [];

    for (let row = 0; row < size; row += 1) {
      const cells: number[] = [];
      for (let column = 0; column < size; column += 1) {
        cells.push(modules[row * size + column]);
      }
      rows.push(cells);
    }

    return rows;
  }, [value]);

  return (
    <View style={styles.pairingQr} accessibilityLabel={`QR de conexion ${value}`}>
      {qr.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.pairingQrRow}>
          {row.map((cell, columnIndex) => (
            <View
              key={`${rowIndex}-${columnIndex}`}
              style={[styles.pairingQrCell, cell ? styles.pairingQrCellDark : styles.pairingQrCellLight]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const ticketPeriodOptions: Array<{ value: TicketPeriodPreset; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'thisWeek', label: 'Esta semana' },
  { value: 'thisMonth', label: 'Este mes' },
  { value: 'previousMonth', label: 'Mes anterior' },
  { value: 'custom', label: 'Personalizado' },
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
  if (mode === 'aa') return 'Pago AA/parcial';
  if (mode === 'split') return 'Cuenta dividida';
  return 'Ticket completo';
}

function getTicketBusinessLine(ticket: PaidTicket): string {
  const business = [
    ticket.tradeName,
    ticket.businessName,
  ].filter(Boolean).join(' · ');
  return business || 'Empresa no registrada en el ticket';
}

function getTicketBusinessTaxId(ticket: PaidTicket): string {
  return ticket.businessTaxId || 'No registrado';
}

function getTicketLineSummary(ticket: PaidTicket): string {
  return ticket.items.map((item) => `${item.qty}x ${item.name}`).join(', ');
}

function DesktopHistorySummary(props: MainScreenProps): React.JSX.Element {
  const summary = props.ticketHistorySummary;
  return (
    <View style={styles.accountingSummaryPanel}>
      <View style={styles.accountingSummaryHeader}>
        <View style={styles.flex1}>
          <Text style={styles.itemName}>Resultado financiero</Text>
          <Text style={styles.itemPrice}>{props.ticketDateRangeLabel}</Text>
          {props.ticketDateRangeError ? <Text style={styles.errorText}>{props.ticketDateRangeError}</Text> : null}
        </View>
        <View style={styles.historyInlineActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.printFilteredTicketSummary()} disabled={summary.ticketCount === 0}>
            <Text style={styles.secondaryButtonText}>Imprimir resumen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void props.downloadFilteredTicketPdfs()}>
            <Text style={styles.primaryButtonText}>Exportar PDFs</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.accountingSummaryGrid}>
        <View style={styles.accountingStat}>
          <Text style={styles.accountingStatLabel}>Tickets</Text>
          <Text style={styles.accountingStatValue}>{summary.ticketCount}</Text>
        </View>
        <View style={styles.accountingStat}>
          <Text style={styles.accountingStatLabel}>Total</Text>
          <Text style={styles.accountingStatValue}>{props.centsToCurrency(summary.totalCents)}</Text>
        </View>
        <View style={styles.accountingStat}>
          <Text style={styles.accountingStatLabel}>Base imponible</Text>
          <Text style={styles.accountingStatValue}>{props.centsToCurrency(summary.taxableBaseCents)}</Text>
        </View>
        <View style={styles.accountingStat}>
          <Text style={styles.accountingStatLabel}>IVA</Text>
          <Text style={styles.accountingStatValue}>{props.centsToCurrency(summary.vatCents)}</Text>
        </View>
        <View style={styles.accountingStat}>
          <Text style={styles.accountingStatLabel}>Efectivo</Text>
          <Text style={styles.accountingStatValue}>{props.centsToCurrency(summary.paymentTotals.cash)}</Text>
        </View>
        <View style={styles.accountingStat}>
          <Text style={styles.accountingStatLabel}>Tarjeta</Text>
          <Text style={styles.accountingStatValue}>{props.centsToCurrency(summary.paymentTotals.card)}</Text>
        </View>
      </View>
    </View>
  );
}

function DesktopTicketPeriodControls(props: MainScreenProps): React.JSX.Element {
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
          placeholder="Buscar por numero, NIF, cliente, mesa, pago o producto"
          placeholderTextColor="#6B7280"
        />
        <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.loadTicketHistory()}>
          <Text style={styles.secondaryButtonText}>Actualizar tickets</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DesktopTicketDetail({ ticket, props }: { ticket: PaidTicket; props: MainScreenProps }): React.JSX.Element {
  return (
    <View style={styles.ticketDetailPanel}>
      <View style={styles.panelHeaderRow}>
        <View style={styles.flex1}>
          <Text style={styles.itemName}>{ticket.ticketNumber}</Text>
          <Text style={styles.itemPrice}>{`${getTicketBusinessLine(ticket)} · NIF ${getTicketBusinessTaxId(ticket)}`}</Text>
        </View>
        <View style={styles.historyInlineActions}>
          <TouchableOpacity style={[styles.secondaryButton, props.ticketPrintCoolingDown && styles.disabledButton]} onPress={() => void props.printSimplifiedPaidTicket(ticket)} disabled={props.ticketPrintCoolingDown}>
            <Text style={styles.secondaryButtonText}>Imprimir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.downloadTicket(ticket)}>
            <Text style={styles.secondaryButtonText}>PDF fiscal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={props.clearSelectedPaidTicket}>
            <Text style={styles.secondaryButtonText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.ticketDetailGrid}>
        <Text style={styles.itemPrice}>{`Fecha: ${props.formatDateTime(ticket.createdAt)}`}</Text>
        <Text style={styles.itemPrice}>{`Mesa: ${tableZoneLabel(normalizeTableZone(ticket.tableZone))} ${ticket.tableNumber}`}</Text>
        <Text style={styles.itemPrice}>{`Terminal: ${ticket.terminalId || 'No registrado'}`}</Text>
        <Text style={styles.itemPrice}>{`Cajero: ${ticket.cashierName || 'No registrado'}`}</Text>
        <Text style={styles.itemPrice}>{`Pago: ${getPaymentLabel(ticket.method)}`}</Text>
        <Text style={styles.itemPrice}>{`Estado: ${getStatusLabel(ticket.status)}`}</Text>
        <Text style={styles.itemPrice}>{`Modalidad: ${getModeLabel(ticket.mode)}`}</Text>
        <Text style={styles.itemPrice}>{`Cliente: ${ticket.customerName || 'No registrado'}`}</Text>
        <Text style={styles.itemPrice}>{`NIF cliente: ${ticket.customerTaxId || 'No registrado'}`}</Text>
        <Text style={styles.itemPrice}>{`Relacionado: ${ticket.relatedTicketNumber || 'No aplica'}`}</Text>
        <Text style={styles.itemPrice}>{`PDF: ${ticket.pdfFileReference || 'Generado desde datos estructurados'}`}</Text>
        <Text style={styles.itemPrice}>{`ID auditoria: ${ticket.id}`}</Text>
      </View>
      <View style={styles.ticketDetailTotals}>
        <Text style={styles.itemPrice}>{`Base: ${props.centsToCurrency(ticket.taxableBaseCents)}`}</Text>
        <Text style={styles.itemPrice}>{`IVA ${ticket.vatRatePercent}%: ${props.centsToCurrency(ticket.vatCents)}`}</Text>
        <Text style={styles.totalText}>{props.centsToCurrency(ticket.totalCents)}</Text>
      </View>
      <View style={styles.ticketLineHeader}>
        <Text style={[styles.ticketLineCell, styles.ticketLineName]}>Producto / servicio</Text>
        <Text style={styles.ticketLineCell}>Ud.</Text>
        <Text style={styles.ticketLineCell}>Precio</Text>
        <Text style={styles.ticketLineCell}>Base</Text>
        <Text style={styles.ticketLineCell}>IVA</Text>
        <Text style={styles.ticketLineCell}>Total</Text>
      </View>
      {ticket.items.map((item) => {
        const lineBase = Math.round(item.totalPriceCents / (1 + ticket.vatRatePercent / 100));
        const lineVat = item.totalPriceCents - lineBase;
        return (
          <View key={item.id} style={styles.ticketLineRow}>
            <View style={[styles.ticketLineCell, styles.ticketLineName]}>
              <Text style={styles.itemPrice}>{item.name}</Text>
              <Text style={styles.ticketLineMeta}>{`Pedido ${item.orderId || 'sin ref'} · Item ${item.orderItemId ?? 'sin ref'}`}</Text>
            </View>
            <Text style={styles.ticketLineCell}>{item.qty}</Text>
            <Text style={styles.ticketLineCell}>{props.centsToCurrency(item.unitPriceCents)}</Text>
            <Text style={styles.ticketLineCell}>{props.centsToCurrency(lineBase)}</Text>
            <Text style={styles.ticketLineCell}>{props.centsToCurrency(lineVat)}</Text>
            <Text style={styles.ticketLineCell}>{props.centsToCurrency(item.totalPriceCents)}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function DesktopMainScreen(props: MainScreenProps): React.JSX.Element {
  const [isNewProductModalVisible, setIsNewProductModalVisible] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.header}>TPV Restaurante</Text>
          <Text style={styles.headerSubtitle}>Venta y gestion del servicio</Text>
        </View>
        <View style={styles.headerActions}>
          {props.activeSection !== 'home' ? (
            <TouchableOpacity style={styles.headerButton} onPress={props.goBack}>
              <Text style={styles.secondaryButtonText}>Atras</Text>
            </TouchableOpacity>
          ) : null}
          {props.activeSection !== 'home' ? (
            <TouchableOpacity style={styles.headerButton} onPress={props.goHome}>
              <Text style={styles.secondaryButtonText}>Inicio</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.headerButton} onPress={props.onRefreshData} disabled={props.isRefreshingData}>
            <Text style={styles.secondaryButtonText}>{props.isRefreshingData ? 'Actualizando...' : 'Actualizar'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={props.onLogout}>
            <Text style={styles.secondaryButtonText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {props.activeSection === 'home' ? (
        <View style={styles.homeGrid}>
          <TouchableOpacity style={styles.homeButton} onPress={() => props.setActiveSection('pos')}>
            <Text style={styles.homeButtonTitle}>TPV</Text>
            <Text style={styles.homeButtonText}>Mesas, menu, pedidos, tickets y pagos.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeButton} onPress={() => props.setActiveSection('history')}>
            <Text style={styles.homeButtonTitle}>Historial de tickets</Text>
            <Text style={styles.homeButtonText}>Buscar tickets pagados y descargar copias.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeButton} onPress={() => props.setActiveSection('products')}>
            <Text style={styles.homeButtonTitle}>Productos</Text>
            <Text style={styles.homeButtonText}>Añadir productos, tipos y cambiar precios.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeButton} onPress={() => props.setActiveSection('printer')}>
            <Text style={styles.homeButtonTitle}>Impresora</Text>
            <Text style={styles.homeButtonText}>Estado, cola, prueba segura y diagnósticos.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeButton} onPress={() => props.setActiveSection('mobile-connect')}>
            <Text style={styles.homeButtonTitle}>Conectar movil</Text>
            <Text style={styles.homeButtonText}>Mostrar el QR para emparejar la app instalada del telefono.</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {props.activeSection === 'mobile-connect' ? (
        <View style={styles.pairingPanel}>
          <View style={styles.pairingContent}>
            <View style={styles.pairingTextBlock}>
              <Text style={styles.sectionTitle}>Conectar movil</Text>
              <Text style={styles.helperText}>En el telefono, abre la app instalada, toca Conectar y escanea este codigo.</Text>
              <Text style={styles.pairingAddress}>{props.computerPairingUrl}</Text>
              <Text style={styles.helperText}>Telefono y ordenador deben estar en la misma red Wi-Fi, o el telefono puede conectarse al punto Wi-Fi creado por este ordenador.</Text>
              <Text style={styles.helperText}>Sin router: activa el hotspot del ordenador, conecta el telefono a esa red y vuelve a abrir esta pantalla para usar la direccion correcta.</Text>
              <Text style={styles.helperText}>Si no escanea, escribe esta direccion manualmente en el telefono.</Text>
            </View>
            <PairingQrCode value={props.computerPairingUrl} />
          </View>
        </View>
      ) : null}

      {props.activeSection === 'history' ? (
        <View style={styles.fullPanel}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.sectionTitle}>Historial de tickets</Text>
            <Text style={styles.itemPrice}>{`${props.filteredPaidTickets.length} tickets visibles`}</Text>
          </View>
          <DesktopTicketPeriodControls {...props} />
          <DesktopHistorySummary {...props} />
          {props.selectedPaidTicket ? <DesktopTicketDetail ticket={props.selectedPaidTicket} props={props} /> : null}
          <ScrollView style={styles.columnScroll} contentContainerStyle={styles.historyListContent}>
            {props.filteredPaidTickets.map((ticket) => (
              <View key={ticket.id} style={styles.historyRow}>
                <View style={styles.flex1}>
                  <View style={styles.historyTicketTopLine}>
                    <Text style={styles.itemName}>{ticket.ticketNumber}</Text>
                    <Text style={styles.historyStatusPill}>{getStatusLabel(ticket.status)}</Text>
                  </View>
                  <Text style={styles.itemPrice}>{`${props.formatDateTime(ticket.createdAt)} · ${getPaymentLabel(ticket.method)} · ${getModeLabel(ticket.mode)}`}</Text>
                  <Text style={styles.itemPrice}>{`${getTicketBusinessLine(ticket)} · NIF ${getTicketBusinessTaxId(ticket)}`}</Text>
                  <Text style={styles.itemPrice}>{`Mesa ${tableZoneLabel(normalizeTableZone(ticket.tableZone))} ${ticket.tableNumber} · Terminal ${ticket.terminalId || 'No registrado'} · Cajero ${ticket.cashierName || 'No registrado'}`}</Text>
                  <Text style={styles.itemPrice} numberOfLines={1}>{getTicketLineSummary(ticket)}</Text>
                  <View style={styles.historyTaxLine}>
                    <Text style={styles.itemPrice}>{`Base ${props.centsToCurrency(ticket.taxableBaseCents)}`}</Text>
                    <Text style={styles.itemPrice}>{`IVA ${ticket.vatRatePercent}% ${props.centsToCurrency(ticket.vatCents)}`}</Text>
                    <Text style={styles.itemPrice}>{`PDF ${ticket.pdfFileReference || 'generable'}`}</Text>
                  </View>
                </View>
                <Text style={styles.totalText}>{props.centsToCurrency(ticket.totalCents)}</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => props.selectPaidTicket(ticket)}>
                  <Text style={styles.secondaryButtonText}>Detalle</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryButton, props.ticketPrintCoolingDown && styles.disabledButton]} onPress={() => void props.printSimplifiedPaidTicket(ticket)} disabled={props.ticketPrintCoolingDown}>
                  <Text style={styles.secondaryButtonText}>Imprimir</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.downloadTicket(ticket)}>
                  <Text style={styles.secondaryButtonText}>PDF</Text>
                </TouchableOpacity>
              </View>
            ))}
            {props.filteredPaidTickets.length === 0 ? <Text style={styles.emptyText}>No hay tickets.</Text> : null}
          </ScrollView>
        </View>
      ) : null}

      {props.activeSection === 'products' ? (
        <View style={styles.fullPanel}>
          <Text style={styles.sectionTitle}>Productos</Text>
          <View style={styles.panelHeaderRow}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setIsNewProductModalVisible(true)}>
              <Text style={styles.primaryButtonText}>Nuevo producto</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={props.importProductsCsv}>
              <Text style={styles.secondaryButtonText}>Importar CSV</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.productSearchRow}>
            <TextInput
              style={[styles.formInput, styles.productSearchInput]}
              value={props.productSearchText}
              onChangeText={props.setProductSearchText}
              placeholder="Buscar por nombre, tipo o SKU"
              placeholderTextColor="#6B7280"
              accessibilityLabel="Buscar productos"
            />
            {props.productSearchText ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={() => props.setProductSearchText('')}>
                <Text style={styles.secondaryButtonText}>Limpiar</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.productSearchCount}>{`${props.filteredManagedMenuItems.length} ${props.filteredManagedMenuItems.length === 1 ? 'producto' : 'productos'}`}</Text>
          </View>
          <ScrollView horizontal style={styles.productCategoryFilter} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productCategoryFilterList}>
            <TouchableOpacity
              style={[styles.menuTypeButton, !props.selectedProductCategory ? styles.menuTypeButtonSelected : null]}
              onPress={() => props.setSelectedProductCategory(null)}
            >
              <Text style={[styles.menuTypeButtonText, !props.selectedProductCategory ? styles.menuTypeButtonTextSelected : null]}>Todos</Text>
            </TouchableOpacity>
            {props.managedCategories.map((category) => {
              const isSelected = category === props.selectedProductCategory;
              return (
                <TouchableOpacity key={category} style={[styles.menuTypeButton, isSelected ? styles.menuTypeButtonSelected : null]} onPress={() => props.setSelectedProductCategory(category)}>
                  <Text style={[styles.menuTypeButtonText, isSelected ? styles.menuTypeButtonTextSelected : null]}>{category}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <ScrollView style={styles.columnScroll}>
            {props.filteredManagedMenuItems.map((item) => (
              <DesktopProductEditRow key={item.id} item={item} props={props} />
            ))}
            {props.filteredManagedMenuItems.length === 0 ? <Text style={styles.emptyText}>No hay productos que coincidan con la búsqueda.</Text> : null}
          </ScrollView>
        </View>
      ) : null}

      {props.activeSection === 'printer' ? (
        <View style={styles.fullPanel}>
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
        </View>
      ) : null}

      {props.activeSection === 'pos' ? <DesktopPosScreen {...props.posScreenProps} /> : null}
      <DesktopNewProductModal props={props} visible={isNewProductModalVisible} onClose={() => setIsNewProductModalVisible(false)} />
    </SafeAreaView>
  );
}
