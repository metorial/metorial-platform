import { ProgrammablePromise } from '@lowerdeck/programmable-promise';
import { type JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { ConnectionMessage } from '../utils/messenger';
import type { McpConnectionAdapter } from './adapter';

export class AsyncConnection {
  readonly #adapter = new ProgrammablePromise<McpConnectionAdapter>();
  #failed = false;

  constructor() {
    this.#adapter.promise.catch(() => {});
  }

  setAdapter(adapter: McpConnectionAdapter) {
    this.#adapter.resolve(adapter);
  }

  /** Unblocks everything waiting on the adapter when it could not be created. */
  fail(error: unknown) {
    this.#failed = true;
    this.#adapter.reject(error);
  }

  async onMessage(listener: (msg: ConnectionMessage) => unknown) {
    let adapter = await this.#adapter.promise;
    return adapter.onMessage(listener);
  }

  waitForInitialization() {
    return this.#adapter.promise.then(a => a.waitForInitialization());
  }

  async sendMcpMessage(message: JSONRPCMessage) {
    let adapter = await this.#adapter.promise;
    return adapter.sendMcpMessage(message);
  }

  async sendMcpMessageAndWait(message: JSONRPCMessage) {
    let adapter = await this.#adapter.promise;
    return adapter.sendMcpMessageAndWait(message);
  }

  async terminate() {
    if (this.#failed) return;
    let adapter = await this.#adapter.promise;
    return adapter.terminate();
  }
}
