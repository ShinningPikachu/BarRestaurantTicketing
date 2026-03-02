function el(tag: string, cls?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

export function renderTablesColumn(
  selectedTable: number,
  onTableSelect: (tableNum: number) => void
): HTMLElement {
  const tablesColumn = el('div', 'tables-column');
  const tablesHeading = el('h3');
  tablesHeading.textContent = 'Tables';
  tablesColumn.appendChild(tablesHeading);

  const tablesList = el('div', 'tables-list');
  for (let t = 1; t <= 8; t++) {
    const btn = el('button', 'table-btn');
    btn.textContent = `Table ${t}`;
    if (t === selectedTable) btn.classList.add('active');
    btn.addEventListener('click', () => {
      onTableSelect(t);
    });
    tablesList.appendChild(btn);
  }
  tablesColumn.appendChild(tablesList);
  
  return tablesColumn;
}
