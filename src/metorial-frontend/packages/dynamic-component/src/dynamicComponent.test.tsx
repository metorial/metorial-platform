// @vitest-environment jsdom

import { InitialLoadBoundary } from '@metorial/data-hooks';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dynamicPage } from './dynamicComponent';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let getByTestId = (container: HTMLElement, testId: string) =>
  container.querySelector(`[data-testid="${testId}"]`);

let expectLoaderVisible = (container: HTMLElement, testId: string) => {
  let loader = getByTestId(container, testId);
  expect(loader).not.toBeNull();
  expect((loader!.parentElement as HTMLElement).style.visibility).toBe('visible');
};

let expectLoaderInactive = (container: HTMLElement, testId: string) => {
  let loader = getByTestId(container, testId);
  expect(loader).not.toBeNull();
  expect((loader!.parentElement as HTMLElement).style.display).toBe('none');
};

let advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

describe('dynamicPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('registers chunk loading with InitialLoadBoundary', async () => {
    let resolvePage!: (component: () => React.ReactNode) => void;
    let Page = dynamicPage(
      () =>
        new Promise<() => React.ReactNode>(resolve => {
          resolvePage = resolve;
        })
    );

    await act(async () => {
      root.render(
        <InitialLoadBoundary
          loading={() => <div data-testid="boundary-loading">Boundary loading</div>}
        >
          <Page />
        </InitialLoadBoundary>
      );
    });

    expectLoaderVisible(container, 'boundary-loading');
    expect(getByTestId(container, 'page')).toBeNull();

    await advance(100);
    expectLoaderVisible(container, 'boundary-loading');

    await act(async () => {
      resolvePage(() => <div data-testid="page">Page</div>);
    });
    await advance(30);

    expectLoaderInactive(container, 'boundary-loading');
    expect(getByTestId(container, 'page')).not.toBeNull();
  });
});
