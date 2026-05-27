import { StyleSheet } from 'react-native';
import { colors } from '../../theme';

export const styles = StyleSheet.create({
  zoneGroup: {
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border
  },
  mobileZoneGroup: {
    marginBottom: 8,
    padding: 8
  },
  zoneHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    paddingLeft: 2
  },
  hintText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 6,
    paddingLeft: 2
  },
  zoneBoard: {
    position: 'relative',
    width: '100%',
    height: 176,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.zoneTable,
    marginBottom: 7,
    overflow: 'hidden'
  },
  mobileZoneBoard: {
    height: 190,
    marginBottom: 8
  },
  zoneBoardContent: {
    position: 'relative',
    width: '100%'
  },
  tableNode: {
    position: 'absolute',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderDark,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none'
  },
  mobileTableNode: {
    borderRadius: 7
  },
  tableNodeDragging: {
    opacity: 0.82
  },
  tableNodeSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark
  },
  tableNodeText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 18,
    userSelect: 'none'
  },
  mobileTableNodeText: {
    fontSize: 17
  },
  tableAmountText: {
    color: colors.textTertiary,
    fontWeight: '700',
    fontSize: 12,
    marginTop: 3,
    userSelect: 'none'
  },
  mobileTableAmountText: {
    fontSize: 11
  },
  tableNodeTextSelected: {
    color: colors.textLight
  },
  addTableButton: {
    width: '100%',
    paddingVertical: 9,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.buttonSecondary,
    alignItems: 'center'
  },
  addTableButtonText: {
    color: colors.buttonSecondaryText,
    fontWeight: '700',
    fontSize: 14
  },
  removeSelectedButton: {
    width: '100%',
    paddingVertical: 9,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: colors.error,
    alignItems: 'center',
    marginTop: 8
  },
  removeSelectedButtonDisabled: {
    opacity: 0.45
  },
  removeSelectedButtonText: {
    color: colors.textLight,
    fontWeight: '700',
    fontSize: 14
  }
});
