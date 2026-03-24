import { cachedTransformers } from './cachedTransformers';

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

let worker: Worker | null = null;
let requestId = 0;
let pending = new Map<number, PendingRequest>();
let rotationTimer: any | null = null;

let createWorker = () => {
  let w = new Worker(new URL('./_worker.ts', import.meta.url), {
    type: 'module'
  });

  w.addEventListener('message', (event: MessageEvent<any>) => {
    let { id, result, error } = event.data;
    let entry = pending.get(id);

    if (!entry) return;

    pending.delete(id);

    if (error) {
      entry.reject(new Error(error));
    } else {
      entry.resolve(result);
    }
  });

  w.addEventListener('error', err => {
    for (let entry of pending.values()) {
      entry.reject(err);
    }
    pending.clear();
  });

  return w;
};

let rotateWorker = () => {
  let oldWorker = worker;
  worker = createWorker();

  if (oldWorker) oldWorker.terminate();
};

let ensureWorker = () => {
  if (!worker) {
    worker = createWorker();

    rotationTimer = setInterval(() => {
      rotateWorker();
    }, 60_000);
  }
};

export let processJsonata = (expression: string, input: unknown): Promise<unknown> => {
  let cached = cachedTransformers.get(expression.trim());
  if (cached) {
    try {
      return Promise.resolve(cached(input));
    } catch {
      // fall through to worker
    }
  }

  ensureWorker();

  return new Promise((resolve, reject) => {
    let id = ++requestId;

    pending.set(id, { resolve, reject });

    worker!.postMessage({
      id,
      expression,
      input
    });
  });
};
