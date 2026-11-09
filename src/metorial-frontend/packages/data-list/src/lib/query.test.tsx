// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { expect, it } from 'vitest';
import { useFilterQuery } from './query';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let filters: any[] = [
  {
    id: 'status',
    fields: ['status'],
    label: 'Status',
    description: 'Filter by status',
    type: 'select',
    options: []
  },
  {
    id: 'createdAt',
    fields: ['createdAt'],
    label: 'Created',
    description: 'Filter by created',
    type: 'date'
  }
];

let seen: string[] = [];
let nav: ReturnType<typeof useNavigate>;
let setFilters: any;

let List = () => {
  let filterState = useState<any[]>([]);
  setFilters = filterState[1];
  let search = useState('');
  useFilterQuery({ filters, filterState, searchState: search, debouncedSearch: search[0] });
  return null;
};

let Probe = () => {
  let location = useLocation();
  nav = useNavigate();
  seen.push(location.pathname + location.search);
  return null;
};

let start =
  '/list?status=failed&createdAt_gte=2026-10-22T13%3A00%3A00.000Z&createdAt_lte=2026-10-22T13%3A14%3A59.999Z&chart_selection=1';

it('keeps the URL stable on mount and does not pull the user back after navigating away', async () => {
  let root = createRoot(document.createElement('div'));
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[start]}>
        <List />
        <Probe />
      </MemoryRouter>
    );
  });
  await act(async () => {
    await new Promise(r => setTimeout(r, 50));
  });
  expect(new Set(seen)).toEqual(new Set([start]));

  await act(async () => {
    nav('/detail/abc?tool_call_id=x');
  });
  await act(async () => {
    await new Promise(r => setTimeout(r, 50));
  });
  expect(seen.at(-1)).toBe('/detail/abc?tool_call_id=x');
  expect(seen.filter(s => s.startsWith('/list')).length).toBe(
    seen.indexOf('/detail/abc?tool_call_id=x')
  );
});

it('still writes user filter changes to the URL', async () => {
  seen = [];
  let root = createRoot(document.createElement('div'));
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/list']}>
        <List />
        <Probe />
      </MemoryRouter>
    );
  });
  await act(async () => {
    setFilters([
      { id: 'status', fields: ['status'], type: 'select', operation: 'eq', value: ['failed'] }
    ]);
  });
  expect(seen.at(-1)).toBe('/list?status=failed');
});
