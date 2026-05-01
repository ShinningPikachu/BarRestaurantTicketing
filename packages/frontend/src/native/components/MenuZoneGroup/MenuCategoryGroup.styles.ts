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
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border
  },
  itemName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4
  },
  itemPrice: {
    fontSize: 12,
    color: colors.textSecondary
  }
});
