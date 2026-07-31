import { StyleSheet } from 'react-native';
import { colors } from '../theme';

export const desktopStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  headerBar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 12,
    gap: 16
  },
  header: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700'
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerButton: {
    backgroundColor: colors.buttonSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center'
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
    padding: 24,
    justifyContent: 'center'
  },
  homeButtonTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8
  },
  homeButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 24
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
  flex1: {
    flex: 1
  },
  itemName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600'
  },
  itemPrice: {
    color: colors.textSecondary,
    fontSize: 16
  },
  totalText: {
    color: colors.text,
    fontWeight: '700',
    marginBottom: 6,
    fontSize: 20
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 16,
    marginBottom: 6
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
    paddingVertical: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButtonText: {
    color: colors.buttonSecondaryText,
    fontWeight: '700',
    fontSize: 16
  },
  disabledButton: {
    opacity: 0.45
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
  columnScroll: {
    flex: 1
  },
  historyToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10
  },
  historyFiltersPanel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    padding: 10,
    marginBottom: 10,
    gap: 8
  },
  periodButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  periodButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 40,
    justifyContent: 'center'
  },
  periodButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  periodButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13
  },
  periodButtonTextSelected: {
    color: colors.textLight
  },
  customDateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  dateInput: {
    minWidth: 160
  },
  historySearchInput: {
    flex: 1,
    marginBottom: 0
  },
  historyListContent: {
    paddingBottom: 12
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  historyTicketTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  historyStatusPill: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.surface
  },
  historyTaxLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4
  },
  accountingSummaryPanel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    padding: 10,
    marginBottom: 10
  },
  accountingSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10
  },
  accountingSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  accountingStat: {
    minWidth: 148,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  accountingStatLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3
  },
  accountingStatValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700'
  },
  ticketDetailPanel: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 10
  },
  ticketDetailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10
  },
  ticketDetailTotals: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 10,
    paddingTop: 10
  },
  ticketLineHeader: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginTop: 10,
    paddingVertical: 6
  },
  ticketLineRow: {
    flexDirection: 'row',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 7
  },
  ticketLineCell: {
    width: 88,
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'right'
  },
  ticketLineName: {
    flex: 1,
    minWidth: 180,
    textAlign: 'left'
  },
  ticketLineMeta: {
    color: colors.textTertiary,
    fontSize: 11,
    marginTop: 2
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4
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
  productNameCreateRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  productNameCreateInput: {
    flex: 1,
    minWidth: 180
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
  productImagePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  productNameEditRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 6
  },
  productNameInput: {
    flex: 1,
    minWidth: 140
  },
  productFullNameInput: {
    width: '100%'
  },
  productEditStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6
  },
  productSaveStatus: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700'
  },
  productSaveStatusSuccess: {
    color: colors.success
  },
  productSaveChangesButton: {
    minWidth: 142,
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  productSaveChangesButtonDisabled: {
    backgroundColor: colors.buttonSecondary,
    borderColor: colors.border
  },
  productSaveChangesText: {
    color: colors.textLight,
    fontWeight: '700',
    fontSize: 15
  },
  productSaveChangesTextDisabled: {
    color: colors.textSecondary
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
  menuTypeButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12
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
  emptyText: {
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginBottom: 8,
    fontSize: 16
  },
  pairingPanel: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 16,
    justifyContent: 'center'
  },
  pairingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    flexWrap: 'wrap'
  },
  pairingTextBlock: {
    maxWidth: 460,
    minWidth: 280,
    flexShrink: 1
  },
  pairingAddress: {
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    marginVertical: 12
  },
  pairingQr: {
    width: 340,
    height: 340,
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border
  },
  pairingQrRow: {
    flex: 1,
    flexDirection: 'row'
  },
  pairingQrCell: {
    flex: 1
  },
  pairingQrCellDark: {
    backgroundColor: '#000000'
  },
  pairingQrCellLight: {
    backgroundColor: '#FFFFFF'
  }
});
