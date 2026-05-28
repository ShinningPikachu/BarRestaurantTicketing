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
  historySearchInput: {
    flex: 1,
    marginBottom: 0
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
  }
});
