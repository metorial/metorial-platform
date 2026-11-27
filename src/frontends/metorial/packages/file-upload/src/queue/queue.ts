let DEFAULT_CONCURRENCY = 2;
let PROGRESS_EMIT_INTERVAL_MS = 100;

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'error' | 'cancelled';

export interface UploadTask<M = unknown> {
  file: File;
  onProgress(loaded: number, total: number): void;
  signal: AbortSignal;
  id?: string;
  meta?: M;
}

export interface UploadItem<M = unknown> {
  id: string;
  file: File;
  name: string;
  status: UploadStatus;
  loaded: number;
  total: number;
  progress: number;
  error?: string;
  meta?: M;
}

export interface UploadQueueOptions<M = unknown> {
  upload: (task: UploadTask<M>) => Promise<void>;
  concurrency?: number;
  onDone?: (item: UploadItem<M>) => void;
  onError?: (item: UploadItem<M>) => void;
}

export interface UploadQueueSummary {
  count: number;
  queued: number;
  uploading: number;
  done: number;
  failed: number;
  cancelled: number;
  active: number;
  bytesLoaded: number;
  bytesTotal: number;
  progress: number;
}

export interface UploadQueue<M = unknown> {
  getSnapshot(): UploadItem<M>[];
  subscribe(listener: () => void): () => void;
  add(files: Iterable<File> | ArrayLike<File>, meta?: M): string[];
  cancel(id: string): void;
  retry(id: string): void;
  remove(id: string): void;
  clear(): void;
  cancelAll(): void;
}

let activeStatuses: UploadStatus[] = ['queued', 'uploading'];

export let isUploadActive = (item: { status: UploadStatus }) =>
  activeStatuses.includes(item.status);

let toProgress = (loaded: number, total: number) => {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, loaded / total));
};

let toErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error == 'string' && error) return error;

  return 'Upload failed.';
};

let idCounter = 0;

let createUploadId = () => `upload_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

export let summarizeUploads = (items: UploadItem<any>[]): UploadQueueSummary => {
  let summary: UploadQueueSummary = {
    count: items.length,
    queued: 0,
    uploading: 0,
    done: 0,
    failed: 0,
    cancelled: 0,
    active: 0,
    bytesLoaded: 0,
    bytesTotal: 0,
    progress: 0
  };

  for (let item of items) {
    if (item.status == 'queued') summary.queued++;
    if (item.status == 'uploading') summary.uploading++;
    if (item.status == 'done') summary.done++;
    if (item.status == 'error') summary.failed++;
    if (item.status == 'cancelled') summary.cancelled++;

    if (item.status == 'cancelled') continue;

    summary.bytesTotal += item.total;
    summary.bytesLoaded += item.status == 'done' ? item.total : item.loaded;
  }

  summary.active = summary.queued + summary.uploading;

  if (summary.bytesTotal > 0)
    summary.progress = toProgress(summary.bytesLoaded, summary.bytesTotal);
  else summary.progress = summary.active > 0 ? 0 : 1;

  return summary;
};

export let createUploadQueue = <M = unknown>(
  getOptions: () => UploadQueueOptions<M>
): UploadQueue<M> => {
  let items: UploadItem<M>[] = [];
  let listeners = new Set<() => void>();
  let controllers = new Map<string, AbortController>();
  let progressTimer: ReturnType<typeof setTimeout> | null = null;

  let emitNow = () => {
    if (progressTimer) clearTimeout(progressTimer);
    progressTimer = null;

    for (let listener of Array.from(listeners)) listener();
  };

  let emitThrottled = () => {
    if (progressTimer) return;
    progressTimer = setTimeout(emitNow, PROGRESS_EMIT_INTERVAL_MS);
  };

  let find = (id: string) => items.find(item => item.id == id);

  let update = (id: string, patch: Partial<UploadItem<M>>) => {
    items = items.map(item => (item.id == id ? { ...item, ...patch } : item));
    return find(id);
  };

  let settle = (id: string, controller: AbortController, outcome: { error?: unknown }) => {
    if (controllers.get(id) != controller) return;
    controllers.delete(id);

    let current = find(id);
    if (!current) return;

    let options = getOptions();

    if ('error' in outcome) {
      let failed = update(id, { status: 'error', error: toErrorMessage(outcome.error) });
      emitNow();
      if (failed) options.onError?.(failed);
    } else {
      let done = update(id, {
        status: 'done',
        loaded: current.total,
        progress: 1,
        error: undefined
      });
      emitNow();
      if (done) options.onDone?.(done);
    }

    pump();
  };

  let start = (item: UploadItem<M>) => {
    let controller = new AbortController();
    controllers.set(item.id, controller);

    update(item.id, {
      status: 'uploading',
      loaded: 0,
      total: item.file.size,
      progress: 0,
      error: undefined
    });

    let task: UploadTask<M> = {
      id: item.id,
      file: item.file,
      meta: item.meta,
      signal: controller.signal,
      onProgress: (loaded, total) => {
        if (controllers.get(item.id) != controller) return;

        let safeTotal = total > 0 ? total : item.file.size;
        update(item.id, { loaded, total: safeTotal, progress: toProgress(loaded, safeTotal) });
        emitThrottled();
      }
    };

    new Promise<void>(resolve => resolve(getOptions().upload(task))).then(
      () => settle(item.id, controller, {}),
      error => settle(item.id, controller, { error })
    );
  };

  let pump = () => {
    let concurrency = Math.max(1, getOptions().concurrency ?? DEFAULT_CONCURRENCY);
    let running = items.filter(item => item.status == 'uploading').length;
    let started = false;

    for (let item of items) {
      if (running >= concurrency) break;
      if (item.status != 'queued') continue;

      start(item);
      running++;
      started = true;
    }

    if (started) emitNow();
  };

  let abortActive = (id: string) => {
    let controller = controllers.get(id);
    if (!controller) return;

    controllers.delete(id);
    controller.abort();
  };

  let cancelWithoutEmit = (id: string) => {
    let item = find(id);
    if (!item || !isUploadActive(item)) return false;

    abortActive(id);
    update(id, { status: 'cancelled' });

    return true;
  };

  return {
    getSnapshot: () => items,

    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    add: (files, meta) => {
      let added: UploadItem<M>[] = Array.from(files as ArrayLike<File>).map(file => ({
        id: createUploadId(),
        file,
        name: file.name,
        status: 'queued',
        loaded: 0,
        total: file.size,
        progress: 0,
        meta
      }));

      if (!added.length) return [];

      items = [...items, ...added];
      emitNow();
      pump();

      return added.map(item => item.id);
    },

    cancel: id => {
      if (!cancelWithoutEmit(id)) return;

      emitNow();
      pump();
    },

    retry: id => {
      let item = find(id);
      if (!item || (item.status != 'error' && item.status != 'cancelled')) return;

      update(id, { status: 'queued', loaded: 0, progress: 0, error: undefined });
      emitNow();
      pump();
    },

    remove: id => {
      if (!find(id)) return;

      abortActive(id);
      items = items.filter(item => item.id != id);
      emitNow();
      pump();
    },

    clear: () => {
      let remaining = items.filter(isUploadActive);
      if (remaining.length == items.length) return;

      items = remaining;
      emitNow();
    },

    cancelAll: () => {
      let changed = false;

      for (let item of items) {
        if (cancelWithoutEmit(item.id)) changed = true;
      }

      if (changed) emitNow();
    }
  };
};
