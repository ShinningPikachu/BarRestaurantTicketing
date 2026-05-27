import { StyleSheet } from 'react-native';
import { colors } from '../theme';

export const mobileStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingTop: 8
  },
  screenBody: {
    flex: 1,
    minHeight: 0
  },
  headerBar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8
  },
  header: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700'
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1
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
    paddingHorizontal: 10,
    minHeight: 44,
    paddingVertical: 7,
    justifyContent: 'center'
  },
  bottomTabs: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingBottom: 6,
    marginTop: 8
  },
  bottomTabButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.buttonSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  bottomTabButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  bottomTabText: {
    color: colors.buttonSecondaryText,
    fontSize: 13,
    fontWeight: '700'
  },
  bottomTabTextSelected: {
    color: colors.textLight
  },
  homeGrid: {
    flex: 1,
    flexDirection: 'column',
    gap: 8
  },
  homeButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 12,
    minHeight: 104,
    justifyContent: 'center'
  },
  homeButtonTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 4
  },
  homeButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20
  },
  fullPanel: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 8
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6
  },
  subTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 4
  },
  flex1: {
    flex: 1
  },
  itemName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600'
  },
  itemPrice: {
    color: colors.textSecondary,
    fontSize: 13
  },
  totalText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16
  },
  helperText: {
    flex: 1,
    minWidth: 200,
    color: colors.textSecondary,
    fontSize: 12
  },
  primaryButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: {
    color: colors.buttonPrimaryText,
    fontWeight: '700',
    fontSize: 13
  },
  secondaryButton: {
    backgroundColor: colors.buttonSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButtonText: {
    color: colors.buttonSecondaryText,
    fontWeight: '700',
    fontSize: 13
  },
  menuSearchInput: {
    minWidth: '100%',
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    fontSize: 13
  },
  columnScroll: {
    flex: 1
  },
  listContent: {
    paddingBottom: 10
  },
  historyToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10
  },
  historySearchInput: {
    flex: 1,
    minWidth: 190
  },
  historyRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    padding: 8,
    marginBottom: 8
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8
  },
  historyInlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-start'
  },
  sessionSummaryPanel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    padding: 8,
    marginBottom: 8,
    marginTop: 4
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8
  },
  summaryTotalBlock: {
    alignItems: 'flex-end'
  },
  sessionSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6
  },
  summaryStat: {
    flexGrow: 1,
    flexBasis: '46%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 7
  },
  summaryStatLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2
  },
  summaryStatValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700'
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    padding: 8,
    gap: 6,
    marginBottom: 10
  },
  productsContent: {
    paddingBottom: 12
  },
  formInput: {
    minWidth: '100%',
    flexBasis: '100%',
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    fontSize: 14,
    minHeight: 44
  },
  formInputWide: {
    flex: 1
  },
  formTwoColumnRow: {
    flexDirection: 'row',
    gap: 6
  },
  formHalfInput: {
    flex: 1,
    minWidth: 0,
    flexBasis: 0
  },
  priceInput: {
    width: 72,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 7,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    textAlign: 'center',
    fontSize: 13,
    minHeight: 42
  },
  productImagePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap'
  },
  productImageActions: {
    flex: 1,
    minWidth: 150,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  productImagePreview: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt
  },
  productImagePlaceholder: {
    width: 48,
    height: 48,
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
    alignItems: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    padding: 8,
    marginBottom: 8
  },
  productRowBody: {
    flex: 1,
    minWidth: 0,
    gap: 6
  },
  productEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap'
  },
  productRowImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  productRowImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  productCategoryInput: {
    minWidth: 0,
    width: '100%',
    paddingHorizontal: 8,
    paddingVertical: 7,
    fontSize: 13,
    marginTop: 4
  },
  emptyText: {
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginBottom: 8,
    fontSize: 14
  }
});
