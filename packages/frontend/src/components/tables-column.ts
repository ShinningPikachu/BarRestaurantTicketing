import type { TableZone } from '@shared';
import { el } from '../utils/dom';

export type TableDef = {
  number: number;
  zone: TableZone;
};

export function renderTablesColumn(
  selectedTable: number,
  tables: TableDef[],
  onTableSelect: (tableNum: number) => void,
  onAddTable: (zone: TableZone) => void
): HTMLElement {
  const tablesColumn = el('div', 'tables-column');
  const tablesHeading = el('h3');
  tablesHeading.textContent = 'Tables';
  tablesColumn.appendChild(tablesHeading);

  const sections: { zone: TableZone; title: string }[] = [
    { zone: 'outside', title: 'Outside' },
    { zone: 'floor1', title: 'Floor 1' },
    { zone: 'floor2', title: 'Floor 2' }
  ];

  for (const section of sections) {
    const zoneSection = el('div', 'tables-section');
    const sectionTitle = el('h4', 'tables-section-title');
    sectionTitle.textContent = section.title;
    zoneSection.appendChild(sectionTitle);

    const tablesList = el('div', 'tables-list');
    for (const table of tables.filter((t) => t.zone === section.zone)) {
      const btn = el('button', 'table-btn');
      btn.textContent = `Table ${table.number}`;
      if (table.number === selectedTable) btn.classList.add('active');
      btn.addEventListener('click', () => {
        onTableSelect(table.number);
      });
      tablesList.appendChild(btn);
    }
    zoneSection.appendChild(tablesList);

    const addBtn = el('button', 'add-table-btn');
    addBtn.textContent = '+ Add Table';
    addBtn.addEventListener('click', () => {
      onAddTable(section.zone);
    });
    zoneSection.appendChild(addBtn);

    tablesColumn.appendChild(zoneSection);
  }
  
  return tablesColumn;
}
