import { serialize } from '@lowerdeck/serialize';
import type { ConduitResult } from '@metorial-subspace/connection-utils';
import { conduitResultToMcpMessage } from '@metorial-subspace/connection-utils';
import { broadcastNats } from '../lib/nats';
import { topics } from '../lib/topic';
import type { McpManager } from './manager';

export type McpControlMessage =
  | {
      type: 'mcp_control_message';
      conduit: ConduitResult;
      channel: 'targeted_response' | 'broadcast_response_or_notification';
    }
  | {
      type: 'ping_received';
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
