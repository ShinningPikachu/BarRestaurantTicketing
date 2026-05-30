import { useState } from 'react';
import { Alert } from 'react-native';
import { groupMenuItemsByCategory } from '../helpers';
import { apiService } from '../services';
import { MenuItem } from '../types';

export function useMenuController() {
  const [menuByCategory, setMenuByCategory] = useState<Map<string, MenuItem[]>>(new Map());

  async function loadMenu(options: { showError?: boolean } = {}): Promise<void> {
    try {
      const loadedMenu = await apiService.fetchMenu();
      setMenuByCategory(groupMenuItemsByCategory(loadedMenu));
    } catch {
      if (options.showError !== false) {
        Alert.alert('Error', 'No se pudo cargar el menú.');
      }
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
