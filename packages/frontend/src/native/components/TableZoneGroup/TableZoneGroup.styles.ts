import { StyleSheet } from 'react-native';
import { colors } from '../../theme';

export const styles = StyleSheet.create({
  zoneGroup: {
    marginBottom: 16,
    backgroundColor: colors.zoneTable,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  zoneHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textBlack,
    marginBottom: 6,
    paddingLeft: 4
  },
  hintText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 8,
    paddingLeft: 4,
  },
  zoneBoard: {
    position: 'relative',
    width: '100%',
    height: 300,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.surface,
    marginBottom: 10,
    overflow: 'hidden',
  },
  tableNode: {
    position: 'absolute',
    width: 92,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.buttonSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
  },
  tableNodeDragging: {},
  tableNodeSelected: {
    backgroundColor: colors.buttonPrimary,
    borderColor: colors.buttonPrimary,
  },
  tableNodeText: {
    color: colors.buttonSecondaryText,
    fontWeight: '700',
    fontSize: 16,
    userSelect: 'none',
  },
  tableNodeTextSelected: {
    color: colors.buttonPrimaryText,
  },
  addTableButton: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.buttonSecondary,
    alignItems: 'center',
  },
  addTableButtonText: {
    color: colors.buttonSecondaryText,
    fontWeight: '700',
  }
});