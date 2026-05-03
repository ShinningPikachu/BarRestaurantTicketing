import { StyleSheet } from 'react-native';
import { colors } from '../../theme';

export const styles = StyleSheet.create({
  zoneGroup: {
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  mobileZoneGroup: {
    marginBottom: 8,
    padding: 8
  },
  zoneHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    paddingLeft: 2
  },
  hintText: {
    fontSize: 15,
    color: colors.textTertiary,
    marginBottom: 8,
    paddingLeft: 2
  },
  zoneBoard: {
    position: 'relative',
    width: '100%',
    height: 300,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.zoneTable,
    marginBottom: 10,
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
    fontSize: 24,
    userSelect: 'none'
  },
  mobileTableNodeText: {
    fontSize: 18
  },
  tableNodeTextSelected: {
    color: colors.textLight
  },
  addTableButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.buttonSecondary,
    alignItems: 'center'
  },
  addTableButtonText: {
    color: colors.buttonSecondaryText,
    fontWeight: '700',
    fontSize: 16
  },
  removeSelectedButton: {
    width: '100%',
    paddingVertical: 12,
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
    fontSize: 16
  }
});
