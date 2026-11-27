// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { usePaginator } from './usePaginator';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@metorial/data-hooks', () => ({ usePaginationSearchParamsEnabled: () => false }));

it('resets panel pagination when the search key changes and when it is cleared', async () => {
  let host = document.createElement('div');
  let root = createRoot(host);
  let cursor: any;
  let paginator: any;
  let Component = ({ search }: { search: string }) => {
    paginator = usePaginator(opts => {
      cursor = opts;
      return {
        data: {
          items: [{ id: 'last' }],
          pagination: { hasMoreAfter: true, hasMoreBefore: false }
        }
      };
    }, search);
    return null;
  };
  let render = (search: string) =>
    act(async () =>
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Component search={search} />
        </MemoryRouter>
      )
    );

  try {
    await render('');
    await act(async () => paginator.next());
    expect(cursor).toEqual({ after: 'last' });

    await render('Private');
    expect(cursor).toEqual({});
    await act(async () => paginator.next());
    expect(cursor).toEqual({ after: 'last' });

    await render('');
    expect(cursor).toEqual({});
  } finally {
    await act(async () => root.unmount());
  }
});
