// @vitest-environment jsdom

import React, { act, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InitialLoadBoundary, useInitialLoadRegistration } from './initialLoad';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let getByTestId = (container: HTMLElement, testId: string) =>
  container.querySelector(`[data-testid="${testId}"]`);

let getContentWrapper = (container: HTMLElement, testId: string) =>
  getByTestId(container, testId)!.parentElement as HTMLElement;

let getSpinnerWrapper = (container: HTMLElement) =>
  getByTestId(container, 'boundary-loading')!.parentElement as HTMLElement;

let expectContentHiddenButMeasurable = (container: HTMLElement, testId: string) => {
  let wrapper = getContentWrapper(container, testId);
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

let RegisteredContent = (p: { pending: boolean; testId: string }) => {
  useInitialLoadRegistration(p.pending);
  return <div data-testid={p.testId}>Content</div>;
};

let NullWhilePendingContent = (p: { pending: boolean }) => {
  useInitialLoadRegistration(p.pending);
  if (p.pending) return null;
  return <div data-testid="ready">Ready</div>;
};

describe('InitialLoadBoundary', () => {
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

  it('hides initial content until all pending work has settled', async () => {
    let controls: {
      setFileLoaded: (loaded: boolean) => void;
      setAgentsLoaded: (loaded: boolean) => void;
    };

    let App = () => {
      let [fileLoaded, setFileLoaded] = useState(false);
      let [agentsLoaded, setAgentsLoaded] = useState(false);
      controls = { setFileLoaded, setAgentsLoaded };

      return (
        <InitialLoadBoundary loading={() => <div data-testid="boundary-loading">Loading</div>}>
          <RegisteredContent pending={!fileLoaded} testId="files" />
          <RegisteredContent pending={!agentsLoaded} testId="agents" />
        </InitialLoadBoundary>
      );
    };

    await act(async () => {
      root.render(<App />);
    });

    expectContentHiddenButMeasurable(container, 'files');
    expect(getSpinnerWrapper(container).style.visibility).toBe('visible');

    await act(async () => {
      controls.setFileLoaded(true);
    });
    await advance(20);

    expectContentHiddenButMeasurable(container, 'files');
    expect(getSpinnerWrapper(container).style.visibility).toBe('visible');

    await act(async () => {
      controls.setAgentsLoaded(true);
    });
    await advance(9);

    expectContentHiddenButMeasurable(container, 'files');

    await advance(1);

    expect(getContentWrapper(container, 'files').style.display).toBe('contents');
    expect(getSpinnerWrapper(container).style.display).toBe('none');
  });

  it('keeps pending content measurable while hiding it visually', async () => {
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

    try {
      await act(async () => {
        root.render(
          <InitialLoadBoundary
            loading={() => <div data-testid="boundary-loading">Loading</div>}
          >
            <RegisteredContent pending={true} testId="measurable" />
          </InitialLoadBoundary>
        );
      });

      expectContentHiddenButMeasurable(container, 'measurable');
      expect(getByTestId(container, 'measurable')!.getBoundingClientRect().width).toBe(120);
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('renders cached content immediately when no pending work appears', async () => {
    await act(async () => {
      root.render(
        <InitialLoadBoundary loading={() => <div data-testid="boundary-loading">Loading</div>}>
          <RegisteredContent pending={false} testId="cached" />
        </InitialLoadBoundary>
      );
    });

    expect(getContentWrapper(container, 'cached').style.display).toBe('contents');
    expect(getSpinnerWrapper(container).style.display).toBe('none');

    await advance(20);

    expect(getContentWrapper(container, 'cached').style.display).toBe('contents');
    expect(getSpinnerWrapper(container).style.display).toBe('none');
  });

  it('shows the boundary spinner when pending children render no local content', async () => {
    await act(async () => {
      root.render(
        <InitialLoadBoundary loading={() => <div data-testid="boundary-loading">Loading</div>}>
          <NullWhilePendingContent pending={true} />
        </InitialLoadBoundary>
      );
    });

    expect(getByTestId(container, 'ready')).toBeNull();
    expect(getSpinnerWrapper(container).style.visibility).toBe('visible');
  });

  it('does not hide content or show the boundary spinner after the first reveal', async () => {
    let controls: {
      setPending: (pending: boolean) => void;
    };

    let App = () => {
      let [pending, setPending] = useState(false);
      controls = { setPending };

      return (
        <InitialLoadBoundary loading={() => <div data-testid="boundary-loading">Loading</div>}>
          <RegisteredContent pending={pending} testId="ready" />
        </InitialLoadBoundary>
      );
    };

    await act(async () => {
      root.render(<App />);
    });
    await advance(20);

    expect(getContentWrapper(container, 'ready').style.display).toBe('contents');

    await act(async () => {
      controls.setPending(true);
    });
    await advance(100);

    expect(getContentWrapper(container, 'ready').style.display).toBe('contents');
    expect(getSpinnerWrapper(container).style.display).toBe('none');
  });
});
