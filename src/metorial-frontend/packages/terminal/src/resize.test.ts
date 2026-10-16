import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createResizeScheduler, type TerminalSize } from './resize';

let setup = (initial?: TerminalSize) => {
  let onResize = vi.fn();
  let scheduler = createResizeScheduler({ delayMs: 100, initial, onResize });

  return { onResize, scheduler };
};

describe('resize scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces bursts and only sends the last size', () => {
    let { onResize, scheduler } = setup({ cols: 80, rows: 24 });

    scheduler.schedule({ cols: 90, rows: 24 });
    vi.advanceTimersByTime(60);
    scheduler.schedule({ cols: 100, rows: 30 });
    vi.advanceTimersByTime(60);
    scheduler.schedule({ cols: 120, rows: 40 });

    expect(onResize).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(onResize).toHaveBeenCalledTimes(1);
    expect(onResize).toHaveBeenCalledWith({ cols: 120, rows: 40 });
  });

  it('skips sizes that match what was last sent', () => {
    let { onResize, scheduler } = setup({ cols: 80, rows: 24 });

    scheduler.schedule({ cols: 100, rows: 30 });
    scheduler.schedule({ cols: 80, rows: 24 });
    vi.advanceTimersByTime(100);

    expect(onResize).not.toHaveBeenCalled();

    scheduler.schedule({ cols: 100, rows: 30 });
    vi.advanceTimersByTime(100);
    scheduler.schedule({ cols: 100, rows: 30 });
    vi.advanceTimersByTime(100);

    expect(onResize).toHaveBeenCalledTimes(1);
  });

  it('ignores empty or invalid sizes', () => {
    let { onResize, scheduler } = setup();

    scheduler.schedule({ cols: 0, rows: 24 });
    scheduler.schedule({ cols: Number.NaN, rows: 10 });
    vi.advanceTimersByTime(100);

    expect(onResize).not.toHaveBeenCalled();
  });

  it('flushes immediately and drops pending sizes on cancel', () => {
    let { onResize, scheduler } = setup();

    scheduler.schedule({ cols: 100, rows: 30 });
    scheduler.flush();

    expect(onResize).toHaveBeenCalledWith({ cols: 100, rows: 30 });

    scheduler.schedule({ cols: 140, rows: 50 });
    scheduler.cancel();
    vi.advanceTimersByTime(500);

    expect(onResize).toHaveBeenCalledTimes(1);
  });
});
