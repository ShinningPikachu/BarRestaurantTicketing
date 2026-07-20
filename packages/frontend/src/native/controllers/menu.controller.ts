import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { groupMenuItemsByCategory } from '../helpers';
import { apiService } from '../services';
import { MenuItem } from '../types';

export function useMenuController() {
  const [menuByCategory, setMenuByCategory] = useState<Map<string, MenuItem[]>>(new Map());
  const sessionGenerationRef = useRef(0);
  const requestGenerationRef = useRef(0);

  async function loadMenu(options: { showError?: boolean } = {}): Promise<boolean> {
    const sessionGeneration = sessionGenerationRef.current;
    const requestGeneration = ++requestGenerationRef.current;
    try {
      const loadedMenu = await apiService.fetchMenu();
      if (
        sessionGeneration !== sessionGenerationRef.current
        || requestGeneration !== requestGenerationRef.current
      ) {
        return false;
      }
      setMenuByCategory(groupMenuItemsByCategory(loadedMenu));
      return true;
    } catch {
      if (sessionGeneration === sessionGenerationRef.current && options.showError !== false) {
        Alert.alert('Error', 'No se pudo cargar el menú.');
      }
      return false;
    }
  }

  function resetMenu(): void {
    sessionGenerationRef.current += 1;
    requestGenerationRef.current += 1;
    setMenuByCategory(new Map());
  }

  return {
    state: {
      menuByCategory,
    },
    actions: {
      loadMenu,
      resetMenu,
    }
  };
}
