import type { LogFetchOptions, LogLine, LogPage, LogSource, LogStatus } from '../types';

export let DEFAULT_POLL_INTERVAL_MS = 2000;
export let DEFAULT_INITIAL_LIMIT = 300;
export let DEFAULT_PAGE_SIZE = 1000;
export let DEFAULT_MAX_LINES = 20_000;
export let MAX_POLL_BACKOFF_MS = 30_000;

export interface LogWindowRange {
  lines: LogLine[];
  start: number;
  end: number;
  hasBefore: boolean;
  atTail: boolean;
}

export type LogScrollRequest = { target: 'top' | 'bottom'; seq: number };

export interface LogWindowState extends LogWindowRange {
  phase: 'loading' | 'ready' | 'error';
  error: Error | null;

  status: LogStatus | null;
  truncated: boolean;
  totalLines: number;

  loadingBefore: boolean;
  loadingAfter: boolean;
  beforeError: Error | null;
  afterError: Error | null;
  pollError: Error | null;

  pinned: boolean;
  newLineCount: number;
  scrollRequest: LogScrollRequest | null;
}

export interface LogWindowOptions {
  source: LogSource;
  pollIntervalMs?: number;
  initialLimit?: number;
  pageSize?: number;
  maxLines?: number;
}

type WindowTarget = 'latest' | 'start';

let lastIndexOf = (lines: LogLine[]) => lines[lines.length - 1].index;

let toError = (error: unknown) =>
  error instanceof Error
    ? error
    : new Error(typeof error == 'string' ? error : 'Failed to load logs');

let isAbortError = (error: unknown) =>
  typeof error == 'object' && error !== null && (error as Error).name == 'AbortError';

export let findLinePosition = (lines: LogLine[], index: number) => {
  let low = 0;
  let high = lines.length - 1;

  while (low <= high) {
    let mid = (low + high) >> 1;
    let current = lines[mid].index;

    if (current == index) return mid;
    if (current < index) low = mid + 1;
    else high = mid - 1;
  }

  return -1;
};

export let createTailWindow = (page: LogPage): LogWindowRange => {
  if (!page.lines.length) {
    let end = page.lineCount ?? 0;
    return { lines: [], start: end, end, hasBefore: false, atTail: true };
  }

  let start = page.hasMore ? page.lines[0].index : 0;

  return {
    lines: page.lines,
    start,
    end: lastIndexOf(page.lines) + 1,
    hasBefore: page.hasMore && start > 0,
    atTail: true
  };
};

export let createHeadWindow = (page: LogPage): LogWindowRange => {
  if (!page.lines.length) {
    return { lines: [], start: 0, end: 0, hasBefore: false, atTail: true };
  }

  return {
    lines: page.lines,
    start: 0,
    end: lastIndexOf(page.lines) + 1,
    hasBefore: false,
    atTail: !page.hasMore
  };
};

export let prependPage = <T extends LogWindowRange>(window: T, page: LogPage): T => {
  let added = page.lines.filter(line => line.index < window.start);

  // An empty page can't move the cursor, so stop asking instead of looping on it.
  if (!added.length) {
    return { ...window, start: page.hasMore ? window.start : 0, hasBefore: false };
  }

  let start = page.hasMore ? added[0].index : 0;

  return {
    ...window,
    lines: [...added, ...window.lines],
    start,
    hasBefore: page.hasMore && start > 0
  };
};

export let appendPage = <T extends LogWindowRange>(
  window: T,
  page: LogPage,
  opts: { follow: boolean }
): T => {
  let added = page.lines.filter(line => line.index >= window.end);

  // As in prependPage: an empty page means the window has reached the edge.
  if (!added.length) return window.atTail ? window : { ...window, atTail: true };

  return {
    ...window,
    lines: [...window.lines, ...added],
    end: lastIndexOf(added) + 1,
    atTail: opts.follow || !page.hasMore
  };
};

export let evictLines = <T extends LogWindowRange>(
  window: T,
  maxLines: number,
  focusIndex: number
): T => {
  let limit = Math.max(1, maxLines);
  let excess = window.lines.length - limit;
  if (excess <= 0) return window;

  let distanceToStart = focusIndex - window.lines[0].index;
  let distanceToEnd = lastIndexOf(window.lines) - focusIndex;

  if (distanceToEnd >= distanceToStart) {
    let lines = window.lines.slice(0, limit);
    return { ...window, lines, end: lastIndexOf(lines) + 1, atTail: false };
  }

  let lines = window.lines.slice(excess);
  return { ...window, lines, start: lines[0].index, hasBefore: true };
};

let pageMeta = (state: LogWindowState, page: LogPage) => ({
  status: page.status,
  truncated: page.truncated ?? state.truncated,
  totalLines:
    page.lineCount ??
    Math.max(state.totalLines, page.lines.length ? lastIndexOf(page.lines) + 1 : 0)
});

let createInitialState = (): LogWindowState => ({
  phase: 'loading',
  error: null,

  lines: [],
  start: 0,
  end: 0,
  hasBefore: false,
  atTail: true,

  status: null,
  truncated: false,
  totalLines: 0,

  loadingBefore: false,
  loadingAfter: false,
  beforeError: null,
  afterError: null,
  pollError: null,

  pinned: true,
  newLineCount: 0,
  scrollRequest: null
});

export class LogWindow {
  private source: LogSource;
  private pollIntervalMs: number;
  private initialLimit: number;
  private pageSize: number;
  private maxLines: number;

  private state = createInitialState();
  private listeners = new Set<() => void>();

  private requests = new Set<AbortController>();
  private generation = 0;
  private windowTarget: WindowTarget = 'latest';
  private scrollSeq = 0;

  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private polling = false;
  private pollFailures = 0;

  private active = false;
  private visible = true;
  private focusIndex: number | null = null;

  constructor(opts: LogWindowOptions) {
    this.source = opts.source;
    this.pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.initialLimit = opts.initialLimit ?? DEFAULT_INITIAL_LIMIT;
    this.pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
    this.maxLines = opts.maxLines ?? DEFAULT_MAX_LINES;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  start() {
    this.active = true;
    return this.loadWindow('latest');
  }

  dispose() {
    this.active = false;
    this.resetRequests();
  }

  jumpToLatest() {
    if (this.state.phase == 'ready' && this.state.atTail) {
      this.set({
        pinned: true,
        newLineCount: 0,
        scrollRequest: this.nextScrollRequest('bottom')
      });

      return Promise.resolve();
    }

    return this.loadWindow('latest');
  }

  jumpToStart() {
    let state = this.state;

    if (state.phase == 'ready' && state.start == 0 && !state.hasBefore) {
      this.set({ pinned: false, scrollRequest: this.nextScrollRequest('top') });
      return Promise.resolve();
    }

    return this.loadWindow('start');
  }

  async loadBefore() {
    let state = this.state;
    if (!this.active || state.phase != 'ready') return;
    if (!state.hasBefore || state.loadingBefore || state.beforeError) return;

    let generation = this.generation;
    let cursor = state.start;
    this.set({ loadingBefore: true });

    try {
      let page = await this.request({ direction: 'backward', cursor, limit: this.pageSize });
      if (generation != this.generation) return;

      let current = this.state;
      if (current.start != cursor) return this.set({ loadingBefore: false });

      let range = evictLines(prependPage(current, page), this.maxLines, -Infinity);
      this.set({ ...range, ...pageMeta(current, page), loadingBefore: false });
    } catch (error) {
      if (generation != this.generation || isAbortError(error)) return;
      this.set({ loadingBefore: false, beforeError: toError(error) });
    }
  }

  async loadAfter() {
    let state = this.state;
    if (!this.active || state.phase != 'ready') return;
    if (state.atTail || state.loadingAfter || state.afterError) return;

    let generation = this.generation;
    let cursor = state.end;
    this.set({ loadingAfter: true });

    try {
      let page = await this.request({ direction: 'forward', cursor, limit: this.pageSize });
      if (generation != this.generation) return;

      let current = this.state;
      if (current.end != cursor || current.atTail) return this.set({ loadingAfter: false });

      let range = evictLines(
        appendPage(current, page, { follow: false }),
        this.maxLines,
        Infinity
      );
      this.set({ ...range, ...pageMeta(current, page), loadingAfter: false });

      if (range.atTail) this.schedulePoll();
    } catch (error) {
      if (generation != this.generation || isAbortError(error)) return;
      this.set({ loadingAfter: false, afterError: toError(error) });
    }
  }

  retry() {
    let state = this.state;
    if (state.phase == 'error') return this.loadWindow(this.windowTarget);

    let tasks: Promise<void>[] = [];

    if (state.beforeError) {
      this.set({ beforeError: null });
      tasks.push(this.loadBefore());
    }

    if (state.afterError) {
      this.set({ afterError: null });
      tasks.push(this.loadAfter());
    }

    if (state.pollError) {
      this.pollFailures = 0;
      this.schedulePoll(0);
    }

    return Promise.all(tasks).then(() => undefined);
  }

  setPinned(pinned: boolean) {
    if (this.state.pinned == pinned) return;
    this.set({ pinned, newLineCount: pinned ? 0 : this.state.newLineCount });
  }

  setFocus(index: number | null) {
    this.focusIndex = index;
  }

  setVisible(visible: boolean) {
    if (this.visible == visible) return;
    this.visible = visible;

    if (visible) this.schedulePoll(0);
    else this.clearPollTimer();
  }

  setPollInterval(pollIntervalMs: number) {
    if (this.pollIntervalMs == pollIntervalMs) return;
    this.pollIntervalMs = pollIntervalMs;

    if (this.pollTimer) this.schedulePoll();
  }

  private async loadWindow(target: WindowTarget) {
    let generation = this.resetRequests();
    let previous = this.state;

    this.windowTarget = target;
    this.focusIndex = null;
    this.pollFailures = 0;

    this.set({
      ...createInitialState(),
      status: previous.status,
      truncated: previous.truncated,
      totalLines: previous.totalLines,
      scrollRequest: previous.scrollRequest
    });

    try {
      let page = await this.request(
        target == 'latest'
          ? { direction: 'backward', limit: this.initialLimit }
          : { direction: 'forward', limit: this.pageSize }
      );
      if (generation != this.generation) return;

      let range = target == 'latest' ? createTailWindow(page) : createHeadWindow(page);

      this.set({
        ...range,
        ...pageMeta(this.state, page),
        phase: 'ready',
        pinned: target == 'latest',
        scrollRequest: this.nextScrollRequest(target == 'latest' ? 'bottom' : 'top')
      });

      this.schedulePoll();
    } catch (error) {
      if (generation != this.generation || isAbortError(error)) return;
      this.set({ phase: 'error', error: toError(error) });
    }
  }

  private poll() {
    if (!this.canPoll()) return;
    return this.state.atTail ? this.pollTail() : this.pollStatus();
  }

  private async pollTail() {
    let generation = this.generation;
    let cursor = this.state.end;
    this.polling = true;

    try {
      let page = await this.request({ direction: 'forward', cursor, limit: this.pageSize });
      if (generation != this.generation) return;

      this.polling = false;
      this.pollFailures = 0;

      let current = this.state;
      if (current.end != cursor || !current.atTail) return this.schedulePoll();

      let appended = appendPage(current, page, { follow: true });
      let added = appended.lines.length - current.lines.length;
      let focus = current.pinned ? Infinity : (this.focusIndex ?? Infinity);

      this.set({
        ...evictLines(appended, this.maxLines, focus),
        ...pageMeta(current, page),
        pollError: null,
        newLineCount: current.pinned ? 0 : current.newLineCount + added
      });

      let catchingUp = page.hasMore && added > 0;
      this.schedulePoll(catchingUp ? 0 : this.pollIntervalMs);
    } catch (error) {
      this.handlePollError(generation, error);
    }
  }

  // Outside tail-follow mode there is nothing to append to, but the status chip and
  // line count should still notice the stream growing or getting sealed.
  private async pollStatus() {
    let generation = this.generation;
    this.polling = true;

    try {
      let page = await this.request({ direction: 'backward', limit: 1 });
      if (generation != this.generation) return;

      this.polling = false;
      this.pollFailures = 0;

      this.set({ ...pageMeta(this.state, page), pollError: null });
      this.schedulePoll();
    } catch (error) {
      this.handlePollError(generation, error);
    }
  }

  private handlePollError(generation: number, error: unknown) {
    if (generation != this.generation) return;

    this.polling = false;
    if (isAbortError(error)) return;

    this.pollFailures++;
    this.set({ pollError: toError(error) });

    let backoff = this.pollIntervalMs * 2 ** Math.min(this.pollFailures, 8);
    this.schedulePoll(Math.min(MAX_POLL_BACKOFF_MS, backoff));
  }

  private canPoll() {
    return (
      this.active &&
      this.visible &&
      !this.polling &&
      this.state.phase == 'ready' &&
      this.state.status == 'open'
    );
  }

  private schedulePoll(delay = this.pollIntervalMs) {
    this.clearPollTimer();
    if (!this.canPoll()) return;

    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      void this.poll();
    }, delay);
  }

  private clearPollTimer() {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }

  private resetRequests() {
    this.generation++;

    for (let controller of this.requests) controller.abort();
    this.requests.clear();

    this.clearPollTimer();
    this.polling = false;

    return this.generation;
  }

  private async request(opts: Omit<LogFetchOptions, 'signal'>) {
    let controller = new AbortController();
    this.requests.add(controller);

    try {
      return await this.source.fetch({ ...opts, signal: controller.signal });
    } finally {
      this.requests.delete(controller);
    }
  }

  private nextScrollRequest(target: LogScrollRequest['target']): LogScrollRequest {
    this.scrollSeq++;
    return { target, seq: this.scrollSeq };
  }

  private set(patch: Partial<LogWindowState>) {
    let keys = Object.keys(patch) as (keyof LogWindowState)[];
    if (keys.every(key => patch[key] === this.state[key])) return;

    this.state = { ...this.state, ...patch };
    for (let listener of this.listeners) listener();
  }
}
