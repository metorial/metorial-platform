// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useLatestSearchParams, useSearchParamWriter } from './searchParams';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let router: ReturnType<typeof createMemoryRouter>;
let setParam: ReturnType<typeof useSearchParamWriter>[1];
let latest: ReturnType<typeof useLatestSearchParams>;

let Writer = () => {
  setParam = useSearchParamWriter()[1];
  return null;
};

let Sidebar = () => {
  latest = useLatestSearchParams();
  return null;
};

let render = async (search: string) => {
  router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <>
            <Writer />
            <Sidebar />
          </>
        )
      }
    ],
    { initialEntries: [`/${search}`] }
  );

  await act(async () => root.render(<RouterProvider router={router} />));
};

let search = () => new URLSearchParams(router.state.location.search);

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('latest search params', () => {
  it('keeps both of two writes made in the same tick', async () => {
    await render('?view=practices');

    await act(async () => {
      setParam('outdated', '50');
      setParam('flagged', '1');
    });

    expect(search().toString()).toBe('view=practices&outdated=50&flagged=1');
  });

  it('lets another component build on a write not rendered yet', async () => {
    await render('?view=practices');

    await act(async () => {
      setParam('outdated', '50');

      let next = latest.read();
      next.set('saved', 'atvw_1');
      latest.write(next);
    });

    expect(search().get('outdated')).toBe('50');
    expect(search().get('saved')).toBe('atvw_1');
  });

  it('never brings back a parameter a newer write removed', async () => {
    await render('?view=practices&flagged=1');

    await act(async () => {
      setParam('flagged', undefined);
      setParam('outdated', '50');
    });
    expect(search().has('flagged')).toBe(false);

    await act(async () => {
      setParam('cacheHit', '20');
    });
    expect(search().toString()).toBe('view=practices&outdated=50&cacheHit=20');
  });

  it('builds on a navigation made elsewhere once it is rendered', async () => {
    await render('?view=practices&outdated=50');

    await act(async () => {
      await router.navigate('/?view=seats');
    });
    await act(async () => {
      setParam('flagged', '1');
    });

    expect(search().toString()).toBe('view=seats&flagged=1');
  });
});
