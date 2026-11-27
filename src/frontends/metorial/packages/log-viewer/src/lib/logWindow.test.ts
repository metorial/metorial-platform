import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { paginateLogLines } from '../staticSource';
import type { LogFetchOptions, LogLine, LogPage, LogSource, LogStatus } from '../types';
import {
  appendPage,
  createHeadWindow,
  createTailWindow,
  evictLines,
  LogWindow,
  type LogWindowOptions,
  type LogWindowState,
  prependPage
} from './logWindow';

class FakeLogSource implements LogSource {
  lines: LogLine[] = [];
  status: LogStatus;
  requests: LogFetchOptions[] = [];
  failures: Error[] = [];

  holding = false;
  private held: (() => void)[] = [];

  constructor(count: number, status: LogStatus = 'open') {
    this.status = status;
    this.append(count);
  }

  append(count: number) {
    let first = this.lines.length;

    for (let offset = 0; offset < count; offset++) {
      this.lines.push({ index: first + offset, text: `line ${first + offset}` });
    }
  }

  release() {
    let held = this.held;
    this.held = [];
    held.forEach(resolve => resolve());
  }

  fetch = async (opts: LogFetchOptions): Promise<LogPage> => {
    this.requests.push(opts);

    if (this.holding) await new Promise<void>(resolve => this.held.push(resolve));
    if (opts.signal?.aborted)
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' });

    let failure = this.failures.shift();
    if (failure) throw failure;

    return {
      ...paginateLogLines(this.lines, opts),
      status: this.status,
      lineCount: this.lines.length
    };
  };

  lastRequest() {
    return this.requests[this.requests.length - 1];
  }
}

let createWindow = (source: LogSource, opts: Partial<LogWindowOptions> = {}) =>
  new LogWindow({ source, ...opts });

let expectContiguous = (state: LogWindowState) => {
  let indexes = state.lines.map(line => line.index);

  indexes.forEach((index, position) => {
    if (position > 0) expect(index).toBe(indexes[position - 1] + 1);
  });

  if (indexes.length) {
    expect(indexes[0]).toBe(state.start);
    expect(indexes[indexes.length - 1] + 1).toBe(state.end);
  }
};

let page = (indexes: number[], hasMore: boolean): LogPage => ({
  lines: indexes.map(index => ({ index, text: `line ${index}` })),
  hasMore,
  status: 'sealed'
});

let range = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, offset) => from + offset);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('window helpers', () => {
  it('builds a tail window that knows whether older lines exist', () => {
    expect(createTailWindow(page(range(700, 1000), true))).toMatchObject({
      start: 700,
      end: 1000,
      hasBefore: true,
      atTail: true
    });

    expect(createTailWindow(page(range(0, 50), false))).toMatchObject({
      start: 0,
      end: 50,
      hasBefore: false
    });

    expect(createTailWindow({ ...page([], false), lineCount: 0 })).toMatchObject({
      lines: [],
      start: 0,
      end: 0,
      hasBefore: false,
      atTail: true
    });
  });

  it('builds a head window that only reaches the tail when nothing is left', () => {
    expect(createHeadWindow(page(range(0, 100), true))).toMatchObject({
      start: 0,
      end: 100,
      atTail: false
    });

    expect(createHeadWindow(page(range(0, 100), false)).atTail).toBe(true);
  });

  it('ignores overlapping lines when merging pages', () => {
    let window = createTailWindow(page(range(100, 200), true));

    let prepended = prependPage(window, page(range(50, 150), true));
    expect(prepended.lines.map(line => line.index)).toEqual(range(50, 200));

    let head = createHeadWindow(page(range(0, 100), true));
    let appended = appendPage(head, page(range(90, 120), false), { follow: false });

    expect(appended.lines.map(line => line.index)).toEqual(range(0, 120));
    expect(appended.atTail).toBe(true);
  });

  it('stops paging when a page brings nothing new', () => {
    let window = createTailWindow(page(range(100, 200), true));

    expect(prependPage(window, page([], true)).hasBefore).toBe(false);

    let head = createHeadWindow(page(range(0, 100), true));
    expect(appendPage(head, page([], true), { follow: false }).atTail).toBe(true);
  });

  it('drops the side of the window farthest from the focus', () => {
    let window = createTailWindow(page(range(0, 100), false));

    let nearStart = evictLines(window, 60, 10);
    expect(nearStart).toMatchObject({ start: 0, end: 60, atTail: false });

    let nearEnd = evictLines(window, 60, 90);
    expect(nearEnd).toMatchObject({ start: 40, end: 100, hasBefore: true, atTail: true });

    expect(evictLines(window, 200, 0)).toBe(window);
  });
});

describe('LogWindow', () => {
  it('opens at the newest lines and pins to the bottom', async () => {
    let source = new FakeLogSource(1000, 'sealed');
    let log = createWindow(source);

    await log.start();

    expect(source.requests).toHaveLength(1);
    expect(source.requests[0]).toMatchObject({ direction: 'backward', limit: 300 });
    expect(source.requests[0].cursor).toBeUndefined();

    let state = log.getState();
    expect(state).toMatchObject({
      phase: 'ready',
      start: 700,
      end: 1000,
      hasBefore: true,
      atTail: true,
      pinned: true,
      status: 'sealed',
      totalLines: 1000,
      scrollRequest: { target: 'bottom' }
    });
    expectContiguous(state);
  });

  it('prepends older pages backward from the first loaded index until index 0', async () => {
    let source = new FakeLogSource(2500, 'sealed');
    let log = createWindow(source);

    await log.start();
    await log.loadBefore();

    expect(source.lastRequest()).toMatchObject({
      direction: 'backward',
      cursor: 2200,
      limit: 1000
    });
    expect(log.getState()).toMatchObject({ start: 1200, end: 2500, hasBefore: true });
    expectContiguous(log.getState());

    await log.loadBefore();
    await log.loadBefore();

    expect(log.getState()).toMatchObject({ start: 0, hasBefore: false });
    expect(log.getState().lines).toHaveLength(2500);
    expectContiguous(log.getState());

    await log.loadBefore();
    expect(source.requests).toHaveLength(4);
  });

  it('runs only one load per direction at a time', async () => {
    let source = new FakeLogSource(2500, 'sealed');
    let log = createWindow(source);

    await log.start();
    await Promise.all([log.loadBefore(), log.loadBefore(), log.loadBefore()]);

    expect(source.requests).toHaveLength(2);
    expect(log.getState().start).toBe(1200);
  });

  it('follows a live log by polling forward from the last index', async () => {
    let source = new FakeLogSource(500);
    let log = createWindow(source);

    await log.start();
    source.append(20);

    await vi.advanceTimersByTimeAsync(1999);
    expect(source.requests).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(source.lastRequest()).toMatchObject({
      direction: 'forward',
      cursor: 500,
      limit: 1000
    });

    expect(log.getState()).toMatchObject({ end: 520, atTail: true, newLineCount: 0 });
    expectContiguous(log.getState());
  });

  it('counts new lines while the reader is away from the bottom', async () => {
    let source = new FakeLogSource(100);
    let log = createWindow(source);

    await log.start();
    log.setPinned(false);

    source.append(18);
    await vi.advanceTimersByTimeAsync(2000);
    expect(log.getState().newLineCount).toBe(18);

    source.append(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(log.getState().newLineCount).toBe(20);

    let requestCount = source.requests.length;
    await log.jumpToLatest();

    expect(source.requests).toHaveLength(requestCount);
    expect(log.getState()).toMatchObject({
      pinned: true,
      newLineCount: 0,
      scrollRequest: { target: 'bottom' }
    });
  });

  it('catches up on bursts larger than a page without waiting for the next tick', async () => {
    let source = new FakeLogSource(50);
    let log = createWindow(source, { pageSize: 100 });

    await log.start();
    source.append(250);
    await vi.advanceTimersByTimeAsync(2000);

    for (let step = 0; step < 5; step++) await vi.advanceTimersByTimeAsync(1);

    let forward = source.requests.filter(request => request.direction == 'forward');
    expect(forward.map(request => request.cursor)).toEqual([50, 150, 250]);
    expect(log.getState().end).toBe(300);
    expectContiguous(log.getState());
  });

  it('stops polling once the log is sealed', async () => {
    let source = new FakeLogSource(10);
    let log = createWindow(source);

    await log.start();
    source.append(5);
    source.status = 'sealed';

    await vi.advanceTimersByTimeAsync(2000);
    expect(log.getState()).toMatchObject({ status: 'sealed', end: 15 });

    let requestCount = source.requests.length;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(source.requests).toHaveLength(requestCount);
  });

  it('pauses polling while hidden and catches up when visible again', async () => {
    let source = new FakeLogSource(10);
    let log = createWindow(source);

    await log.start();
    log.setVisible(false);
    source.append(5);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(source.requests).toHaveLength(1);

    log.setVisible(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(source.requests).toHaveLength(2);
    expect(log.getState().end).toBe(15);
  });

  it('jumps to the start and loads forward until the window meets the live tail', async () => {
    let source = new FakeLogSource(2500);
    let log = createWindow(source);

    await log.start();
    await log.jumpToStart();

    expect(source.lastRequest()).toMatchObject({ direction: 'forward', limit: 1000 });
    expect(source.lastRequest().cursor).toBeUndefined();
    expect(log.getState()).toMatchObject({
      start: 0,
      end: 1000,
      hasBefore: false,
      atTail: false,
      pinned: false,
      scrollRequest: { target: 'top' }
    });

    source.append(100);
    await vi.advanceTimersByTimeAsync(2000);

    expect(source.lastRequest()).toMatchObject({ direction: 'backward', limit: 1 });
    expect(log.getState()).toMatchObject({ end: 1000, totalLines: 2600 });

    await log.loadAfter();
    expect(source.lastRequest()).toMatchObject({ direction: 'forward', cursor: 1000 });
    expect(log.getState().atTail).toBe(false);

    await log.loadAfter();
    expect(log.getState()).toMatchObject({ start: 0, end: 2600, atTail: true });
    expectContiguous(log.getState());

    source.append(10);
    await vi.advanceTimersByTimeAsync(2000);

    expect(source.lastRequest()).toMatchObject({ direction: 'forward', cursor: 2600 });
    expect(log.getState().end).toBe(2610);
  });

  it('only scrolls to the top when the window already holds the first line', async () => {
    let source = new FakeLogSource(100, 'sealed');
    let log = createWindow(source);

    await log.start();
    await log.jumpToStart();

    expect(source.requests).toHaveLength(1);
    expect(log.getState()).toMatchObject({ pinned: false, scrollRequest: { target: 'top' } });
  });

  it('jumps back to the latest lines from a head window', async () => {
    let source = new FakeLogSource(5000, 'sealed');
    let log = createWindow(source);

    await log.start();
    await log.jumpToStart();
    await log.jumpToLatest();

    expect(source.lastRequest()).toMatchObject({ direction: 'backward', limit: 300 });
    expect(log.getState()).toMatchObject({
      start: 4700,
      end: 5000,
      atTail: true,
      pinned: true,
      scrollRequest: { target: 'bottom' }
    });
  });

  it('caps the window and refetches evicted lines when the reader scrolls back', async () => {
    let source = new FakeLogSource(5000, 'sealed');
    let log = createWindow(source, { maxLines: 2500 });

    await log.start();
    await log.loadBefore();
    await log.loadBefore();
    await log.loadBefore();

    expect(log.getState()).toMatchObject({ start: 1700, end: 4200, atTail: false });
    expect(log.getState().lines).toHaveLength(2500);
    expectContiguous(log.getState());

    await log.loadAfter();

    expect(source.lastRequest()).toMatchObject({ direction: 'forward', cursor: 4200 });
    expect(log.getState()).toMatchObject({
      start: 2500,
      end: 5000,
      hasBefore: true,
      atTail: true
    });
    expectContiguous(log.getState());

    await log.loadBefore();
    expect(source.lastRequest()).toMatchObject({ direction: 'backward', cursor: 2500 });
    expect(log.getState().start).toBe(1500);
  });

  it('evicts old lines while following, and stops following when the reader is far up', async () => {
    let source = new FakeLogSource(300);
    let log = createWindow(source, { maxLines: 500 });

    await log.start();
    source.append(400);
    await vi.advanceTimersByTimeAsync(2000);

    expect(log.getState()).toMatchObject({
      start: 200,
      end: 700,
      hasBefore: true,
      atTail: true
    });

    log.setPinned(false);
    log.setFocus(250);
    source.append(100);
    await vi.advanceTimersByTimeAsync(2000);

    expect(log.getState()).toMatchObject({ start: 200, end: 700, atTail: false });
    expectContiguous(log.getState());

    await vi.advanceTimersByTimeAsync(2000);
    expect(source.lastRequest()).toMatchObject({ direction: 'backward', limit: 1 });
    expect(log.getState().totalLines).toBe(800);
  });

  it('surfaces a failed first load and retries it', async () => {
    let source = new FakeLogSource(100, 'sealed');
    source.failures.push(new Error('boom'));

    let log = createWindow(source);
    await log.start();

    expect(log.getState()).toMatchObject({ phase: 'error' });
    expect(log.getState().error?.message).toBe('boom');

    await log.retry();
    expect(log.getState()).toMatchObject({ phase: 'ready', error: null, end: 100 });
  });

  it('holds a failed page load until it is retried', async () => {
    let source = new FakeLogSource(2000, 'sealed');
    let log = createWindow(source);

    await log.start();
    source.failures.push(new Error('offline'));
    await log.loadBefore();

    expect(log.getState().beforeError?.message).toBe('offline');
    expect(log.getState().loadingBefore).toBe(false);

    await log.loadBefore();
    expect(source.requests).toHaveLength(2);

    await log.retry();
    expect(log.getState()).toMatchObject({ beforeError: null, start: 700 });
  });

  it('backs off polling after failures and recovers', async () => {
    let source = new FakeLogSource(10);
    let log = createWindow(source);

    await log.start();
    source.failures.push(new Error('a'), new Error('b'));

    await vi.advanceTimersByTimeAsync(2000);
    expect(source.requests).toHaveLength(2);
    expect(log.getState().pollError?.message).toBe('a');

    await vi.advanceTimersByTimeAsync(3999);
    expect(source.requests).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(1);
    expect(source.requests).toHaveLength(3);

    source.append(3);
    await vi.advanceTimersByTimeAsync(8000);

    expect(source.requests).toHaveLength(4);
    expect(log.getState()).toMatchObject({ pollError: null, end: 13 });
  });

  it('aborts in-flight requests on dispose and ignores late responses', async () => {
    let source = new FakeLogSource(100);
    source.holding = true;

    let log = createWindow(source);
    let loading = log.start();

    expect(source.requests[0].signal?.aborted).toBe(false);

    log.dispose();
    expect(source.requests[0].signal?.aborted).toBe(true);

    source.release();
    await loading;

    expect(log.getState().phase).toBe('loading');
  });

  it('drops responses that belong to a replaced window', async () => {
    let source = new FakeLogSource(3000, 'sealed');
    source.holding = true;

    let log = createWindow(source);
    let latest = log.start();
    let start = log.jumpToStart();

    source.release();
    await Promise.all([latest, start]);

    expect(source.requests[0].signal?.aborted).toBe(true);
    expect(log.getState()).toMatchObject({ phase: 'ready', start: 0, end: 1000 });
  });

  it('notifies subscribers only when the state changes', async () => {
    let source = new FakeLogSource(10, 'sealed');
    let log = createWindow(source);
    let listener = vi.fn();

    log.subscribe(listener);
    await log.start();

    let calls = listener.mock.calls.length;
    log.setPinned(true);
    log.setFocus(3);

    expect(listener.mock.calls.length).toBe(calls);
  });
});
