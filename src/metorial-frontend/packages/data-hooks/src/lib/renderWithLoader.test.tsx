// @vitest-environment jsdom

import { internalServerError, ServiceError } from '@lowerdeck/error';
import React, { act, useEffect, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InitialLoadBoundary } from './initialLoad';
import {
  renderWithLoader,
  renderWithPagination,
  setLoaderErrorPresenter
} from './renderWithLoader';

let routerMock = vi.hoisted(() => ({
  setSearchParams: () => {}
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), routerMock.setSearchParams]
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let loader = (isLoaded: boolean) => ({
  input: undefined,
  data: isLoaded ? { loaded: true } : null,
  error: null,
  isLoading: !isLoaded,
  mutators: {},
  refetch: () => {}
});

let paginationLoader = (isLoaded: boolean) => ({
  input: undefined,
  data: isLoaded
    ? {
        items: [{ id: 'item-1' }],
        pagination: {
          hasMoreBefore: false,
          hasMoreAfter: false
        }
      }
    : null,
  error: null,
  isLoading: !isLoaded,
  mutators: {},
  next: () => {},
  previous: () => {},
  refetch: () => {}
});

let failingLoader = (refetch: () => void) => ({
  input: undefined,
  data: null,
  error: new ServiceError(internalServerError({ message: 'Unable to perform request' })),
  isLoading: false,
  mutators: {},
  refetch
});

let getByTestId = (container: HTMLElement, testId: string) =>
  container.querySelector(`[data-testid="${testId}"]`);

let expectLoaderHidden = (container: HTMLElement, testId: string) => {
  let loader = getByTestId(container, testId);
  expect(loader).not.toBeNull();
  expect((loader!.parentElement as HTMLElement).style.visibility).toBe('hidden');
};

let expectLoaderVisible = (container: HTMLElement, testId: string) => {
  let loader = getByTestId(container, testId);
  expect(loader).not.toBeNull();
  expect((loader!.parentElement as HTMLElement).style.visibility).toBe('visible');
};

let expectContentHiddenButMeasurable = (container: HTMLElement, testId: string) => {
  let content = getByTestId(container, testId);
  expect(content).not.toBeNull();

  let wrapper = content!.parentElement as HTMLElement;
  expect(wrapper.style.display).toBe('block');
  expect(wrapper.style.height).toBe('0px');
  expect(wrapper.style.overflow).toBe('hidden');
  expect(wrapper.style.pointerEvents).toBe('none');
  expect(wrapper.style.visibility).toBe('hidden');
};

let advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

describe('renderWithLoader', () => {
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

  it('keeps the root initial spinner until nested loaders finish their first load', async () => {
    let controls: {
      setParentLoaded: (loaded: boolean) => void;
      setChildLoaded: (loaded: boolean) => void;
      setGrandchildLoaded: (loaded: boolean) => void;
    };

    let Grandchild = ({ loaded }: { loaded: boolean }) =>
      renderWithLoader(
        { grandchild: loader(loaded) },
        { loading: () => <div data-testid="grandchild-loading">Grandchild loading</div> }
      )(() => <div data-testid="ready">Ready</div>);

    let Child = ({
      childLoaded,
      grandchildLoaded
    }: {
      childLoaded: boolean;
      grandchildLoaded: boolean;
    }) =>
      renderWithLoader(
        { child: loader(childLoaded) },
        { loading: () => <div data-testid="child-loading">Child loading</div> }
      )(() => <Grandchild loaded={grandchildLoaded} />);

    let App = () => {
      let [parentLoaded, setParentLoaded] = useState(false);
      let [childLoaded, setChildLoaded] = useState(false);
      let [grandchildLoaded, setGrandchildLoaded] = useState(false);

      controls = { setParentLoaded, setChildLoaded, setGrandchildLoaded };

      return renderWithLoader(
        { parent: loader(parentLoaded) },
        { loading: () => <div data-testid="root-loading">Root loading</div> }
      )(() => <Child childLoaded={childLoaded} grandchildLoaded={grandchildLoaded} />);
    };

    await act(async () => {
      root.render(<App />);
    });

    expectLoaderHidden(container, 'root-loading');
    expect(getByTestId(container, 'child-loading')).toBeNull();

    await advance(100);
    expectLoaderVisible(container, 'root-loading');

    await act(async () => {
      controls.setParentLoaded(true);
    });

    expectLoaderVisible(container, 'root-loading');
    expect(getByTestId(container, 'ready')).toBeNull();

    await act(async () => {
      controls.setChildLoaded(true);
    });

    expectLoaderVisible(container, 'root-loading');
    expect(getByTestId(container, 'ready')).toBeNull();

    await act(async () => {
      controls.setGrandchildLoaded(true);
    });

    await advance(9);
    expectLoaderVisible(container, 'root-loading');

    await advance(30);
    expect(getByTestId(container, 'root-loading')).toBeNull();
    expect(getByTestId(container, 'child-loading')).toBeNull();
    expect(getByTestId(container, 'grandchild-loading')).toBeNull();
    expect(getByTestId(container, 'ready')).not.toBeNull();
  });

  it('does not show the root spinner for nested reloads after the first reveal', async () => {
    let controls: {
      setChildLoaded: (loaded: boolean) => void;
    };

    let Child = ({ loaded }: { loaded: boolean }) =>
      renderWithLoader(
        { child: loader(loaded) },
        { loading: () => <div data-testid="child-loading">Child loading</div> }
      )(() => <div data-testid="ready">Ready</div>);

    let App = () => {
      let [childLoaded, setChildLoaded] = useState(true);
      controls = { setChildLoaded };

      return renderWithLoader(
        { parent: loader(true) },
        { loading: () => <div data-testid="root-loading">Root loading</div> }
      )(() => <Child loaded={childLoaded} />);
    };

    await act(async () => {
      root.render(<App />);
    });
    await advance(10);

    expect(getByTestId(container, 'root-loading')).toBeNull();
    expect(getByTestId(container, 'ready')).not.toBeNull();

    await act(async () => {
      controls.setChildLoaded(false);
    });

    expect(getByTestId(container, 'root-loading')).toBeNull();
    expect(getByTestId(container, 'child-loading')).toBeNull();
    expect(getByTestId(container, 'ready')).not.toBeNull();

    await advance(100);
    expect(getByTestId(container, 'root-loading')).toBeNull();
    expectLoaderVisible(container, 'child-loading');
    expect(getByTestId(container, 'ready')).toBeNull();
  });

  it('does not accept nested registrations after the parent has revealed', async () => {
    let controls: {
      setChildLoaded: (loaded: boolean) => void;
    };
    let parentChildrenRenderCount = 0;

    let Child = ({ loaded }: { loaded: boolean }) =>
      renderWithLoader(
        { child: loader(loaded) },
        { loading: () => <div data-testid="child-loading">Child loading</div> }
      )(() => <div data-testid="ready">Ready</div>);

    let App = () => {
      let [childLoaded, setChildLoaded] = useState(true);
      controls = { setChildLoaded };

      return renderWithLoader(
        { parent: loader(true) },
        { loading: () => <div data-testid="root-loading">Root loading</div> }
      )(() => {
        parentChildrenRenderCount++;

        return <Child loaded={childLoaded} />;
      });
    };

    await act(async () => {
      root.render(<App />);
    });
    await advance(10);

    let countAfterReveal = parentChildrenRenderCount;
    expect(getByTestId(container, 'root-loading')).toBeNull();
    expect(getByTestId(container, 'ready')).not.toBeNull();

    await act(async () => {
      controls.setChildLoaded(false);
    });

    expect(parentChildrenRenderCount).toBe(countAfterReveal + 1);
    expect(getByTestId(container, 'root-loading')).toBeNull();
    expect(getByTestId(container, 'child-loading')).toBeNull();
    expect(getByTestId(container, 'ready')).not.toBeNull();

    await advance(100);
    expect(parentChildrenRenderCount).toBe(countAfterReveal + 1);
    expect(getByTestId(container, 'root-loading')).toBeNull();
    expectLoaderVisible(container, 'child-loading');
  });

  it('does not show a spinner for initial loading that resolves before the delay', async () => {
    let controls: {
      setLoaded: (loaded: boolean) => void;
    };

    let App = () => {
      let [loaded, setLoaded] = useState(false);
      controls = { setLoaded };

      return renderWithLoader(
        { parent: loader(loaded) },
        { loading: () => <div data-testid="root-loading">Root loading</div> }
      )(() => <div data-testid="ready">Ready</div>);
    };

    await act(async () => {
      root.render(<App />);
    });

    expectLoaderHidden(container, 'root-loading');

    await advance(50);
    await act(async () => {
      controls.setLoaded(true);
    });
    await advance(50);

    expect(getByTestId(container, 'root-loading')).toBeNull();
    expect(getByTestId(container, 'ready')).not.toBeNull();
  });

  it('keeps the spinner mounted while moving from local load to nested discovery', async () => {
    let controls: {
      setParentLoaded: (loaded: boolean) => void;
      setChildLoaded: (loaded: boolean) => void;
    };
    let spinnerMounts = 0;

    class Loading extends React.Component {
      componentDidMount() {
        spinnerMounts++;
      }

      render() {
        return <div data-testid="root-loading">Root loading</div>;
      }
    }

    let Child = ({ loaded }: { loaded: boolean }) =>
      renderWithLoader(
        { child: loader(loaded) },
        { loading: () => <div data-testid="child-loading">Child loading</div> }
      )(() => <div data-testid="ready">Ready</div>);

    let App = () => {
      let [parentLoaded, setParentLoaded] = useState(false);
      let [childLoaded, setChildLoaded] = useState(false);
      controls = { setParentLoaded, setChildLoaded };

      return renderWithLoader(
        { parent: loader(parentLoaded) },
        { loading: () => <Loading /> }
      )(() => <Child loaded={childLoaded} />);
    };

    await act(async () => {
      root.render(<App />);
    });

    expect(spinnerMounts).toBe(1);
    expectLoaderHidden(container, 'root-loading');

    await advance(100);
    expect(spinnerMounts).toBe(1);
    expectLoaderVisible(container, 'root-loading');

    await act(async () => {
      controls.setParentLoaded(true);
    });
    await act(async () => {
      controls.setChildLoaded(true);
    });

    expect(spinnerMounts).toBe(1);

    await advance(30);
    expect(getByTestId(container, 'root-loading')).toBeNull();
    expect(getByTestId(container, 'ready')).not.toBeNull();
  });

  it('keeps discovery content measurable while hiding it visually', async () => {
    let controls: {
      setParentLoaded: (loaded: boolean) => void;
    };
    let rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        let parent = this.parentElement as HTMLElement | null;
        let width = parent?.style.display == 'none' ? 0 : 120;

        return {
          bottom: 20,
          height: 20,
          left: 0,
          right: width,
          toJSON: () => ({}),
          top: 0,
          width,
          x: 0,
          y: 0
        };
      });

    let Child = () =>
      renderWithLoader(
        { child: loader(false) },
        { loading: () => <div data-testid="child-loading">Child loading</div> }
      )(() => <div data-testid="child-ready">Child ready</div>);

    let App = () => {
      let [parentLoaded, setParentLoaded] = useState(false);
      controls = { setParentLoaded };

      return renderWithLoader(
        { parent: loader(parentLoaded) },
        { loading: () => <div data-testid="root-loading">Root loading</div> }
      )(() => (
        <>
          <div data-testid="measurable">Measurable content</div>
          <Child />
        </>
      ));
    };

    try {
      await act(async () => {
        root.render(<App />);
      });

      await act(async () => {
        controls.setParentLoaded(true);
      });

      expectContentHiddenButMeasurable(container, 'measurable');
      expect(getByTestId(container, 'measurable')!.getBoundingClientRect().width).toBe(120);
      expect(getByTestId(container, 'root-loading')).not.toBeNull();
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('renders cached data immediately without running hidden discovery', async () => {
    let App = () =>
      renderWithLoader(
        { parent: loader(true) },
        { loading: () => <div data-testid="root-loading">Root loading</div> }
      )(() => <div data-testid="ready">Ready</div>);

    await act(async () => {
      root.render(<App />);
    });

    expect(getByTestId(container, 'root-loading')).toBeNull();
    expect(getByTestId(container, 'ready')).not.toBeNull();
  });

  it('shows local pagination loading after a boundary has revealed', async () => {
    let controls: {
      setShowPagination: (showPagination: boolean) => void;
    };

    let PaginationPage = () =>
      renderWithPagination(paginationLoader(false), {
        loading: () => <div data-testid="pagination-loading">Pagination loading</div>
      })(() => <div data-testid="pagination-ready">Pagination ready</div>);

    let App = () => {
      let [showPagination, setShowPagination] = useState(false);
      controls = { setShowPagination };

      return (
        <InitialLoadBoundary
          loading={() => <div data-testid="boundary-loading">Boundary loading</div>}
        >
          {showPagination ? <PaginationPage /> : <div data-testid="ready">Ready</div>}
        </InitialLoadBoundary>
      );
    };

    await act(async () => {
      root.render(<App />);
    });
    await advance(20);

    expect(getByTestId(container, 'ready')).not.toBeNull();
    expect(
      (getByTestId(container, 'boundary-loading')!.parentElement as HTMLElement).style.display
    ).toBe('none');

    await act(async () => {
      controls.setShowPagination(true);
    });

    expect(
      (getByTestId(container, 'boundary-loading')!.parentElement as HTMLElement).style.display
    ).toBe('none');
    expect(getByTestId(container, 'pagination-loading')).not.toBeNull();
    expect(getByTestId(container, 'pagination-ready')).toBeNull();
  });

  it('keeps previous content during a quick reload instead of blanking it', async () => {
    let controls: {
      setLoaded: (loaded: boolean) => void;
    };

    let App = () => {
      let [loaded, setLoaded] = useState(true);
      controls = { setLoaded };

      return renderWithLoader(
        { data: loader(loaded) },
        { loading: () => <div data-testid="loading">Loading</div> }
      )(() => <div data-testid="ready">Ready</div>);
    };

    await act(async () => {
      root.render(<App />);
    });

    let ready = getByTestId(container, 'ready');
    expect(ready).not.toBeNull();

    await act(async () => {
      controls.setLoaded(false);
    });

    expect(getByTestId(container, 'loading')).toBeNull();
    expect(getByTestId(container, 'ready')).toBe(ready);

    await advance(50);

    await act(async () => {
      controls.setLoaded(true);
    });

    expect(getByTestId(container, 'loading')).toBeNull();
    expect(getByTestId(container, 'ready')).toBe(ready);

    await advance(100);
    expect(getByTestId(container, 'loading')).toBeNull();
    expect(getByTestId(container, 'ready')).toBe(ready);
  });

  it('does not remount children when the parent re-renders', async () => {
    let controls: {
      rerender: () => void;
    };
    let mounts = { loader: 0, pagination: 0 };
    let loaded = loader(true);
    let loadedPage = paginationLoader(true);

    let Counted = ({ kind }: { kind: keyof typeof mounts }) => {
      useEffect(() => {
        mounts[kind]++;
      }, []);

      return null;
    };

    let App = () => {
      let [, setTick] = useState(0);
      controls = { rerender: () => setTick(tick => tick + 1) };

      return (
        <>
          {renderWithLoader({ data: loaded })(() => (
            <Counted kind="loader" />
          ))}
          {renderWithPagination(loadedPage)(() => (
            <Counted kind="pagination" />
          ))}
        </>
      );
    };

    await act(async () => {
      root.render(<App />);
    });

    expect(mounts).toEqual({ loader: 1, pagination: 1 });

    await act(async () => {
      controls.rerender();
    });
    await act(async () => {
      controls.rerender();
    });

    expect(mounts).toEqual({ loader: 1, pagination: 1 });
  });

  it('keeps hook state inside pagination children across parent renders', async () => {
    let controls: {
      rerender: () => void;
      increment: () => void;
    };

    let loadedPage = paginationLoader(true);

    let App = () => {
      let [, setTick] = useState(0);

      return renderWithPagination(loadedPage)(() => {
        let [count, setCount] = useState(0);
        controls = {
          rerender: () => setTick(tick => tick + 1),
          increment: () => setCount(count => count + 1)
        };

        return <div data-testid="count">{count}</div>;
      });
    };

    await act(async () => {
      root.render(<App />);
    });
    await act(async () => {
      controls.increment();
    });
    await act(async () => {
      controls.rerender();
    });

    expect(getByTestId(container, 'count')!.textContent).toBe('1');
  });

  it('delays the initial pagination spinner', async () => {
    let App = () =>
      renderWithPagination(paginationLoader(false), {
        loading: () => <div data-testid="pagination-loading">Pagination loading</div>
      })(() => <div data-testid="pagination-ready">Pagination ready</div>);

    await act(async () => {
      root.render(<App />);
    });

    expectLoaderHidden(container, 'pagination-loading');

    await advance(100);
    expectLoaderVisible(container, 'pagination-loading');
  });

  it('keeps the parent spinner until nested pagination finishes its first load', async () => {
    let controls: {
      setParentLoaded: (loaded: boolean) => void;
      setPaginationLoaded: (loaded: boolean) => void;
    };

    let Nested = ({ loaded }: { loaded: boolean }) =>
      renderWithPagination(paginationLoader(loaded))(() => (
        <div data-testid="pagination-ready">Pagination ready</div>
      ));

    let App = () => {
      let [parentLoaded, setParentLoaded] = useState(false);
      let [paginationLoaded, setPaginationLoaded] = useState(false);
      controls = { setParentLoaded, setPaginationLoaded };

      return renderWithLoader(
        { parent: loader(parentLoaded) },
        { loading: () => <div data-testid="root-loading">Root loading</div> }
      )(() => <Nested loaded={paginationLoaded} />);
    };

    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      controls.setParentLoaded(true);
    });
    await advance(50);

    expect(getByTestId(container, 'root-loading')).not.toBeNull();

    await act(async () => {
      controls.setPaginationLoaded(true);
    });
    await advance(20);

    expect(getByTestId(container, 'root-loading')).toBeNull();
    expect(getByTestId(container, 'pagination-ready')).not.toBeNull();
  });
});

describe('loader error presenter', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    setLoaderErrorPresenter(null);
    act(() => root.unmount());
    container.remove();
  });

  let presentRetryButton = () =>
    setLoaderErrorPresenter(({ retry }) => (
      <button data-testid="retry" onClick={() => retry?.()}>
        Try again
      </button>
    ));

  it('renders the default error when no presenter is set', () => {
    let Page = () =>
      renderWithLoader({ item: failingLoader(() => {}) })(() => <div>never</div>);
    act(() => root.render(<Page />));

    expect(container.textContent).toContain('Unable to perform request');
  });

  it('lets a host present the error and retry only the failed loaders', async () => {
    let failedRefetch = vi.fn();
    let healthyRefetch = vi.fn();
    presentRetryButton();

    let Page = () =>
      renderWithLoader({
        ok: { ...loader(true), refetch: healthyRefetch },
        bad: failingLoader(failedRefetch)
      })(() => <div>never</div>);
    act(() => root.render(<Page />));

    let retry = getByTestId(container, 'retry') as HTMLButtonElement;
    expect(retry).not.toBeNull();

    await act(async () => retry.click());
    expect(failedRefetch).toHaveBeenCalledTimes(1);
    expect(healthyRefetch).not.toHaveBeenCalled();
  });

  it('passes no retry when no failed loader can refetch', () => {
    let receivedRetry: unknown = 'unset';
    setLoaderErrorPresenter(({ retry }) => {
      receivedRetry = retry;
      return null;
    });

    let Page = () =>
      renderWithLoader({ item: { ...failingLoader(() => {}), refetch: undefined } })(() => (
        <div>never</div>
      ));
    act(() => root.render(<Page />));

    expect(receivedRetry).toBeUndefined();
  });

  it('falls back to the default rendering when the presenter returns undefined', () => {
    setLoaderErrorPresenter(() => undefined);

    let Page = () =>
      renderWithLoader({ item: failingLoader(() => {}) })(() => <div>never</div>);
    act(() => root.render(<Page />));

    expect(container.textContent).toContain('Unable to perform request');
  });

  it('prefers a per-call error renderer over the presenter', () => {
    presentRetryButton();

    let Page = () =>
      renderWithLoader(
        { item: failingLoader(() => {}) },
        { error: () => <div data-testid="custom-error">Custom</div> }
      )(() => <div>never</div>);
    act(() => root.render(<Page />));

    expect(getByTestId(container, 'custom-error')).not.toBeNull();
    expect(getByTestId(container, 'retry')).toBeNull();
  });

  it('retries a failed paginated loader', async () => {
    let refetch = vi.fn();
    presentRetryButton();

    let Page = () =>
      renderWithPagination({
        ...paginationLoader(true),
        data: null,
        ...failingLoader(refetch)
      })(() => <div>never</div>);
    act(() => root.render(<Page />));

    await act(async () => (getByTestId(container, 'retry') as HTMLButtonElement).click());
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
