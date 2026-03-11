import { StyleSheet } from 'react-native';
import { colors } from '../theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingTop: 12
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10
  },
  title: {
    fontSize: 18,
    fontWeight: '600'
  },
  columnsContent: {
    flexGrow: 1,
    paddingBottom: 12
  },
  tablesColumn: {
    width: 220,
    maxWidth: 220
  },
  columns: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 1080
  },
  column: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 10
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 6
  },
  preorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  flex1: {
    flex: 1
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600'
  },
  modifiedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning,
    fontStyle: 'italic'
  },
  itemPrice: {
    fontSize: 12,
    color: colors.textSecondary
  },
  originalPrice: {
    fontSize: 11,
    color: colors.textTertiary,
    textDecorationLine: 'line-through'
  },
  primaryButton: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  primaryButtonText: {
    color: colors.buttonPrimaryText,
    fontWeight: '700'
  },
  secondaryButton: {
    backgroundColor: colors.buttonSecondary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  secondaryButtonText: {
    color: colors.buttonSecondaryText,
    fontWeight: '600'
  },
  qtyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  qtyButtonText: {
    fontSize: 16,
    fontWeight: '700'
  },
  qtyText: {
    minWidth: 18,
    textAlign: 'center'
  },
  priceInput: {
    width: 88,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.inputBackground,
    textAlign: 'center'
  },
  priceQuickActions: {
    flexDirection: 'row',
    gap: 4
  },
  priceQuickButton: {
    backgroundColor: colors.buttonSecondary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  priceQuickButtonText: {
    color: colors.buttonSecondaryText,
    fontWeight: '600',
    fontSize: 12
  },
  footerRow: {
    marginTop: 8,
    marginBottom: 6
  },
  totalText: {
    fontWeight: '700',
    marginBottom: 6
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6
  },
  confirmedCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: colors.surface
  },
  orderId: {
    fontWeight: '700',
    marginBottom: 4
  },
  orderItemText: {
    fontSize: 13,
    marginBottom: 2
  },
  emptyText: {
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginBottom: 8
  }
});
