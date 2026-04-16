import { useState } from 'react';
import { Alert } from 'react-native';
import { groupMenuItemsByCategory } from '../helpers';
import { apiService } from '../services';
import { MenuItem } from '../types';

export function useMenuController() {
  const [menuByCategory, setMenuByCategory] = useState<Map<string, MenuItem[]>>(new Map());

  async function loadMenu(): Promise<void> {
    try {
      const loadedMenu = await apiService.fetchMenu();
      setMenuByCategory(groupMenuItemsByCategory(loadedMenu));
    } catch {
      Alert.alert('Error', 'Failed to load menu.');
    }
  }

  return {
    state: {
      menuByCategory,
    },
    actions: {
      loadMenu,
    }
  };
}
