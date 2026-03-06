import { StyleSheet } from 'react-native';
import { colors } from '../../theme';

export const styles = StyleSheet.create({
  zoneGroup: {
    marginBottom: 16,
    backgroundColor: colors.zoneTable,
    borderRadius: 12,
    padding: 10
  },
  zoneHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textBlack,
    marginBottom: 6,
    paddingLeft: 4
  },
  tableButton: {
    width: '100%',
    padding: 10,
    borderRadius: 10,
    backgroundColor: colors.buttonSecondary,
    alignItems: 'flex-start',
    marginBottom: 8
  },
  tableButtonSelected: {
    backgroundColor: colors.buttonPrimary
  },
  tableButtonText: {
    color: colors.buttonSecondaryText,
    fontWeight: '700'
  },
  tableButtonTextSelected: {
    color: colors.buttonPrimaryText
  }
});