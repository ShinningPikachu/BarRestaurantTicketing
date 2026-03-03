import type { MenuItem } from '@shared';

function el(tag: string, cls?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

export function renderMenuItemSquare(
  item: MenuItem,
  quantity: number,
  onAddItem: (menuId: number) => void
): HTMLElement {
  const square = el('button', 'menu-item-square');
  square.setAttribute('type', 'button');

  if (item.available === false) {
    square.classList.add('unavailable');
    square.disabled = true;
  } else {
    square.addEventListener('click', () => {
      onAddItem(item.id);
    });
  }

  const name = el('div', 'menu-item-square-name');
  name.textContent = item.name;

  const price = el('div', 'menu-item-square-price');
  price.textContent = `$${(item.priceCents / 100).toFixed(2)}`;

  square.appendChild(name);
  square.appendChild(price);

  if (quantity > 0) {
    const qty = el('div', 'menu-item-square-qty');
    qty.textContent = `x${quantity}`;
    square.appendChild(qty);
  }

  return square;
}
