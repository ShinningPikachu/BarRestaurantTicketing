import { useState } from 'react';
import { MenuItem } from '../types';

export function useMenuState() {
  const [menuByCategory, setMenuByCategory] = useState<Map<string, MenuItem[]>>(
    new Map()
  );

  return {
    menuByCategory,
    setMenuByCategory,
  };
}
