import { renderMenuItemSquare } from './menu-item-square';
import type { MenuItem } from '@shared';
import { el } from '../utils/dom';

export function renderMenuColumn(
  menuItems: MenuItem[],
  selectedMenuItems: { [key: number]: number },
  onAddItem: (menuId: number) => void
): HTMLElement {
  const menuColumn = el('div', 'menu-column');
  const menuHeading = el('h3');
  menuHeading.textContent = 'Menu';
  menuColumn.appendChild(menuHeading);

  const menuScroll = el('div', 'menu-scroll');
  if (menuItems.length === 0) {
    const p = el('p');
    p.textContent = 'No menu items available.';
    menuScroll.appendChild(p);
  } else {
    // Group by category
    const categories: { [key: string]: MenuItem[] } = {};
    for (const item of menuItems) {
      const cat = item.category || 'Other';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(item);
    }

    for (const category in categories) {
      const categorySection = el('div', 'menu-category-section');
      const categoryTitle = el('h4', 'menu-category-title');
      categoryTitle.textContent = category;
      categorySection.appendChild(categoryTitle);

      const itemsGrid = el('div', 'menu-items-grid');

      for (const item of categories[category]) {
        const qty = selectedMenuItems[item.id] || 0;
        itemsGrid.appendChild(renderMenuItemSquare(item, qty, onAddItem));
      }

      categorySection.appendChild(itemsGrid);

      menuScroll.appendChild(categorySection);
    }
  }
  menuColumn.appendChild(menuScroll);
  
  return menuColumn;
}
