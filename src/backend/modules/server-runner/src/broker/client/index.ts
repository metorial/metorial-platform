import type {
  Instance,
  Organization,
  ServerDeployment,
  ServerSession,
  ServerVariant,
  SessionMessage,
  SessionMessageType
} from '@metorial/db';
import type { JSONRPCMessage } from '@metorial/mcp-utils';
import { getUnifiedIdIfNeeded } from '@metorial/unified-id';
import { ensureRunnerForSession } from '../jobs';
import { BrokerBus } from '../lib/bus';
import { Participant } from '../types';

let ENSURE_RUNNER_TIMEOUT = 1000 * 5;
let ensuredRunnerCache = new Map<string, number>();

export class BrokerClientManager {
  #bus: Promise<BrokerBus>;

  constructor(
    private session: ServerSession & {
      serverDeployment: ServerDeployment & {
        serverVariant: ServerVariant;
      };
    },
    private instance: Instance & { organization: Organization },
    opts: { subscribe: boolean }
  ) {
    this.#bus = BrokerBus.create(this.participant, this.session, instance, opts);
  }

  #closing = false;
  async close() {
    if (this.#closing) return;
    this.#closing = true;

    let bus = await this.#bus;
    await bus.close();
  }

  #stopping = false;
  async stop() {
    if (this.#stopping) return;
    this.#stopping = true;

    let bus = await this.#bus;

    await bus.stop();
    await this.close();
  }

  get participant(): Participant {
    return {
      type: 'client',
      id: this.session.id
    };
  }

  async sendMessage(message: JSONRPCMessage | JSONRPCMessage[]) {
    let messages: JSONRPCMessage[] = Array.isArray(message) ? message : [message];
    if (!messages.length) return [];

    await this.ensureRunner();
    return this.#bus.then(bus => bus.sendMessage(message));
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
    this.#bus.then(bus => {
      let pull = async (initial?: boolean) => {
        let messages = await (
          await this.#bus
        ).pullMessages(
          initial && opts.pull
            ? {
                ...opts.pull,
                includeHandled: true
              }
            : opts
        );

        for (let message of messages) {
          try {
            await handler(
              {
                ...message.payload,
                id: getUnifiedIdIfNeeded('client', message)!
              },
              message
            );
          } catch (e) {}
        }
      };

      bus.onMessage(pull);

      pull(true);
    });
  }

  private async ensureRunner() {
    let hasEnsuredRunnerAt = ensuredRunnerCache.get(this.session.id) ?? 0;

    if (hasEnsuredRunnerAt) {
      let now = Date.now();
      if (now - hasEnsuredRunnerAt < ENSURE_RUNNER_TIMEOUT) return;
    }

    ensureRunnerForSession(this.session);
    ensuredRunnerCache.set(this.session.id, Date.now());
  }
}
