import { StyleSheet } from 'react-native';
import { colors } from '../../theme';

export const styles = StyleSheet.create({
  zoneGroup: {
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  zoneHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
    paddingLeft: 2
  },
  hintText: {
    fontSize: 11,
    color: colors.textTertiary,
    marginBottom: 8,
    paddingLeft: 2
  },
  zoneBoard: {
    position: 'relative',
    width: '100%',
    height: 220,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.zoneTable,
    marginBottom: 10,
    overflow: 'hidden'
  },
  zoneBoardContent: {
    position: 'relative',
    width: '100%'
  },
  tableNode: {
    position: 'absolute',
    width: 92,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderDark,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none'
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
    fontSize: 16,
    userSelect: 'none'
  },
  tableNodeTextSelected: {
    color: colors.textLight
  },
  addTableButton: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.buttonSecondary,
    alignItems: 'center'
  },
  addTableButtonText: {
    color: colors.buttonSecondaryText,
    fontWeight: '700'
  },
  removeSelectedButton: {
    width: '100%',
    paddingVertical: 10,
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
    fontWeight: '700'
  }
});
