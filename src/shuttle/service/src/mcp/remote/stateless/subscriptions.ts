import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { META_SUBSCRIPTION_ID } from './constants';

export interface SubscriptionFilter {
  toolsListChanged?: boolean;
  promptsListChanged?: boolean;
  resourcesListChanged?: boolean;
  resourceSubscriptions?: string[];
}

export let buildSubscriptionFilter = (d: {
  serverCapabilities: Record<string, any> | null;
  resourceUris: Iterable<string>;
}): SubscriptionFilter | null => {
  let filter: SubscriptionFilter = {};
  let capabilities = d.serverCapabilities ?? {};

  if (capabilities.tools?.listChanged) filter.toolsListChanged = true;
  if (capabilities.prompts?.listChanged) filter.promptsListChanged = true;
  if (capabilities.resources?.listChanged) filter.resourcesListChanged = true;

  let resourceUris = [...d.resourceUris];
  if (resourceUris.length) filter.resourceSubscriptions = resourceUris;

  return Object.keys(filter).length ? filter : null;
};

export let toLegacySubscriptionMessage = (message: JSONRPCMessage): JSONRPCMessage | null => {
  if (!('method' in message)) return null;
  if (message.method == 'notifications/subscriptions/acknowledged') return null;

  let params = (message as { params?: Record<string, any> }).params;
  let meta = params?._meta;
  if (!meta || !(META_SUBSCRIPTION_ID in meta)) return message;

  let { [META_SUBSCRIPTION_ID]: _subscriptionId, ...restMeta } = meta;
  let { _meta, ...restParams } = params!;

  return {
    ...message,
    params: Object.keys(restMeta).length ? { ...restParams, _meta: restMeta } : restParams
  } as JSONRPCMessage;
};

export type SubscriptionStreamOutcome = 'reconnect' | 'stop';

let INITIAL_RECONNECT_DELAY_MS = 1000;
let MAX_RECONNECT_DELAY_MS = 30 * 1000;
let HEALTHY_STREAM_DURATION_MS = 60 * 1000;

let sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>(resolve => {
    let onAbort = () => {
      clearTimeout(timeout);
      resolve();
    };
    let timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal.addEventListener('abort', onAbort, { once: true });
  });

export class SubscriptionStream {
  #abortController: AbortController | null = null;
  #filterKey: string | null = null;

  constructor(
    private readonly open: (
      filter: SubscriptionFilter,
      signal: AbortSignal
    ) => Promise<SubscriptionStreamOutcome>
  ) {}

  update(filter: SubscriptionFilter | null) {
    let filterKey = filter ? JSON.stringify(filter) : null;
    if (filterKey == this.#filterKey) return;

    this.close();
    if (!filter) return;

    let abortController = new AbortController();
    this.#abortController = abortController;
    this.#filterKey = filterKey;

    void this.#run(filter, abortController.signal).finally(() => {
      if (this.#abortController != abortController) return;

      this.#abortController = null;
      this.#filterKey = null;
    });
  }

  async #run(filter: SubscriptionFilter, signal: AbortSignal) {
    let delay = INITIAL_RECONNECT_DELAY_MS;

    while (!signal.aborted) {
      let startedAt = Date.now();
      let outcome = await this.open(filter, signal).catch(
        (): SubscriptionStreamOutcome => 'reconnect'
      );
      if (outcome == 'stop' || signal.aborted) return;

      if (Date.now() - startedAt >= HEALTHY_STREAM_DURATION_MS) {
        delay = INITIAL_RECONNECT_DELAY_MS;
      }

      await sleep(delay, signal);
      delay = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
    }
  }

  close() {
    this.#abortController?.abort();
    this.#abortController = null;
    this.#filterKey = null;
  }
}
