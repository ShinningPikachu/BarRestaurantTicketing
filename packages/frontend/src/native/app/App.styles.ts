import { StyleSheet } from 'react-native';
import { colors } from '../theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 12
  },
  compactHeaderBar: {
    minHeight: 38,
    marginBottom: 8
  },
  headerButton: {
    backgroundColor: colors.buttonSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  compactHeaderButton: {
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  header: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0
  },
  compactHeader: {
    fontSize: 17
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600'
  },
  loadingConnectionHelp: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center'
  },
  loginScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loginPanel: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 18
  },
  loginTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8
  },
  loginInput: {
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    marginBottom: 12,
    fontSize: 18
  },
  connectionSetupButton: {
    marginTop: 10,
    backgroundColor: colors.buttonSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  columnsContent: {
    flexGrow: 1,
    width: '100%',
    paddingBottom: 16
  },
  columnsScroll: {
    flex: 1
  },
  tablesColumn: {
    flex: 0.72,
    flexBasis: 0,
    minWidth: 292
  },
  menuColumn: {
    flex: 0.92,
    flexBasis: 0,
    minWidth: 312
  },
  ticketColumn: {
    flex: 1.28,
    flexBasis: 0,
    minWidth: 560
  },
  columns: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    minWidth: 1190
  },
  column: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10
  },
  desktopWorkspace: {
    flex: 1,
    minHeight: 0,
    gap: 10
  },
  mobilePosScreen: {
    flex: 1,
    minHeight: 0,
    gap: 8
  },
  mobileViewSwitch: {
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.buttonSecondary,
    padding: 4
  },
  mobileViewButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  mobileViewButtonSelected: {
    backgroundColor: colors.primary
  },
  mobileViewButtonText: {
    color: colors.buttonSecondaryText,
    fontSize: 13,
    fontWeight: '700'
  },
  mobileViewButtonTextSelected: {
    color: colors.textLight
  },
  mobilePager: {
    flex: 1,
    minHeight: 0
  },
  mobilePagerScroll: {
    flex: 1,
    minHeight: 0
  },
  mobilePagerContent: {
    alignItems: 'stretch'
  },
  mobilePagerPage: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 1
  },
  mobileSinglePanel: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8
  },
  mobilePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6
  },
  mobilePanelAction: {
    backgroundColor: colors.buttonSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minHeight: 42,
    justifyContent: 'center'
  },
  mobileBackButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    minHeight: 42,
    justifyContent: 'center'
  },
  mobilePanelActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  mobilePanelScroll: {
    flex: 1,
    minHeight: 0
  },
  mobileCartaLayout: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    gap: 6,
    overflow: 'hidden'
  },
  mobileCartaSidebar: {
    width: 72,
    flexShrink: 0,
    minHeight: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    padding: 5
  },
  mobileCartaSidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 5
  },
  mobileCartaSidebarTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700'
  },
  mobileCartaSidebarCount: {
    minWidth: 22,
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.zoneMenu,
    paddingHorizontal: 5,
    paddingVertical: 2
  },
  mobileCartaSidebarList: {
    flex: 1,
    minHeight: 0
  },
  mobileCartaSidebarItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: 5
  },
  mobileCartaSidebarQty: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '700'
  },
  mobileCartaSidebarName: {
    color: colors.text,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600'
  },
  mobileCartaSidebarEmpty: {
    color: colors.textTertiary,
    fontSize: 10,
    fontStyle: 'italic',
    lineHeight: 14
  },
  mobileCartaSidebarTotal: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
    marginBottom: 5
  },
  mobileCartaSidebarSendButton: {
    minHeight: 32,
    borderRadius: 7,
    backgroundColor: colors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  mobileCartaSidebarSendText: {
    color: colors.buttonPrimaryText,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center'
  },
  mobileCartaMenuPane: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden'
  },
  mobileTopPanel: {
    flex: 0.9,
    minHeight: 0,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12
  },
  mobileTicketPanel: {
    flex: 1.35,
    minHeight: 0,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12
  },
  mobileTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8
  },
  mobileGuidanceText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 7
  },
  mobilePanelTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700'
  },
  mobileModeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.buttonSecondary
  },
  mobileModeButton: {
    minWidth: 86,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center'
  },
  mobileModeButtonSelected: {
    backgroundColor: colors.primary
  },
  mobileModeButtonText: {
    color: colors.buttonSecondaryText,
    fontSize: 14,
    fontWeight: '700'
  },
  mobileModeButtonTextSelected: {
    color: colors.textLight
  },
  mobileTopScroll: {
    flex: 1
  },
  mobileOrderSection: {
    flex: 1,
    minHeight: 0
  },
  mobileOrderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 6,
    marginBottom: 6
  },
  mobileOrderScroll: {
    flex: 1,
    minHeight: 0
  },
  mobileOrderBlock: {
    marginBottom: 6
  },
  mobileOrderBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4
  },
  mobileOrderTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2
  },
  mobileOrderBlockTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700'
  },
  mobileOrderItemName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600'
  },
  mobileOrderItemPrice: {
    color: colors.textSecondary,
    fontSize: 12
  },
  mobileOrderTotal: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16
  },
  mobileBadge: {
    minWidth: 28,
    textAlign: 'center',
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.zoneMenu,
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  mobileOrderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginBottom: 6
  },
  mobileEditableOrderItem: {
    flexDirection: 'column',
    alignItems: 'stretch'
  },
  mobilePreorderMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  mobilePriceEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%'
  },
  mobilePriceInput: {
    width: 70,
    paddingHorizontal: 6,
    paddingVertical: 7,
    fontSize: 13
  },
  mobilePriceQuickActions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 4
  },
  mobilePriceQuickButton: {
    minWidth: 44,
    minHeight: 32,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  mobilePriceQuickButtonText: {
    color: colors.buttonSecondaryText,
    fontWeight: '700',
    fontSize: 11
  },
  mobileStickyActions: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8
  },
  mobileCheckoutPanel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: 6,
    marginTop: 6,
    gap: 5
  },
  mobileCheckoutTotalField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.zoneMenu,
    paddingHorizontal: 8,
    paddingVertical: 7
  },
  mobileCheckoutTotalLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  mobileTicketActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4
  },
  mobileSplitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  mobileSplitLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700'
  },
  mobileSplitInput: {
    width: 40,
    paddingHorizontal: 6,
    paddingVertical: 5,
    fontSize: 12,
    minHeight: 30
  },
  mobilePayBar: {
    flexDirection: 'row',
    gap: 6,
  },
  mobileOrderPrimaryButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 5,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center'
  },
  mobileOrderSecondaryButton: {
    backgroundColor: colors.buttonSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 5,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center'
  },
  mobileCheckoutActionButton: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 58
  },
  mobileOrderButtonText: {
    color: colors.buttonSecondaryText,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center'
  },
  mobileOrderPrimaryButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center'
  },
  mobileDisabledButton: {
    opacity: 0.45
  },
  mobileDrawerButton: {
    backgroundColor: colors.buttonSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  mobileAaModalPanel: {
    width: '92%',
    maxHeight: '84%',
    padding: 12
  },
  mobileCustomerTicketPanel: {
    width: '92%',
    maxHeight: '84%',
    padding: 10,
    backgroundColor: '#F3F4F6'
  },
  mobileCustomerTicketHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    marginBottom: 8
  },
  mobileCustomerTicketPaper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  mobileCustomerTicketTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 6
  },
  mobileCustomerTicketBusinessName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase'
  },
  mobileCustomerTicketTradeName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 3
  },
  mobileCustomerTicketSmall: {
    color: colors.text,
    fontSize: 10,
    lineHeight: 14
  },
  mobileCustomerTicketDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: 'dashed',
    marginVertical: 8
  },
  mobileCustomerTicketMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8
  },
  mobileCustomerTicketList: {
    maxHeight: 420
  },
  mobileCustomerTicketTableHeader: {
    flexDirection: 'row',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.text,
    paddingBottom: 4,
    marginBottom: 2
  },
  mobileCustomerTicketQtyHeader: {
    width: 24,
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  mobileCustomerTicketNameHeader: {
    flex: 1,
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  mobileCustomerTicketMoneyHeader: {
    width: 58,
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
    textTransform: 'uppercase'
  },
  mobileCustomerTicketRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 4
  },
  mobileCustomerTicketQty: {
    width: 24,
    color: colors.text,
    fontSize: 11,
    textAlign: 'left'
  },
  mobileCustomerTicketItemName: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '600'
  },
  mobileCustomerTicketNameCell: {
    flex: 1
  },
  mobileCustomerTicketAmount: {
    width: 58,
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right'
  },
  mobileCustomerTicketSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 2
  },
  mobileCustomerTicketTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 6,
    marginTop: 4
  },
  mobileCustomerTicketTotalAmount: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800'
  },
  mobileCustomerTicketFooter: {
    color: colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 10
  },
  mobileAaList: {
    maxHeight: 360
  },
  mobileAaSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 6
  },
  mobileAaFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 8
  },
  drawerActionRow: {
    alignItems: 'flex-end',
    marginBottom: 8
  },
  homeGrid: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch'
  },
  compactHomeGrid: {
    flexDirection: 'column',
    gap: 8
  },
  homeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 18,
    justifyContent: 'center'
  },
  compactHomeButton: {
    padding: 12,
    minHeight: 86
  },
  homeButtonTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8
  },
  compactHomeButtonTitle: {
    fontSize: 17,
    marginBottom: 4
  },
  homeButtonText: {
    color: colors.textSecondary,
    fontSize: 14
  },
  compactHomeButtonText: {
    fontSize: 13
  },
  fullPanel: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 12
  },
  compactFullPanel: {
    padding: 8
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  compactPanelHeaderRow: {
    alignItems: 'flex-start',
    flexWrap: 'wrap'
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    padding: 12,
    marginBottom: 8
  },
  compactHistoryRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    padding: 8
  },
  historyInlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
  },
  compactInlineActions: {
    alignItems: 'flex-end',
    gap: 6
  },
  compactHistoryActions: {
    width: '100%',
    justifyContent: 'flex-start',
    gap: 6
  },
  historyToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10
  },
  compactHistoryToolbar: {
    flexWrap: 'wrap',
    gap: 6
  },
  historySearchInput: {
    flex: 1,
    marginBottom: 0
  },
  compactSearchInput: {
    minWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13
  },
  sessionSummaryPanel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    padding: 10,
    marginBottom: 10,
    marginTop: 8
  },
  compactSessionSummaryPanel: {
    padding: 8,
    marginTop: 4,
    marginBottom: 8
  },
  sessionSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8
  },
  compactSessionSummaryGrid: {
    gap: 6,
    marginBottom: 6
  },
  sessionSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 5
  },
  productForm: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10
  },
  compactProductForm: {
    gap: 6,
    marginBottom: 8
  },
  formInput: {
    minWidth: 150,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.inputBackground,
    color: colors.inputText
  },
  compactFormInput: {
    minWidth: '100%',
    flexBasis: '100%',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13
  },
  formInputWide: {
    minWidth: 260,
    flex: 1
  },
  productImagePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  compactProductImagePicker: {
    gap: 6
  },
  productImagePreview: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt
  },
  productImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  compactProductImage: {
    width: 48,
    height: 48
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    padding: 10,
    marginBottom: 8
  },
  compactProductRow: {
    alignItems: 'flex-start',
    gap: 6,
    padding: 8,
    flexWrap: 'wrap'
  },
  productRowImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  productRowImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  compactProductRowImage: {
    width: 44,
    height: 44
  },
  columnScroll: {
    flex: 1
  },
  menuSearchInput: {
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    marginBottom: 10,
    fontSize: 14
  },
  menuTypeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10
  },
  menuTypeButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surface
  },
  desktopMenuTypeButton: {
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 14,
    justifyContent: 'center'
  },
  menuTypeButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.zoneMenu
  },
  menuTypeButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12
  },
  desktopMenuTypeButtonText: {
    fontSize: 16
  },
  menuTypeButtonTextSelected: {
    color: colors.primaryDark
  },
  orderSection: {
    flex: 1,
    minHeight: 0
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '700',
    marginBottom: 10
  },
  compactSectionTitle: {
    fontSize: 18,
    marginBottom: 6
  },
  subTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 6
  },
  compactSubTitle: {
    fontSize: 15,
    marginTop: 4,
    marginBottom: 4
  },
  orderProductsColumns: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    gap: 10
  },
  orderProductsColumn: {
    flex: 1,
    minWidth: 0,
    minHeight: 0
  },
  confirmedOrderProductsColumn: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: 10
  },
  orderColumnHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  orderColumnCount: {
    minWidth: 30,
    textAlign: 'center',
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.zoneMenu,
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  orderColumnList: {
    flex: 1,
    minHeight: 0
  },
  orderColumnListContent: {
    paddingBottom: 8
  },
  orderColumnFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 6
  },
  preorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    padding: 10,
    backgroundColor: colors.surfaceAlt
  },
  preorderEditableRow: {
    flexDirection: 'column',
    alignItems: 'stretch'
  },
  preorderMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  confirmedPreorderRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  flex1: {
    flex: 1
  },
  itemName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600'
  },
  compactItemName: {
    fontSize: 15
  },
  modifiedLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.warning,
    fontStyle: 'italic'
  },
  itemPrice: {
    fontSize: 16,
    color: colors.textSecondary
  },
  compactItemPrice: {
    fontSize: 13
  },
  originalPrice: {
    fontSize: 13,
    color: colors.textTertiary,
    textDecorationLine: 'line-through'
  },
  primaryButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: {
    color: colors.buttonPrimaryText,
    fontWeight: '700',
    fontSize: 16
  },
  secondaryButton: {
    backgroundColor: colors.buttonSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  compactUiButton: {
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  secondaryButtonText: {
    color: colors.buttonSecondaryText,
    fontWeight: '700',
    fontSize: 16
  },
  compactButtonText: {
    color: colors.buttonSecondaryText,
    fontSize: 13,
    fontWeight: '700'
  },
  compactPrimaryButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 13,
    fontWeight: '700'
  },
  qtyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  qtyButton: {
    width: 38,
    height: 38,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderDark,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  qtyButtonText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700'
  },
  mobileQtyButton: {
    width: 32,
    height: 32
  },
  mobileQtyButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700'
  },
  qtyText: {
    minWidth: 28,
    textAlign: 'center',
    color: colors.text,
    fontWeight: '700',
    fontSize: 18
  },
  confirmedQtyText: {
    minWidth: 40,
    textAlign: 'center',
    fontWeight: '700',
    color: colors.success,
    fontSize: 18
  },
  mobileQtyText: {
    minWidth: 22,
    textAlign: 'center',
    color: colors.text,
    fontWeight: '700',
    fontSize: 15
  },
  mobileConfirmedQtyText: {
    minWidth: 30,
    textAlign: 'center',
    fontWeight: '700',
    color: colors.success,
    fontSize: 15
  },
  priceInput: {
    width: 112,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    textAlign: 'center',
    fontSize: 16
  },
  compactPriceInput: {
    width: 72,
    paddingHorizontal: 6,
    paddingVertical: 7,
    fontSize: 13
  },
  compactProductCategoryInput: {
    minWidth: 0,
    width: '100%',
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 13,
    marginTop: 4
  },
  priceQuickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 4,
    width: '100%'
  },
  priceQuickButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  priceQuickButtonText: {
    color: colors.buttonSecondaryText,
    fontWeight: '700',
    fontSize: 14
  },
  footerRow: {
    marginTop: 8,
    marginBottom: 6
  },
  preorderList: {
    maxHeight: 220
  },
  confirmedList: {
    flex: 1,
    minHeight: 120
  },
  confirmedListContent: {
    paddingBottom: 8
  },
  totalText: {
    color: colors.text,
    fontWeight: '700',
    marginBottom: 6,
    fontSize: 20
  },
  compactTotalText: {
    fontSize: 16,
    marginBottom: 0
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap'
  },
  checkoutPanel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 8,
    gap: 8
  },
  checkoutTotalField: {
    minHeight: 62,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.zoneMenu,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  checkoutTotalLabel: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700'
  },
  checkoutTotalAmount: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '700'
  },
  checkoutActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap'
  },
  desktopCheckoutPrimaryButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: 8,
    paddingHorizontal: 22,
    paddingVertical: 16,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center'
  },
  desktopCheckoutSecondaryButton: {
    backgroundColor: colors.buttonSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 22,
    paddingVertical: 16,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center'
  },
  desktopCheckoutPrimaryButtonText: {
    color: colors.buttonPrimaryText,
    fontSize: 18,
    fontWeight: '700'
  },
  desktopCheckoutSecondaryButtonText: {
    color: colors.buttonSecondaryText,
    fontSize: 18,
    fontWeight: '700'
  },
  compactPrimaryButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  compactSecondaryButton: {
    backgroundColor: colors.buttonSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  compactLabel: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 4
  },
  splitTicketControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0
  },
  splitTicketLabel: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '700'
  },
  splitPeopleInput: {
    width: 56,
    paddingHorizontal: 6
  },
  ticketModule: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.zoneMenu
  },
  moduleTitle: {
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 16,
    marginBottom: 6
  },
  compactHelperText: {
    flex: 1,
    minWidth: 200,
    fontSize: 12,
    marginBottom: 0
  },
  inlineControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  smallNumberInput: {
    width: 86,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    textAlign: 'center',
    fontSize: 17
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  modalPanel: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '86%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14
  },
  connectionPanel: {
    maxWidth: 470
  },
  connectionInput: {
    minHeight: 48,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    fontSize: 15,
    marginTop: 8,
    marginBottom: 12
  },
  connectionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10
  },
  scannerFrame: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    marginBottom: 6
  },
  scannerCamera: {
    height: 250,
    width: '100%'
  },
  scannerHelp: {
    color: colors.textSecondary,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8
  },
  modalTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap'
  },
  aaSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.surfaceAlt
  },
  aaSelectedSummary: {
    flexBasis: '100%',
    minHeight: 54,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.zoneMenu,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  aaSelectedSummaryLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700'
  },
  aaSelectedSummaryAmount: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700'
  },
  aaDisabledButton: {
    opacity: 0.45
  },
  confirmedCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    backgroundColor: colors.surface
  },
  orderId: {
    color: colors.text,
    fontWeight: '700',
    marginBottom: 4,
    fontSize: 17
  },
  orderItemText: {
    color: colors.textSecondary,
    fontSize: 17,
    marginBottom: 2
  },
  emptyText: {
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginBottom: 8,
    fontSize: 16
  }
});
