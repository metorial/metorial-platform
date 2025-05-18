import {
  ServerDeployment,
  ServerSession,
  ServerVariant,
  type SessionMessage,
  type SessionMessageType
} from '@metorial/db';
import { debug } from '@metorial/debug';
import {
  jsonRpcPingRequest,
  jsonRpcPingResponse,
  type JSONRPCMessage
} from '@metorial/mcp-utils';
import { ProgrammablePromise } from '@metorial/programmable-promise';
import { SessionControlMessageBackend } from './sessionControlMessageBackend';
import { SessionManager } from './sessionManager';

let PING_INTERVAL = 1000 * 30;
let PING_TIMEOUT = 1000 * 90;

let connections = new Map<string, SessionConnection>();

export class SessionConnection {
  #controlMessageBackend: SessionControlMessageBackend;
  #manager: SessionManager;
  #lastMessageAt: number;
  #closePromise = new ProgrammablePromise<void>();

  constructor(
    private session: ServerSession & {
      serverDeployment: ServerDeployment & {
        serverVariant: ServerVariant;
      };
    },
    private opts: { mode: 'send-only' | 'send-and-receive'; receiveControlMessages: boolean }
  ) {
    this.#lastMessageAt = Date.now();

    this.#controlMessageBackend = new SessionControlMessageBackend(session, {
      mode: opts.mode
    });

    this.#manager = new SessionManager(session, {
      mode: opts.mode
    });

    connections.set(session.id, this);
  }

  #closing = false;
  async close() {
    if (this.#closing) return;
    this.#closing = true;

    debug.log('Closing session connection', this.session.id);

    this.#closePromise.resolve();

    await this.#controlMessageBackend.close();
    await this.#manager.close();

    connections.delete(this.session.id);
  }

  async stop() {
    await this.#manager.stop();
    await this.close();
  }

  async sendMessage(message: JSONRPCMessage | JSONRPCMessage[]) {
    let messages = Array.isArray(message) ? message : [message];

    this.#lastMessageAt = Date.now();

    for (let i = 0; i < messages.length; i++) {
      let message = messages[i];
      if ('method' in message && message.method == 'ping') {
        messages.splice(i, 1);
        i--;

        if ('id' in message) {
          this.#controlMessageBackend.sendMessage(jsonRpcPingResponse(message));
        }
      }

      if ('id' in message && String(message.id).startsWith('mtgw/ping/')) {
        messages.splice(i, 1);
        i--;

        // Ignore ping messages
      }
    }

    if (messages.length) return await this.#manager.sendMessage(messages);
    return [];
  }

  onMessage(
    opts: {
      type: SessionMessageType[];
      ids?: string[];
      pull?: {
        afterId: string | undefined;
        type: SessionMessageType[];
      };
    },
    handler: (message: JSONRPCMessage, stored?: SessionMessage) => void
  ) {
    this.#manager.onMessage(opts, handler);
    if (this.opts.receiveControlMessages && !opts.ids)
      this.#controlMessageBackend.onMessage(handler);
  }

  async sendMessagesAndWaitForResponse(
    messages: JSONRPCMessage[],
    handler: (message: JSONRPCMessage, stored?: SessionMessage) => void
  ) {
    let sentMessages = await this.#manager.sendMessage(messages);
    let idsToWaitFor = new Set(
      sentMessages
        .filter(m => m.type == 'request')
        .map(m => m.unifiedId)
        .filter(Boolean)
        .map(String)
    );

    if (idsToWaitFor.size == 0) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      let closedRef = { current: false };

      let timeout = setTimeout(
        () => {
          closedRef.current = true;
          reject(new Error('Timeout waiting for response'));
        },
        1000 * 60 * 2
      );

      this.onMessage(
        {
          type: ['error', 'notification', 'response', 'request'],
          ids: Array.from(idsToWaitFor)
        },
        async (message, stored) => {
          console.log('Received message', message, stored);

          if (closedRef.current) return;

          if (stored?.type != 'request' && stored?.unifiedId) {
            idsToWaitFor.delete(stored?.unifiedId);
          }

          await handler(message, stored);

          if (idsToWaitFor.size == 0) {
            closedRef.current = true;
            clearTimeout(timeout);
            resolve();
          }
        }
      );
    });
  }

  get waitForClose() {
    return this.#closePromise.promise;
  }

  onClose(handler: () => void) {
    this.#controlMessageBackend.onClose(handler);
  }

  checkPing() {
    let now = Date.now();
    let pingDiff = now - this.#lastMessageAt;

    if (pingDiff > PING_TIMEOUT) {
      debug.warn(`Client ping timeout: ${pingDiff}ms`);
      this.close();
    }
  }

  sendPing() {
    this.#controlMessageBackend.sendMessage(jsonRpcPingRequest(this.session.id));
  }
}

setInterval(() => {
  for (let con of connections.values()) con.checkPing();
}, 10 * 1000);

setInterval(() => {
  for (let con of connections.values()) con.sendPing();
}, PING_INTERVAL);
