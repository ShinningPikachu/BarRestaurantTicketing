import { StyleSheet } from 'react-native';
import { colors } from '../../theme';

export const styles = StyleSheet.create({
  categoryGroup: {
    width: '100%',
    maxWidth: '100%',
    marginBottom: 8,
    borderRadius: 8,
    padding: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden'
  },
  mobileCategoryGroup: {
    padding: 5
  },
  categoryHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 5,
    paddingLeft: 2
  },
  itemsWrap: {
    maxWidth: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 6
  },
  menuItemChip: {
    minWidth: 0,
    maxWidth: '100%',
    flexShrink: 0,
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border
  },
  mobileMenuItemChip: {
    minWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 6
  },
  itemImage: {
    width: '100%',
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.surface,
    marginBottom: 5
  },
  mobileItemImage: {
    height: 54,
    marginBottom: 4
  },
  itemName: {
    maxWidth: '100%',
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2
  },
  mobileItemName: {
    fontSize: 12
  },
  itemSecondaryName: {
    maxWidth: '100%',
    minHeight: 27,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 14,
    marginBottom: 3
  },
  mobileItemSecondaryName: {
    minHeight: 24,
    fontSize: 10,
    lineHeight: 12,
    marginBottom: 3
  },
  itemPrice: {
    fontSize: 14,
    color: colors.textSecondary
  },
  mobileItemPrice: {
    fontSize: 12
  },
  emptyText: {
    color: colors.textTertiary,
    fontStyle: 'italic',
    paddingVertical: 12,
  }
});
