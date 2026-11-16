// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useRefreshUntilSettled } from './useRefreshUntilSettled';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let renders: { isRefreshing: boolean; hasTimedOut: boolean }[];
let refresh = vi.fn();

let Component = ({ settled, restartKey }: { settled: boolean; restartKey?: number }) => {
  let state = useRefreshUntilSettled({
    key: 'test',
    settled,
    restartKey,
    refresh,
    intervalMs: 100,
    timeoutMs: 1_000
  });
  renders.push(state);
  return null;
};

let render = (props: { settled: boolean; restartKey?: number }) =>
  act(async () => root.render(<Component {...props} />));

beforeEach(() => {
  vi.useFakeTimers();
  renders = [];
  refresh.mockClear();
  root = createRoot(document.createElement('div'));
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
});

it('refreshes until settled and stops after the timeout', async () => {
  await render({ settled: false });
  expect(renders.at(-1)).toEqual({ isRefreshing: true, hasTimedOut: false });

  await act(async () => vi.advanceTimersByTime(500));
  expect(refresh).toHaveBeenCalled();

  await act(async () => vi.advanceTimersByTime(600));
  expect(renders.at(-1)).toEqual({ isRefreshing: false, hasTimedOut: true });

  let calls = refresh.mock.calls.length;
  await act(async () => vi.advanceTimersByTime(500));
  expect(refresh.mock.calls.length).toBe(calls);
});

it('never shows the previous timeout once a new run starts', async () => {
  await render({ settled: false, restartKey: 1 });
  await act(async () => vi.advanceTimersByTime(1_100));
  expect(renders.at(-1)?.hasTimedOut).toBe(true);

  renders = [];
  await render({ settled: false, restartKey: 2 });
  expect(renders.every(state => !state.hasTimedOut && state.isRefreshing)).toBe(true);

  await act(async () => vi.advanceTimersByTime(1_100));
  await render({ settled: true, restartKey: 2 });

  renders = [];
  await render({ settled: false, restartKey: 2 });
  expect(renders.length).toBeGreaterThan(0);
  expect(renders.every(state => !state.hasTimedOut && state.isRefreshing)).toBe(true);
});
