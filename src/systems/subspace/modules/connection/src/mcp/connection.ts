import { generatePlainId } from '@lowerdeck/id';
import { getSentry } from '@lowerdeck/sentry';
import type { SessionConnectionMcpConnectionTransport } from '@metorial-subspace/db';
import { interleave } from '@metorial-subspace/generator';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import {
  CONNECTION_INACTIVITY_TIMEOUT_MS,
  PING_INTERVAL_MS,
  PING_MESSAGE_ID_PREFIX
} from '../const';
import type { SenderMangerProps } from '../sender';
import { McpControlMessageHandler } from './control';
import { McpManager } from './manager';
import { type HandleResponseOpts, McpSender } from './sender';

let Sentry = getSentry();

let id = 0;
let connectionsWithListeners = new Map<number, McpConnection>();

export class McpConnection {
  #id = id++;
  #connectionInstanceId: string;
  #pingCounter = 0;

  #control: McpControlMessageHandler;
  #sender: McpSender;

  #listenerClose = new Set<() => Promise<void>>();

  private constructor(
    private readonly manager: McpManager,
    mcpTransport: SessionConnectionMcpConnectionTransport
  ) {
    this.#control = new McpControlMessageHandler(this.manager);
    this.#sender = new McpSender(mcpTransport, this.manager, this.#control);

    this.#connectionInstanceId = generatePlainId();
  }

  get lastInteractionAt() {
    return this.#control.lastInteractionAt;
  }

  static async create(
    d: Omit<SenderMangerProps, 'transport'> & {
      mcpTransport: SessionConnectionMcpConnectionTransport;
    }
  ): Promise<McpConnection> {
    return new McpConnection(await McpManager.create(d), d.mcpTransport);
  }

  get session() {
    return this.manager.session;
  }

  get connection() {
    return this.manager.connection;
  }

  async listener(d: { selectedChannels: 'all' | 'broadcast'; replayFromMessageId?: string }) {
    let controlListener = await this.#control.controlListener(d);
    let senderListener = this.manager.senderListener(d);

    connectionsWithListeners.set(this.#id, this);

    let close = async () => {
      this.#listenerClose.delete(close);

      if (this.#listenerClose.size === 0) {
        connectionsWithListeners.delete(this.#id);
      }

      await Promise.allSettled([senderListener.close(), controlListener.close()]);
    };

    this.#listenerClose.add(close);

    return {
      close,
      iterator: () => interleave(senderListener, controlListener)
    };
  }

  handleMessage(msg: JSONRPCMessage, opts: HandleResponseOpts) {
    return this.#sender.handleMessage(msg, opts);
  }

  createConnection() {
    return this.manager.createConnection();
  }

  disableConnection() {
    return this.manager.disableConnection();
  }

  async sendPing() {
    await this.#control.sendControlMessage({
      type: 'mcp_control_message',
      channel: 'broadcast_response_or_notification',
      conduit: {
        status: 'succeeded',
        message: null,
        output: {
          type: 'mcp',
          data: {
            jsonrpc: '2.0',
            method: 'ping',
            id: `${PING_MESSAGE_ID_PREFIX}${this.#connectionInstanceId}${this.#pingCounter++}`,
            params: {}
          }
        },
        completedAt: new Date()
      }
    });
  }

  async pingTimeout() {}
}

setInterval(() => {
  let now = Date.now();
  for (let [, conn] of connectionsWithListeners) {
    conn.sendPing();

    let diff = now - conn.lastInteractionAt;
    if (diff > CONNECTION_INACTIVITY_TIMEOUT_MS) {
      conn.pingTimeout().catch(e => {
        Sentry.captureException(e);
      });
    }
  }
}, PING_INTERVAL_MS);
