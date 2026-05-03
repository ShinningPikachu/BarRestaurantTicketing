import { StyleSheet } from 'react-native';
import { colors } from '../../theme';

export const styles = StyleSheet.create({
  categoryGroup: {
    width: '100%',
    maxWidth: '100%',
    marginBottom: 14,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden'
  },
  mobileCategoryGroup: {
    padding: 10
  },
  categoryHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 8,
    paddingLeft: 2
  },
  itemsWrap: {
    maxWidth: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 10
  },
  menuItemChip: {
    minWidth: 150,
    width: 174,
    maxWidth: '100%',
    flexShrink: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border
  },
  mobileMenuItemChip: {
    minWidth: 0,
    width: '48%',
    flexGrow: 1,
    flexBasis: '48%',
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  itemImage: {
    width: '100%',
    height: 106,
    borderRadius: 8,
    backgroundColor: colors.surface,
    marginBottom: 8
  },
  mobileItemImage: {
    height: 92,
    marginBottom: 6
  },
  itemName: {
    maxWidth: '100%',
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 4
  },
  mobileItemName: {
    minHeight: 40,
    fontSize: 15
  },
  itemPrice: {
    fontSize: 17,
    color: colors.textSecondary
  }
});
