import { StyleSheet } from 'react-native';
import { colors } from '../../theme';

export const styles = StyleSheet.create({
  categoryGroup: {
    marginBottom: 12,
    borderRadius: 8,
    padding: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  mobileCategoryGroup: {
    padding: 8
  },
  categoryHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 8,
    paddingLeft: 2
  },
  itemsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 8
  },
  menuItemChip: {
    minWidth: 132,
    width: 150,
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 10,
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
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  itemImage: {
    width: '100%',
    height: 74,
    borderRadius: 8,
    backgroundColor: colors.surface,
    marginBottom: 8
  },
  mobileItemImage: {
    height: 82,
    marginBottom: 6
  },
  itemName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4
  },
  mobileItemName: {
    minHeight: 34,
    fontSize: 13
  },
  itemPrice: {
    fontSize: 12,
    color: colors.textSecondary
  }
});
