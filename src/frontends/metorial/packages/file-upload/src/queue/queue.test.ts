import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createUploadQueue,
  summarizeUploads,
  type UploadQueueOptions,
  type UploadTask
} from './queue';

type Pending = {
  task: UploadTask<string>;
  resolve: () => void;
  reject: (error: unknown) => void;
};

let makeFile = (name: string, size = 100) => new File([new Uint8Array(size)], name);

let flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

let setup = (overrides: Partial<UploadQueueOptions<string>> = {}) => {
  let pending: Pending[] = [];

  let options: UploadQueueOptions<string> = {
    concurrency: 2,
    upload: task =>
      new Promise<void>((resolve, reject) => pending.push({ task, resolve, reject })),
    ...overrides
  };

  let queue = createUploadQueue<string>(() => options);
  let statuses = () => queue.getSnapshot().map(item => item.status);
  let pendingFor = (name: string) => pending.filter(p => p.task.file.name == name).at(-1)!;

  return { queue, pending, statuses, pendingFor, options };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('upload queue', () => {
  it('runs up to the concurrency limit and keeps the rest queued', () => {
    let { queue, statuses, pending } = setup();

    queue.add([makeFile('a'), makeFile('b'), makeFile('c')], '/tmp');

    expect(statuses()).toEqual(['uploading', 'uploading', 'queued']);
    expect(pending).toHaveLength(2);
    expect(pending[0]!.task.meta).toBe('/tmp');
    expect(pending[0]!.task.id).toBe(queue.getSnapshot()[0]!.id);
  });

  it('starts the next item when one finishes and reports completion', async () => {
    let onDone = vi.fn();
    let { queue, statuses, pendingFor } = setup({ onDone });

    queue.add([makeFile('a'), makeFile('b'), makeFile('c')]);
    pendingFor('a').resolve();
    await flush();

    expect(statuses()).toEqual(['done', 'uploading', 'uploading']);
    expect(queue.getSnapshot()[0]!.progress).toBe(1);
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'a', status: 'done' })
    );
  });

  it('tracks progress and throttles progress notifications', async () => {
    vi.useFakeTimers();

    let { queue, pendingFor } = setup();
    let listener = vi.fn();

    queue.add([makeFile('a', 200)]);
    queue.subscribe(listener);

    pendingFor('a').task.onProgress(50, 200);
    pendingFor('a').task.onProgress(100, 200);

    expect(queue.getSnapshot()[0]).toMatchObject({ loaded: 100, total: 200, progress: 0.5 });
    expect(listener).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('marks failures with the error message and continues the queue', async () => {
    let onError = vi.fn();
    let { queue, statuses, pendingFor } = setup({ concurrency: 1, onError });

    queue.add([makeFile('a'), makeFile('b')]);
    pendingFor('a').reject(new Error('Disk full'));
    await flush();

    expect(statuses()).toEqual(['error', 'uploading']);
    expect(queue.getSnapshot()[0]!.error).toBe('Disk full');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('treats synchronous throws as failures', async () => {
    let { queue, statuses } = setup({
      upload: () => {
        throw new Error('boom');
      }
    });

    queue.add([makeFile('a')]);
    await flush();

    expect(statuses()).toEqual(['error']);
  });

  it('cancels queued and running uploads and aborts the signal', async () => {
    let { queue, statuses, pendingFor } = setup({ concurrency: 1 });

    let [a, b] = queue.add([makeFile('a'), makeFile('b')]);
    let signal = pendingFor('a').task.signal;

    queue.cancel(b!);
    expect(statuses()).toEqual(['uploading', 'cancelled']);

    queue.cancel(a!);
    expect(signal.aborted).toBe(true);
    expect(statuses()).toEqual(['cancelled', 'cancelled']);

    pendingFor('a').reject(new DOMException('Aborted', 'AbortError'));
    await flush();

    expect(statuses()).toEqual(['cancelled', 'cancelled']);
  });

  it('ignores progress and results from a cancelled attempt after retry', async () => {
    let { queue, statuses, pending } = setup();

    let [id] = queue.add([makeFile('a', 100)]);
    let first = pending[0]!;

    queue.cancel(id!);
    queue.retry(id!);

    let second = pending[1]!;
    expect(statuses()).toEqual(['uploading']);

    first.task.onProgress(90, 100);
    first.resolve();
    await flush();

    expect(queue.getSnapshot()[0]).toMatchObject({ status: 'uploading', loaded: 0 });

    second.resolve();
    await flush();

    expect(statuses()).toEqual(['done']);
  });

  it('retries failed uploads from the start', async () => {
    let { queue, statuses, pendingFor } = setup();

    let [id] = queue.add([makeFile('a')]);
    pendingFor('a').task.onProgress(40, 100);
    pendingFor('a').reject(new Error('Network'));
    await flush();

    queue.retry(id!);

    expect(statuses()).toEqual(['uploading']);
    expect(queue.getSnapshot()[0]).toMatchObject({ loaded: 0, progress: 0, error: undefined });
  });

  it('does not retry active or finished uploads', async () => {
    let { queue, pending, pendingFor } = setup();

    let [id] = queue.add([makeFile('a')]);
    queue.retry(id!);
    expect(pending).toHaveLength(1);

    pendingFor('a').resolve();
    await flush();

    queue.retry(id!);
    expect(pending).toHaveLength(1);
  });

  it('clears only finished items', async () => {
    let { queue, statuses, pendingFor } = setup({ concurrency: 1 });

    queue.add([makeFile('a'), makeFile('b'), makeFile('c')]);
    pendingFor('a').resolve();
    await flush();

    queue.clear();

    expect(queue.getSnapshot().map(item => item.name)).toEqual(['b', 'c']);
    expect(statuses()).toEqual(['uploading', 'queued']);
  });

  it('removes an item, aborting it if needed', () => {
    let { queue, pendingFor } = setup({ concurrency: 1 });

    let [a] = queue.add([makeFile('a'), makeFile('b')]);
    let signal = pendingFor('a').task.signal;

    queue.remove(a!);

    expect(signal.aborted).toBe(true);
    expect(queue.getSnapshot().map(item => [item.name, item.status])).toEqual([
      ['b', 'uploading']
    ]);
  });

  it('cancels everything that is still active', async () => {
    let { queue, statuses, pendingFor } = setup({ concurrency: 1 });

    queue.add([makeFile('a'), makeFile('b'), makeFile('c')]);
    pendingFor('a').resolve();
    await flush();

    queue.cancelAll();

    expect(statuses()).toEqual(['done', 'cancelled', 'cancelled']);
  });

  it('keeps snapshots referentially stable between changes', () => {
    let { queue } = setup();

    queue.add([makeFile('a')]);

    expect(queue.getSnapshot()).toBe(queue.getSnapshot());
  });
});

describe('summarizeUploads', () => {
  it('aggregates counts and byte progress, ignoring cancelled items', async () => {
    let { queue, pendingFor } = setup({ concurrency: 3 });

    let [, , c] = queue.add([makeFile('a', 100), makeFile('b', 300), makeFile('c', 1000)]);
    pendingFor('a').resolve();
    pendingFor('b').task.onProgress(100, 300);
    queue.cancel(c!);
    await flush();

    expect(summarizeUploads(queue.getSnapshot())).toEqual({
      count: 3,
      queued: 0,
      uploading: 1,
      done: 1,
      failed: 0,
      cancelled: 1,
      active: 1,
      bytesLoaded: 200,
      bytesTotal: 400,
      progress: 0.5
    });
  });

  it('reports complete progress for an empty queue', () => {
    expect(summarizeUploads([]).progress).toBe(1);
  });
});
