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
  headerButton: {
    backgroundColor: colors.buttonSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
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
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600'
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
  columnsContent: {
    flexGrow: 1,
    width: '100%',
    paddingBottom: 16
  },
  columnsScroll: {
    flex: 1
  },
  tablesColumn: {
    flex: 1.55,
    flexBasis: 0,
    minWidth: 560
  },
  menuColumn: {
    flex: 0.8,
    flexBasis: 0,
    minWidth: 290
  },
  ticketColumn: {
    flex: 0.9,
    flexBasis: 0,
    minWidth: 330
  },
  columns: {
    flex: 1,
    flexDirection: 'row',
    gap: 14,
    width: '100%',
    minWidth: 1220
  },
  column: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14
  },
  mobilePosScreen: {
    flex: 1,
    minHeight: 0,
    gap: 10
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
  mobileContextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8
  },
  mobileContextText: {
    color: colors.textSecondary,
    fontSize: 14,
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
    paddingBottom: 8,
    marginBottom: 8
  },
  mobileOrderScroll: {
    flex: 1,
    minHeight: 0
  },
  mobileOrderBlock: {
    marginBottom: 8
  },
  mobileOrderBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4
  },
  mobileBadge: {
    minWidth: 32,
    textAlign: 'center',
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '700',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.zoneMenu,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  mobileOrderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 6
  },
  mobileStickyActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10
  },
  mobilePayBar: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 8
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
  homeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 18,
    justifyContent: 'center'
  },
  homeButtonTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8
  },
  homeButtonText: {
    color: colors.textSecondary,
    fontSize: 14
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
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
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
  historyInlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end'
  },
  historyToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10
  },
  historySearchInput: {
    flex: 1,
    marginBottom: 0
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
  sessionSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8
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
  menuTypeButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.zoneMenu
  },
  menuTypeButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12
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
  subTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 6
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
  secondaryButtonText: {
    color: colors.buttonSecondaryText,
    fontWeight: '700',
    fontSize: 16
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
  priceQuickActions: {
    flexDirection: 'row',
    gap: 4
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
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap'
  },
  confirmedActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap'
  },
  compactPrimaryButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
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
