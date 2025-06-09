import {
  Instance,
  Organization,
  ServerDeployment,
  ServerSession,
  ServerVariant,
  type SessionMessage,
  type SessionMessageType
} from '@metorial/db';
import type { JSONRPCMessage } from '@metorial/mcp-utils';
import { BrokerClientManager } from '@metorial/module-server-runner';

export class SessionManager {
  #client: BrokerClientManager;

  constructor(
    private session: ServerSession & {
      serverDeployment: ServerDeployment & {
        serverVariant: ServerVariant;
      };
    },
    private instance: Instance & { organization: Organization },
    opts: { mode: 'send-only' | 'send-and-receive' }
  ) {
    this.#client = new BrokerClientManager(session, instance, {
      subscribe: opts.mode == 'send-and-receive'
    });

    this.init();
  }

  async sendMessage(message: JSONRPCMessage[]) {
    return await this.#client.sendMessage(message);
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

  onMessage(
    opts: {
      type: SessionMessageType[];
      ids?: string[];
      pull?: {
        afterId: string | undefined;
        type: SessionMessageType[];
      };
    },
    handler: (message: JSONRPCMessage, stored: SessionMessage) => void
  ) {
    this.#client.onMessage(opts, handler);
  }

  private async init() {}
}
