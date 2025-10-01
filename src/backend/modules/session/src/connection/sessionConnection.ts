import {
  db,
  Instance,
  Organization,
  Server,
  ServerDeployment,
  ServerSession,
  ServerVariant,
  type SessionMessageType
} from '@metorial/db';
import { debug } from '@metorial/debug';
import { badRequestError, ServiceError } from '@metorial/error';
import {
  jsonRpcPingRequest,
  jsonRpcPingResponse,
  MCP_IDS,
  type JSONRPCMessage
} from '@metorial/mcp-utils';
import { ProgrammablePromise } from '@metorial/programmable-promise';
import { createRedisClient } from '@metorial/redis';
import { getSentry } from '@metorial/sentry';
import { ConnectionHandler } from './handler';
import { BaseConnectionHandler, ConnectionMessage } from './handler/base';
import { SessionControlMessageBackend } from './sessionControlMessageBackend';

let Sentry = getSentry();

let PING_INTERVAL = process.env.NODE_ENV == 'development' ? 1000 * 5 : 1000 * 45;
let PING_TIMEOUT = process.env.NODE_ENV == 'development' ? 1000 * 10 : 1000 * 75;

let connections = new Set<SessionConnection>();

let connectionRedis = createRedisClient({}).eager();
let getSessionRedisKey = (sessionId: string) => `mtg/ose/s1:${sessionId}:png`;

export class SessionConnection {
  #controlMessageBackend: SessionControlMessageBackend;
  #closePromise = new ProgrammablePromise<void>();
  #pingIv?: NodeJS.Timeout;
  #startedAt = Date.now();

  static async create(
    session: ServerSession & {
      serverDeployment: ServerDeployment & {
        serverVariant: ServerVariant;
        server: Server;
      };
    },
    instance: Instance & { organization: Organization },
    opts: { mode: 'send-only' | 'send-and-receive'; receiveControlMessages: boolean }
  ): Promise<SessionConnection> {
    if (
      session.serverDeployment.serverVariant.status !== 'active' ||
      session.serverDeployment.server.status !== 'active'
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot create session for inactive server'
        })
      );
    }

    let manager = await ConnectionHandler.create(session, instance, opts);
    return new SessionConnection(session, instance, opts, manager);
  }

  private constructor(
    private session: ServerSession & {
      serverDeployment: ServerDeployment & {
        serverVariant: ServerVariant;
      };
    },
    private instance: Instance & { organization: Organization },
    private opts: { mode: 'send-only' | 'send-and-receive'; receiveControlMessages: boolean },
    private readonly manager: BaseConnectionHandler
  ) {
    this.#controlMessageBackend = new SessionControlMessageBackend(session, {
      mode: opts.mode
    });

    this.onClose(() => this.close());

    if (opts.mode == 'send-and-receive') {
      this.#pingIv = setInterval(() => {
        (async () => {
          await db.session.updateMany({
            where: { oid: this.session.sessionOid },
            data: {
              lastClientPingAt: new Date(),
              connectionStatus: 'connected'
            }
          });
        })().catch(e => {
          Sentry.captureException(e);
          console.error('Error sending message', e);
        });
      }, 30 * 1000);
    }

    connections.add(this);
  }

  #closing = false;
  async close() {
    connections.delete(this);

    if (this.#closing) return;
    this.#closing = true;

    debug.log('Closing session connection', this.session.id);

    this.#closePromise.resolve();

    if (this.#pingIv) clearInterval(this.#pingIv);

    await this.#controlMessageBackend.close();
    await this.manager.close();
  }

  get mode() {
    return this.manager.mode;
  }

  // async stop() {
  //   await this.#manager.stop();
  //   await this.close();
  // }

  async sendMessage(message: JSONRPCMessage | JSONRPCMessage[]) {
    let messages = Array.isArray(message) ? message : [message];

    (await connectionRedis)
      .set(getSessionRedisKey(this.session.id), String(Date.now()), {
        expiration: {
          type: 'EX',
          value: Math.ceil((PING_TIMEOUT * 3) / 1000)
        }
      })
      .catch(e => {
        Sentry.captureException(e);
        console.error('Error setting last message time', e);
      });

    let messagesToSend: JSONRPCMessage[] = [];

    for (let i = 0; i < messages.length; i++) {
      let message = messages[i];
      if ('method' in message && message.method == 'ping') {
        // Client pings are handled by the control message backend
        // and are not sent to the server
        if ('id' in message) {
          this.#controlMessageBackend.sendMessage(jsonRpcPingResponse(message));
        }

        continue;
      }

      if ('id' in message && String(message.id).startsWith(MCP_IDS.PING)) {
        // Ignore ping messages
        continue;
      }

      messagesToSend.push(message);
    }

    if (messagesToSend.length) return await this.manager.sendMessage(messagesToSend, {});

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
    handler: (message: ConnectionMessage) => void
  ) {
    this.manager.onMessage(opts, handler);
    if (this.opts.receiveControlMessages && !opts.ids)
      this.#controlMessageBackend.onMessage(handler);
  }

  async sendMessagesAndWaitForResponse(
    messages: JSONRPCMessage[],
    handler: (message: ConnectionMessage) => void
  ) {
    let sentMessages = await this.manager.sendMessage(messages, {
      includeResponses: true,
      onResponse: handler
    });
  }

  get waitForClose() {
    return this.#closePromise.promise;
  }

  onClose(handler: () => void) {
    this.#controlMessageBackend.onClose(handler);
  }

  async checkPing() {
    let now = Date.now();

    let lastMessageAt = await (await connectionRedis).get(getSessionRedisKey(this.session.id));
    let pingDiff = now - (Number(lastMessageAt) || this.#startedAt);

    if (pingDiff > PING_TIMEOUT) {
      debug.warn(`Client ping timeout (connection): ${pingDiff}ms`);
      this.close();
    }
  }

  sendPing() {
    if (this.opts.mode == 'send-only') return;
    this.#controlMessageBackend.sendMessage(jsonRpcPingRequest(this.session.id));
  }
}

// setInterval(() => {
//   for (let con of connections.values()) {
//     con.checkPing().catch(e => {
//       Sentry.captureException(e);
//       console.error('Error checking ping', e);
//     });
//   }
// }, 30 * 1000);

setInterval(() => {
  for (let con of connections.values()) con.sendPing();
}, PING_INTERVAL);
