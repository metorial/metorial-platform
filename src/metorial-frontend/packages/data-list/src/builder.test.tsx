// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
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

it('hides pagination when there is only one page and the list opts in', async () => {
  let createPagedList = (pageSize: number) =>
    createDataList(`paged-list-${pageSize}`, { hidePaginationWhenUnavailable: true })
      .items(() => ({ items: rows }), { pageSize })
      .columns([col.name<Row>()])
      .build();

  let singlePage = await render(React.createElement(createPagedList(10), {}));
  expect(singlePage.textContent).not.toContain('Next');

  let multiplePages = await render(React.createElement(createPagedList(1), {}));
  expect(multiplePages.textContent).toContain('Next');
});

let clickLeftToBrowser = (target: Element, init: MouseEventInit = {}) => {
  let leftToBrowser = false;
  let listener = (event: Event) => {
    leftToBrowser = !event.defaultPrevented;
    event.preventDefault();
  };

  document.addEventListener('click', listener);
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
  document.removeEventListener('click', listener);

  return leftToBrowser;
};

it('keeps an interactive column out of the row link and stretches the row link over it', async () => {
  let location = { pathname: '' };

  let LocationProbe = () => {
    location.pathname = useLocation().pathname;
    return null;
  };

  let linked = createDataList('linked-list')
    .items(() => ({ items: rows }))
    .columns([
      col.name<Row>(),
      col.custom<Row>({
        id: 'owner',
        interactive: true,
        render: row => <Link to={`/owners/${row.id}`}>Owner of {row.name}</Link>
      })
    ])
    .link(row => `/rows/${row.id}`)
    .build();

  let container = await render(
    <>
      {React.createElement(linked, {})}
      <LocationProbe />
    </>
  );

  let [firstRow] = Array.from(container.querySelectorAll('tbody tr'));
  let [nameCell, ownerCell] = Array.from(firstRow!.querySelectorAll('td'));
  let [rowLink, ownerLink] = Array.from(ownerCell!.querySelectorAll('a'));

  expect(container.querySelector('a a')).toBeNull();
  expect(nameCell!.querySelector('a')?.getAttribute('href')).toBe('/rows/a');
  expect(rowLink!.getAttribute('href')).toBe('/rows/a');
  expect(rowLink!.children).toHaveLength(0);
  expect(ownerLink!.getAttribute('href')).toBe('/owners/a');

  let modified = false;
  await act(async () => {
    modified = clickLeftToBrowser(rowLink!, { metaKey: true });
  });
  expect(modified).toBe(true);
  expect(location.pathname).toBe('/');

  await act(async () => {
    clickLeftToBrowser(rowLink!);
  });
  expect(location.pathname).toBe('/rows/a');

  await act(async () => {
    clickLeftToBrowser(ownerLink!);
  });
  expect(location.pathname).toBe('/owners/a');
});
