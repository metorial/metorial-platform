import { debug } from '@metorial/debug';
import { type JSONRPCMessage } from '@metorial/mcp-utils';
import { ProgrammablePromise } from '@metorial/programmable-promise';
import { DockerManagerOptions } from '../docker/dockerManager';
import { McpSessionContainer, type McpSessionContainerOptions } from './container';

let sessions = new Map<string, McpSession>();

export interface McpSessionOpts {
  dockerOpts?: DockerManagerOptions;
  containerOpts: McpSessionContainerOptions;
  onClose?: () => void;
}

export class McpSession {
  // Managers
  #docker: McpSessionContainer;

  // State
  #lastMessageAt?: number;
  #isClosing = false;

  // Lifecycle
  #outgoingMessageHandlers = new Set<(message: JSONRPCMessage) => void>();
  #debugMessageHandlers = new Set<(d: { type: string; payload: any }) => void>();
  #onClose?: () => void;
  #onClosePromise = new ProgrammablePromise<void>();

  private constructor(
    public readonly id: string,
    opts: McpSessionOpts
  ) {
    this.#onClose = opts.onClose;

    this.#docker = new McpSessionContainer({
      ...opts,
      onClose: () => {
        this.close();
      },
      onPullProgress: progress => {
        this.sendDebug({
          type: 'pull_progress',
          payload: { progress }
        });
      },
      onDebug: lines => {
        this.sendDebug({
          type: 'output',
          payload: { lines }
        });
      }
    });
  }

  static async create(id: string, opts: McpSessionOpts) {
    let session = new McpSession(id, opts);
    sessions.set(session.id, session);
    return session;
  }

  static get(id: string) {
    return sessions.get(id);
  }

  get waitingForClose() {
    return this.#onClosePromise.promise;
  }

  async incomingMessage(messages: JSONRPCMessage[]) {
    this.#lastMessageAt = Date.now();

    for (let message of messages) {
      debug.log('RUNNER MCP message - in', message);

      this.#docker.send(messages);
    }
  }

  async onOutgoingMessage(handler: (message: JSONRPCMessage) => void) {
    this.#outgoingMessageHandlers.add(handler);
    this.#docker.onMessage(async msg => {
      debug.log('RUNNER MCP - out', msg);
      await handler(msg);
    });
  }

  async onDebugMessage(handler: (d: { type: string; payload: any }) => void) {
    this.#debugMessageHandlers.add(handler);
  }

  async close() {
    if (this.#isClosing) return;
    this.#isClosing = true;

    this.#onClose?.();
    this.#onClosePromise.resolve();
    this.#outgoingMessageHandlers.clear();
    this.#debugMessageHandlers.clear();
    sessions.delete(this.id);
    await this.#docker.stop();
  }

  private async sendDebug(d: { type: string; payload: any }) {
    for (let handler of this.#debugMessageHandlers) await handler(d);
  }
}
