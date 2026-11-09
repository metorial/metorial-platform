// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { createDataList } from './builder';
import { col } from './helpers/columns';
import { f } from './helpers/filters';
import { lifecycleStatus } from './helpers/status';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type Row = {
  id: string;
  name: string;
  status: 'active' | 'archived' | 'deleted';
  createdAt: Date;
};

let rows: Row[] = [
  { id: 'a', name: 'Alpha', status: 'active', createdAt: new Date(2026, 1, 1) },
  { id: 'b', name: 'Beta', status: 'archived', createdAt: new Date(2026, 1, 2) }
];

let seen: any[] = [];

let list = createDataList<{ prefix?: string }>('test-list')
  .filters(() => ({ status: f.status(lifecycleStatus, { only: ['active', 'archived'] }) }))
  .search('Search…')
  .items(({ filters, search }) => {
    seen.push({ status: filters.status, search });
    return {
      items: rows.filter(row => !filters.status || filters.status.includes(row.status as any))
    };
  })
  .columns([col.name<Row>(), col.status<Row, any>(lifecycleStatus), col.id<Row>()])
  .item(row => ({ title: row.name, footer: row.id, href: `/rows/${row.id}` }))
  .layouts(['grid', 'table'], { default: 'grid' })
  .build();

let render = async (element: React.ReactElement, url = '/') => {
  let container = document.createElement('div');
  document.body.appendChild(container);
  let root = createRoot(container);
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[url]}>{element}</MemoryRouter>);
  });
  return container;
};

it('renders the default grid layout with a switcher', async () => {
  let container = await render(React.createElement(list, {}));

  expect(container.textContent).toContain('Alpha');
  expect(container.textContent).toContain('Beta');
  expect(container.querySelector('table')).toBeNull();
  expect(container.querySelector('[role="radiogroup"], [role="group"]')).not.toBeNull();
});

it('honours the view search param and renders a table', async () => {
  let container = await render(React.createElement(list, {}), '/?view=table');

  expect(container.querySelector('table')).not.toBeNull();
  expect(container.querySelectorAll('tbody tr').length).toBe(2);
});

it('parses typed filters from the URL into the data source', async () => {
  seen = [];
  let container = await render(React.createElement(list, {}), '/?view=table&status=archived');

  expect(seen.some(entry => entry.status?.[0] == 'archived')).toBe(true);
  expect(container.textContent).toContain('Beta');
  expect(container.textContent).not.toContain('Alpha');
});

it('ignores filter values outside the allowed set', async () => {
  let container = await render(React.createElement(list, {}), '/?view=table&status=deleted');

  expect(container.textContent).toContain('Alpha');
  expect(container.textContent).toContain('Beta');
});

it('shows the filtered empty message when a search matches nothing', async () => {
  let empty = createDataList('empty-list')
    .items(() => ({ items: [] as Row[] }))
    .columns([col.name<Row>()])
    .build();

  let container = await render(
    React.createElement(empty, {
      emptyState: { initial: 'Nothing yet', filtered: 'No match' }
    })
  );

  expect(container.textContent).toContain('Nothing yet');
});
