import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  categoryGroup: {
    marginBottom: 16,
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#00A100',
  },
  categoryHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    paddingLeft: 4
  },
  itemsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  // key: no width, no flex:1
  menuItemChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",

    // spacing between chips
    marginRight: 8,
    marginBottom: 8,
  },

  itemName: {
    fontSize: 14,
    fontWeight: "600",
  },
  itemPrice: {
    fontSize: 12,
    color: "#4B5563",
    marginLeft: 8, // spacing between name and price
  },
});
