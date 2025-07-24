import {
  Instance,
  Organization,
  ServerDeployment,
  ServerSession,
  ServerVariant,
  SessionMessage,
  type SessionMessageType
} from '@metorial/db';
import type { JSONRPCMessage } from '@metorial/mcp-utils';
import { BrokerClientManager } from '@metorial/module-server-runner';
import { BaseConnectionHandler, ConnectionMessage } from './base';

export class LegacyConnectionHandler extends BaseConnectionHandler {
  #client: BrokerClientManager;

  private constructor(
    session: ServerSession & {
      serverDeployment: ServerDeployment & {
        serverVariant: ServerVariant;
      };
    },
    instance: Instance & { organization: Organization },
    private readonly opts: { mode: 'send-only' | 'send-and-receive' }
  ) {
    super(session, instance);

    this.#client = new BrokerClientManager(session, instance, {
      subscribe: opts.mode == 'send-and-receive'
    });

    this.init();
  }

  static async create(
    session: ServerSession & {
      serverDeployment: ServerDeployment & {
        serverVariant: ServerVariant;
      };
    },
    instance: Instance & { organization: Organization },
    opts: { mode: 'send-only' | 'send-and-receive' }
  ) {
    return new LegacyConnectionHandler(session, instance, opts);
  }

  private toConnectionMessage(
    message: JSONRPCMessage,
    stored: SessionMessage
  ): ConnectionMessage {
    return {
      message: message,
      trackingId: stored.id,
      type: stored.type
    };
  }

  get mode() {
    return this.opts.mode;
  }

  async sendMessage(
    message: JSONRPCMessage[],
    opts: {
      includeResponses?: boolean;
      onResponse?: (message: ConnectionMessage) => void;
    }
  ) {
    let sentMessages = await this.#client.sendMessage(message);

    if (opts.includeResponses) {
      let idsToWaitFor = new Set(
        sentMessages
          .filter(m => m.type == 'request')
          .map(m => m.unifiedId)
          .filter(Boolean)
          .map(String)
      );

      if (idsToWaitFor.size) {
        return new Promise<{ responses: ConnectionMessage[] }>((resolve, reject) => {
          let closedRef = { current: false };

          let responses: ConnectionMessage[] = [];

          let timeout = setTimeout(
            () => {
              closedRef.current = true;
              reject(new Error('Timeout waiting for response'));
            },
            1000 * 60 * 2
          );

          this.#client.onMessage(
            {
              type: ['error', 'notification', 'response', 'request'],
              ids: Array.from(idsToWaitFor)
            },
            async (message, stored) => {
              if (closedRef.current) return;

              if (stored?.type != 'request' && stored?.unifiedId) {
                idsToWaitFor.delete(stored?.unifiedId);
              }

              let con = this.toConnectionMessage(message, stored);

              await opts.onResponse?.(con);
              responses.push(con);

              if (idsToWaitFor.size == 0) {
                closedRef.current = true;
                clearTimeout(timeout);
                resolve({ responses });
              }
            }
          );
        });
      }
    }

    return { responses: [] };
  }

  #closing = false;
  async close() {
    if (this.#closing) return;
    this.#closing = true;

    await this.#client.close();
  }

  #stopping = false;
  async stop() {
    if (this.#stopping) return;
    this.#stopping = true;

    await this.#client.stop();
    await this.close();
  }

  async onMessage(
    opts: {
      type: SessionMessageType[];
      ids?: string[];
      pull?: {
        afterId: string | undefined;
        type: SessionMessageType[];
      };
    },
    handler: (message: ConnectionMessage) => void
  ) {
    return this.#client.onMessage(opts, (m, s) => handler(this.toConnectionMessage(m, s)));
  }

  private async init() {}
}
