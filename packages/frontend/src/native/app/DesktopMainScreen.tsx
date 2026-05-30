import React, { useMemo } from 'react';
import { Image, Platform, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { toQR } from 'toqr';
import { DesktopPosScreen } from '../components';
import { MainScreenProps } from './MainScreen.types';
import { desktopStyles as styles } from './DesktopMain.styles';

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

export function DesktopMainScreen(props: MainScreenProps): React.JSX.Element {
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
              <Text style={styles.helperText}>Telefono y ordenador deben estar en la misma red Wi-Fi. Si no escanea, escribe esta direccion manualmente en el telefono.</Text>
            </View>
            <PairingQrCode value={props.computerPairingUrl} />
          </View>
        </View>
      ) : null}

      {props.activeSection === 'history' ? (
        <View style={styles.fullPanel}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.sectionTitle}>Historial de tickets</Text>
          </View>
          {props.sessionSummary ? (
            <View style={styles.sessionSummaryPanel}>
              <View style={styles.panelHeaderRow}>
                <View style={styles.flex1}>
                  <Text style={styles.itemName}>{`Sesion ${props.sessionSummary.sessionDate}`}</Text>
                  <Text style={styles.itemPrice}>
                    {`${props.formatDateTime(props.sessionSummary.startAt)} - ${props.formatDateTime(props.sessionSummary.endAt)} · ${props.sessionSummary.ticketCount} tickets`}
                  </Text>
                </View>
                <View style={styles.historyInlineActions}>
                  <Text style={styles.totalText}>{props.centsToCurrency(props.sessionSummary.totalCents)}</Text>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.refreshSessionSummary(true)}>
                    <Text style={styles.secondaryButtonText}>Actualizar totales</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.sessionSummaryGrid}>
                <Text style={styles.itemPrice}>{`Efectivo: ${props.centsToCurrency(props.sessionSummary.paymentTotals.cash)}`}</Text>
                <Text style={styles.itemPrice}>{`Tarjeta: ${props.centsToCurrency(props.sessionSummary.paymentTotals.card)}`}</Text>
                <Text style={styles.itemPrice}>{`Base: ${props.centsToCurrency(props.sessionSummary.taxableBaseCents)}`}</Text>
                <Text style={styles.itemPrice}>{`IVA: ${props.centsToCurrency(props.sessionSummary.vatCents)}`}</Text>
              </View>
              <Text style={styles.subTitle}>Productos vendidos</Text>
              {props.sessionSummary.items.slice(0, 8).map((item) => (
                <View key={item.name} style={styles.sessionSummaryRow}>
                  <Text style={styles.itemPrice}>{`${item.qty}x ${item.name}`}</Text>
                  <Text style={styles.itemPrice}>{props.centsToCurrency(item.totalCents)}</Text>
                </View>
              ))}
              {props.sessionSummary.items.length === 0 ? <Text style={styles.emptyText}>No hay ventas en esta sesion.</Text> : null}
            </View>
          ) : null}
          <View style={styles.historyToolbar}>
            <TextInput
              style={[styles.menuSearchInput, styles.historySearchInput]}
              value={props.ticketSearchText}
              onChangeText={props.setTicketSearchText}
              placeholder="Buscar por numero, mesa, pago o producto"
              placeholderTextColor="#6B7280"
            />
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.loadTicketHistory()}>
              <Text style={styles.secondaryButtonText}>Actualizar tickets</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.columnScroll}>
            {props.filteredPaidTickets.map((ticket) => (
              <View key={ticket.id} style={styles.historyRow}>
                <View style={styles.flex1}>
                  <Text style={styles.itemName}>{ticket.ticketNumber}</Text>
                  <Text style={styles.itemPrice}>
                    {`Mesa ${ticket.tableZone}-${ticket.tableNumber} · ${props.formatDateTime(ticket.createdAt)} · ${ticket.method === 'cash' ? 'Efectivo' : 'Tarjeta'}`}
                  </Text>
                  <Text style={styles.itemPrice}>{ticket.items.map((item) => `${item.qty}x ${item.name}`).join(', ')}</Text>
                </View>
                <Text style={styles.totalText}>{props.centsToCurrency(ticket.totalCents)}</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.printSimplifiedPaidTicket(ticket)}>
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
            <Text style={styles.helperText}>CSV recomendado: name, price, cost, sku, category, description, available</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={props.importProductsCsv}>
              <Text style={styles.secondaryButtonText}>Importar CSV</Text>
            </TouchableOpacity>
          </View>
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
            <TouchableOpacity style={styles.primaryButton} onPress={() => void props.saveNewProduct()}>
              <Text style={styles.primaryButtonText}>Añadir producto</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.menuTypeSelector}>
            {props.managedCategories.map((category) => (
              <TouchableOpacity key={category} style={styles.menuTypeButton} onPress={() => props.setProductCategory(category)}>
                <Text style={styles.menuTypeButtonText}>{category}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView style={styles.columnScroll}>
            {props.managedMenuItems.map((item) => {
              let primaryDraft = item.primaryName ?? '';
              let secondaryDraft = item.secondaryName ?? '';
              const saveDisplayNames = () => void props.updateProductDisplayNames(item, primaryDraft, secondaryDraft);

              return (
                <View key={item.id} style={styles.productRow}>
                  {item.imageDataUrl ? (
                    <Image source={{ uri: item.imageDataUrl }} style={styles.productRowImage} resizeMode="contain" />
                  ) : (
                    <View style={styles.productRowImagePlaceholder}>
                      <Text style={styles.itemPrice}>Sin imagen</Text>
                    </View>
                  )}
                  <View style={styles.flex1}>
                    <TextInput
                      style={[styles.formInput, styles.productFullNameInput]}
                      defaultValue={item.name}
                      onSubmitEditing={(event) => void props.updateProductName(item, event.nativeEvent.text)}
                      onEndEditing={(event) => void props.updateProductName(item, event.nativeEvent.text)}
                      placeholder="Nombre"
                      placeholderTextColor="#6B7280"
                    />
                    <View style={styles.productNameEditRow}>
                      <TextInput
                        style={[styles.formInput, styles.productNameInput]}
                        defaultValue={primaryDraft}
                        onChangeText={(value) => { primaryDraft = value; }}
                        onSubmitEditing={saveDisplayNames}
                        onEndEditing={saveDisplayNames}
                        placeholder="Principal"
                        placeholderTextColor="#6B7280"
                      />
                      <TextInput
                        style={[styles.formInput, styles.productNameInput]}
                        defaultValue={secondaryDraft}
                        onChangeText={(value) => { secondaryDraft = value; }}
                        onSubmitEditing={saveDisplayNames}
                        onEndEditing={saveDisplayNames}
                        placeholder="Secundario"
                        placeholderTextColor="#6B7280"
                      />
                    </View>
                    <TextInput
                      style={styles.formInput}
                      defaultValue={item.category}
                      onSubmitEditing={(event) => void props.updateProductCategory(item, event.nativeEvent.text)}
                      onEndEditing={(event) => void props.updateProductCategory(item, event.nativeEvent.text)}
                      placeholder="Tipo"
                      placeholderTextColor="#6B7280"
                    />
                  </View>
                  <TextInput style={styles.priceInput} defaultValue={(item.priceCents / 100).toFixed(2)} keyboardType="decimal-pad" onSubmitEditing={(event) => void props.updateProductPrice(item, event.nativeEvent.text)} onEndEditing={(event) => void props.updateProductPrice(item, event.nativeEvent.text)} />
                  <TextInput style={styles.priceInput} defaultValue={item.costCents !== null && item.costCents !== undefined ? (item.costCents / 100).toFixed(2) : ''} keyboardType="decimal-pad" placeholder="Coste" placeholderTextColor="#6B7280" onSubmitEditing={(event) => void props.updateProductCost(item, event.nativeEvent.text)} onEndEditing={(event) => void props.updateProductCost(item, event.nativeEvent.text)} />
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.updateProductImage(item)}>
                    <Text style={styles.secondaryButtonText}>{item.imageDataUrl ? 'Cambiar' : 'Imagen'}</Text>
                  </TouchableOpacity>
                  {item.imageDataUrl ? (
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.removeProductImage(item)}>
                      <Text style={styles.secondaryButtonText}>Quitar</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => props.removeProduct(item)}>
                    <Text style={styles.secondaryButtonText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {props.activeSection === 'pos' ? <DesktopPosScreen {...props.posScreenProps} /> : null}
    </SafeAreaView>
  );
}
