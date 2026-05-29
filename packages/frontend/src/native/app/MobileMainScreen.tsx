import React from 'react';
import { Image, Platform, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MobilePosScreen } from '../components';
import { AppSection, MainScreenProps } from './MainScreen.types';
import { mobileStyles as styles } from './MobileMain.styles';

const screenTitles: Record<AppSection, string> = {
  home: 'TPV Restaurante',
  pos: 'Venta',
  history: 'Tickets',
  products: 'Productos',
  'mobile-connect': 'Conectar movil',
};

const screenSubtitles: Record<AppSection, string> = {
  home: 'Elige la zona de trabajo',
  pos: 'Mesas, pedidos y cobro',
  history: 'Copias, PDF y resumen de caja',
  products: 'Menu, precios e imagenes',
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
    <View style={styles.homeGrid}>
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
    </View>
  );
}

function MobileHistoryScreen(props: MainScreenProps): React.JSX.Element {
  return (
    <View style={styles.fullPanel}>
      {props.sessionSummary ? (
        <View style={styles.sessionSummaryPanel}>
          <View style={styles.summaryTopRow}>
            <View style={styles.flex1}>
              <Text style={styles.itemName}>{`Sesion ${props.sessionSummary.sessionDate}`}</Text>
              <Text style={styles.itemPrice}>
                {`${props.formatDateTime(props.sessionSummary.startAt)} - ${props.formatDateTime(props.sessionSummary.endAt)}`}
              </Text>
            </View>
            <View style={styles.summaryTotalBlock}>
              <Text style={styles.totalText}>{props.centsToCurrency(props.sessionSummary.totalCents)}</Text>
              <Text style={styles.itemPrice}>{`${props.sessionSummary.ticketCount} tickets`}</Text>
            </View>
          </View>
          <View style={styles.sessionSummaryGrid}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Efectivo</Text>
              <Text style={styles.summaryStatValue}>{props.centsToCurrency(props.sessionSummary.paymentTotals.cash)}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Tarjeta</Text>
              <Text style={styles.summaryStatValue}>{props.centsToCurrency(props.sessionSummary.paymentTotals.card)}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Base</Text>
              <Text style={styles.summaryStatValue}>{props.centsToCurrency(props.sessionSummary.taxableBaseCents)}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>IVA</Text>
              <Text style={styles.summaryStatValue}>{props.centsToCurrency(props.sessionSummary.vatCents)}</Text>
            </View>
          </View>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.subTitle}>Mas vendidos</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.refreshSessionSummary(true)}>
              <Text style={styles.secondaryButtonText}>Actualizar</Text>
            </TouchableOpacity>
          </View>
          {props.sessionSummary.items.slice(0, 6).map((item) => (
            <View key={item.name} style={styles.sessionSummaryRow}>
              <Text style={styles.itemPrice} numberOfLines={1}>{`${item.qty}x ${item.name}`}</Text>
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
          placeholder="Buscar ticket, mesa, pago o producto"
          placeholderTextColor="#6B7280"
        />
        <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.loadTicketHistory()}>
          <Text style={styles.secondaryButtonText}>Actualizar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.columnScroll} contentContainerStyle={styles.listContent}>
        {props.filteredPaidTickets.map((ticket) => (
          <View key={ticket.id} style={styles.historyRow}>
            <View style={styles.historyCardHeader}>
              <View style={styles.flex1}>
                <Text style={styles.itemName}>{ticket.ticketNumber}</Text>
                <Text style={styles.itemPrice}>
                  {`Mesa ${ticket.tableZone}-${ticket.tableNumber} · ${ticket.method === 'cash' ? 'Efectivo' : 'Tarjeta'}`}
                </Text>
              </View>
              <Text style={styles.totalText}>{props.centsToCurrency(ticket.totalCents)}</Text>
            </View>
            <Text style={styles.itemPrice}>{props.formatDateTime(ticket.createdAt)}</Text>
            <Text style={styles.itemPrice} numberOfLines={2}>{ticket.items.map((item) => `${item.qty}x ${item.name}`).join(', ')}</Text>
            <View style={styles.historyInlineActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => void props.printSimplifiedPaidTicket(ticket)}>
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

function MobileProductsScreen(props: MainScreenProps): React.JSX.Element {
  return (
    <View style={styles.fullPanel}>
      <ScrollView style={styles.columnScroll} contentContainerStyle={styles.productsContent} showsVerticalScrollIndicator>
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
              <View style={styles.productRowBody}>
                <View style={styles.productRowTopLine}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <TextInput
                    style={styles.productCategoryInput}
                    defaultValue={item.category}
                    onSubmitEditing={(event) => void props.updateProductCategory(item, event.nativeEvent.text)}
                    onEndEditing={(event) => void props.updateProductCategory(item, event.nativeEvent.text)}
                    placeholder="Tipo"
                    placeholderTextColor="#6B7280"
                  />
                </View>
                <View style={styles.productEditRow}>
                  <TextInput
                    style={styles.formInput}
                    defaultValue={item.name}
                    onSubmitEditing={(event) => void props.updateProductName(item, event.nativeEvent.text)}
                    onEndEditing={(event) => void props.updateProductName(item, event.nativeEvent.text)}
                    placeholder="Nombre"
                    placeholderTextColor="#6B7280"
                  />
                  <TextInput
                    style={[styles.formInput, styles.formHalfInput]}
                    defaultValue={primaryDraft}
                    onChangeText={(value) => { primaryDraft = value; }}
                    onSubmitEditing={saveDisplayNames}
                    onEndEditing={saveDisplayNames}
                    placeholder="Principal"
                    placeholderTextColor="#6B7280"
                  />
                  <TextInput
                    style={[styles.formInput, styles.formHalfInput]}
                    defaultValue={secondaryDraft}
                    onChangeText={(value) => { secondaryDraft = value; }}
                    onSubmitEditing={saveDisplayNames}
                    onEndEditing={saveDisplayNames}
                    placeholder="Secundario"
                    placeholderTextColor="#6B7280"
                  />
                </View>
                <View style={styles.productRowControls}>
                  <TextInput style={styles.priceInput} defaultValue={(item.priceCents / 100).toFixed(2)} keyboardType="decimal-pad" onSubmitEditing={(event) => void props.updateProductPrice(item, event.nativeEvent.text)} onEndEditing={(event) => void props.updateProductPrice(item, event.nativeEvent.text)} />
                  <TextInput style={styles.priceInput} defaultValue={item.costCents !== null && item.costCents !== undefined ? (item.costCents / 100).toFixed(2) : ''} keyboardType="decimal-pad" placeholder="Coste" placeholderTextColor="#6B7280" onSubmitEditing={(event) => void props.updateProductCost(item, event.nativeEvent.text)} onEndEditing={(event) => void props.updateProductCost(item, event.nativeEvent.text)} />
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
              </View>
            </View>
          );
        })}
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
        {props.activeSection === 'pos' ? <MobilePosScreen {...props.posScreenProps} /> : null}
      </View>
      <MobileBottomTabs activeSection={props.activeSection} setActiveSection={props.setActiveSection} goHome={props.goHome} />
    </SafeAreaView>
  );
}
