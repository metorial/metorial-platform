import { serialize } from '@lowerdeck/serialize';
import type { ConduitResult } from '@metorial-subspace/connection-utils';
import { conduitResultToMcpMessage } from '@metorial-subspace/connection-utils';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { broadcastNats } from '../lib/nats';
import { topics } from '../lib/topic';
import type { McpManager } from './manager';

let PROGRESS_INITIAL_DELAY_MS = 5_000;
let PROGRESS_INTERVAL_MS = 10_000;

export type McpProgressToken = string | number;

export type McpControlMessage =
  | {
      type: 'mcp_control_message';
      conduit: ConduitResult;
      channel: 'targeted_response' | 'broadcast_response_or_notification';
    }
  | {
      type: 'ping_received';
    };

export let getMcpProgressToken = (msg: JSONRPCMessage): McpProgressToken | null => {
  let token = (msg as any)?.params?._meta?.progressToken;
  if (typeof token === 'string' || typeof token === 'number') {
    return token;
  }

  return null;
};

export let isProgressNotificationForToken = (
  msg: JSONRPCMessage,
  progressToken: McpProgressToken
) => {
  return (
    'method' in msg &&
    msg.method === 'notifications/progress' &&
    (msg as any)?.params?.progressToken === progressToken
  );
};

export class McpControlMessageHandler {
  #lastInteractionAt: number;

  constructor(private readonly manager: McpManager) {
    this.#lastInteractionAt = Date.now();
  }

  get session() {
    return this.manager.session;
  }

  get lastInteractionAt() {
    return this.#lastInteractionAt;
  }

  async sendControlMessage(msg: McpControlMessage) {
    let connection = await this.manager.getConnection();

    await broadcastNats.publish(
      topics.mcpConnection.encode({
        session: this.session,
        connection
      }),
      serialize.encode(msg)
    );
  }

  startProgressNotifier(d: { progressToken: McpProgressToken; message?: string }) {
    let stopped = false;
    let startedAt = Date.now();

    let emit = async () => {
      if (stopped) return;

      await this.sendControlMessage({
        type: 'mcp_control_message',
        channel: 'broadcast_response_or_notification',
        conduit: {
          status: 'succeeded',
          message: null,
          completedAt: null,
          output: {
            type: 'mcp',
            data: {
              jsonrpc: '2.0',
              method: 'notifications/progress',
              params: {
                progressToken: d.progressToken,
                progress: Date.now() - startedAt,
                message: d.message
              }
            } satisfies JSONRPCMessage
          }
        }
      });
    };

    let initialTimeout = setTimeout(() => {
      void emit().catch(() => {});
    }, PROGRESS_INITIAL_DELAY_MS);

    let interval = setInterval(() => {
      void emit().catch(() => {});
    }, PROGRESS_INTERVAL_MS);

    return {
      stop: () => {
        stopped = true;
        clearTimeout(initialTimeout);
        clearInterval(interval);
      }
    };
  }

  async controlListener(d: { selectedChannels: 'all' | 'broadcast' }) {
    let connection = await this.manager.getConnection();

    let sub = broadcastNats.subscribe(
      topics.mcpConnection.encode({
        session: this.session,
        connection
      })
    );

    let self = this;

    return {
      close: () => sub.unsubscribe(),

      async *[Symbol.asyncIterator]() {
        for await (let msg of sub) {
          let data = serialize.decode(new TextDecoder().decode(msg.data)) as McpControlMessage;

          self.#lastInteractionAt = Date.now();

          if (data.type === 'mcp_control_message') {
            let conduitRes = await conduitResultToMcpMessage(data.conduit);

            // Ignore targeted messages if we only want broadcasts
            if (d.selectedChannels === 'broadcast' && data.channel === 'targeted_response') {
              continue;
            }

            if (conduitRes) yield { mcp: conduitRes, message: data.conduit.message };
          }
        }
      }
    };
  }
}
