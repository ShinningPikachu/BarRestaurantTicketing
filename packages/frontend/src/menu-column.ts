type MenuItem = { 
  id: number; 
  name: string; 
  priceCents: number; 
  sku?: string; 
  category?: string; 
  description?: string; 
  available?: boolean 
};

function el(tag: string, cls?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

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

      for (const item of categories[category]) {
        const itemRow = el('div', 'menu-item-row');
        
        const itemInfo = el('div', 'item-info');
        const itemName = el('div', 'item-name');
        itemName.textContent = item.name;
        const itemPrice = el('div', 'item-price');
        itemPrice.textContent = `$${(item.priceCents / 100).toFixed(2)}`;
        itemInfo.appendChild(itemName);
        itemInfo.appendChild(itemPrice);

        const addBtn = el('button', 'add-to-order-btn');
        addBtn.textContent = '+';
        addBtn.addEventListener('click', () => {
          onAddItem(item.id);
        });

        itemRow.appendChild(itemInfo);
        itemRow.appendChild(addBtn);
        categorySection.appendChild(itemRow);
      }

      menuScroll.appendChild(categorySection);
    }
  }
  menuColumn.appendChild(menuScroll);
  
  return menuColumn;
}
