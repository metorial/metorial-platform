import { generatePlainId } from '@lowerdeck/id';
import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import type { JSONRPCMessage, JSONRPCRequest } from '@modelcontextprotocol/sdk/types.js';

let CAPABILITY_BY_METHOD: Record<string, string> = {
  'elicitation/create': 'elicitation',
  'sampling/createMessage': 'sampling',
  'roots/list': 'roots'
};

export interface InputRequiredResult {
  resultType: 'input_required';
  inputRequests?: Record<string, { method: string; params?: Record<string, unknown> }>;
  requestState?: string;
}

export let isInputRequiredResult = (result: unknown): result is InputRequiredResult =>
  !!result &&
  typeof result == 'object' &&
  (result as { resultType?: unknown }).resultType === 'input_required';

export class InputRequestRound {
  readonly #pending = new Map<string | number, string>();
  readonly #responses: Record<string, unknown> = {};
  readonly #done = new ProgrammablePromise<Record<string, unknown>>();

  readonly legacyRequests: JSONRPCRequest[];

  private constructor(
    entries: { key: string; request: JSONRPCRequest }[],
    readonly unsupportedKeys: string[]
  ) {
    this.legacyRequests = entries.map(entry => entry.request);
    for (let entry of entries) this.#pending.set(entry.request.id, entry.key);

    this.#done.promise.catch(() => {});
    if (!this.#pending.size) this.#done.resolve(this.#responses);
  }

  static create(result: InputRequiredResult, clientCapabilities: Record<string, unknown>) {
    let entries: { key: string; request: JSONRPCRequest }[] = [];
    let unsupportedKeys: string[] = [];

    for (let [key, inputRequest] of Object.entries(result.inputRequests ?? {})) {
      let capability = CAPABILITY_BY_METHOD[inputRequest?.method];
      if (!capability || !clientCapabilities?.[capability]) {
        unsupportedKeys.push(key);
        continue;
      }

      entries.push({
        key,
        request: {
          jsonrpc: '2.0',
          id: `mrtr_${generatePlainId(16)}`,
          method: inputRequest.method,
          params: inputRequest.params ?? {}
        }
      });
    }

    return new InputRequestRound(entries, unsupportedKeys);
  }

  get isSettled() {
    return this.#pending.size == 0;
  }

  consume(message: JSONRPCMessage) {
    if (!('id' in message) || 'method' in message || message.id === undefined) return false;

    let key = this.#pending.get(message.id);
    if (key === undefined) return false;

    this.#pending.delete(message.id);
    if ('result' in message) this.#responses[key] = message.result;

    if (!this.#pending.size) this.#done.resolve(this.#responses);
    return true;
  }

  wait() {
    return this.#done.promise;
  }

  cancel(error: Error) {
    if (this.#pending.size) this.#done.reject(error);
    this.#pending.clear();
  }
}

export let buildRetryParams = (
  originalParams: Record<string, unknown> | undefined,
  result: InputRequiredResult,
  inputResponses: Record<string, unknown>
) => {
  let {
    inputResponses: _previousResponses,
    requestState: _previousState,
    ...rest
  } = originalParams ?? {};

  return {
    ...rest,
    ...(Object.keys(inputResponses).length ? { inputResponses } : {}),
    ...(result.requestState !== undefined ? { requestState: result.requestState } : {})
  };
};
