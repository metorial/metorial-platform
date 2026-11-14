import { AsyncLocalStorage } from 'node:async_hooks';

export type Concurrency = 'exclusive' | 'shared';

export class RequestContext {
  ended = false;
  #cleanups: (() => void)[] = [];

  constructor(
    readonly requestId: string,
    readonly invocationId: string,
    readonly deadlineMs: number
  ) {}

  run<T>(fn: () => T): T {
    return storage.run(this, fn);
  }

  onEnd(cleanup: () => void) {
    if (this.ended) {
      cleanup();
      return;
    }
    this.#cleanups.push(cleanup);
  }

  end() {
    if (this.ended) return;
    this.ended = true;

    for (let cleanup of this.#cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch {}
    }
    if (inflight == this) inflight = undefined;
  }
}

let storage = new AsyncLocalStorage<RequestContext>();
let concurrency: Concurrency = 'shared';
let inflight: RequestContext | undefined;

export let setConcurrency = (mode: Concurrency) => {
  concurrency = mode;
};

export let beginRequest = (ctx: RequestContext) => {
  if (concurrency == 'exclusive') inflight = ctx;
};

// In exclusive mode a callback that lost its async context still belongs to the one request
// in flight; in shared mode it has no request and fails closed.
export let currentContext = (): RequestContext | undefined =>
  storage.getStore() ?? (concurrency == 'exclusive' ? inflight : undefined);
