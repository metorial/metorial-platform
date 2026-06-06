// @vitest-environment jsdom

import React, { act, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InitialLoadBoundary } from './initialLoad';
import { renderWithLoader, renderWithPagination } from './renderWithLoader';

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
    expectLoaderHidden(container, 'child-loading');

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
    expectLoaderHidden(container, 'child-loading');

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
});
