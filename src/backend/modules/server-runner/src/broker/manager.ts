import {
  db,
  Instance,
  Organization,
  ServerRun,
  ServerSession,
  ServerVersion,
  SessionMessageType
} from '@metorial/db';
import { debug } from '@metorial/debug';
import { generatePlainId } from '@metorial/id';
import {
  InitializeRequestSchema,
  InitializeResultSchema,
  MCP_IDS,
  type InitializeResult,
  type JSONRPCResponse
} from '@metorial/mcp-utils';
import { ProgrammablePromise } from '@metorial/programmable-promise';
import { getSentry } from '@metorial/sentry';
import { getUnifiedIdIfNeeded } from '@metorial/unified-id';
import { BrokerRunnerImplementation } from './implementations/base';
import { BrokerBus } from './lib/bus';

let RELEVANT_TYPES: SessionMessageType[] = ['error', 'notification', 'request', 'response'];
let NO_CLIENT_REQUEST_TIMEOUT = 1000 * 30;
let MAX_AGE = 1000 * 60 * 60;
let ACTIVE_PING_INTERVAL = 1000 * 30;

let managers = new Set<BrokerRunManager>();

let Sentry = getSentry();

export class BrokerRunManager {
  #bus: Promise<BrokerBus>;
  #isClosing = false;
  #lastClientMessageAt: number;
  #lastClientRequestMessageAt: number;
  #statedAt: number;
  #activePingIv: NodeJS.Timer;
  #completedPromise = new ProgrammablePromise<void>();

  constructor(
    private implementation: BrokerRunnerImplementation,
    private serverRun: ServerRun,
    private session: ServerSession,
    private serverVersion: ServerVersion,
    private instance: Instance & { organization: Organization }
  ) {
    managers.add(this);

    this.#statedAt = Date.now();
    this.#lastClientMessageAt = Date.now();
    this.#lastClientRequestMessageAt = Date.now();

    let dbPing = async () => {
      try {
        await db.serverRun.updateMany({
          where: { oid: this.serverRun.oid },
          data: { lastPingAt: new Date() }
        });

        await db.session.updateMany({
          where: { oid: this.session.sessionOid },
          data: { lastClientPingAt: new Date() }
        });
      } catch (e) {
        Sentry.captureException(e);
        console.error('Error pinging database', e);
      }
    };

    this.#activePingIv = setInterval(dbPing, ACTIVE_PING_INTERVAL);

    this.#bus = BrokerBus.create({ type: 'server', id: serverRun.id }, session, instance, {
      subscribe: true
    });

    this.startBusListener();
    this.startConnectionListener();

    this.implementation.onClose(() => {
      this.close();
    });

    (async () => {
      await db.serverRun.updateMany({
        where: { oid: this.serverRun.oid },
        data: {
          status: 'active',
          startedAt: new Date()
        }
      });
    })().catch(e => {
      Sentry.captureException(e);
      console.error('Error updating server run', e);
    });
  }

  async close() {
    if (this.#isClosing) return;
    this.#isClosing = true;

    this.#completedPromise.resolve();
    clearInterval(this.#activePingIv!);
    managers.delete(this);

    db.serverRun.updateMany({
      where: { oid: this.serverRun.oid },
      data: {
        stoppedAt: new Date(),
        lastPingAt: new Date()
      }
    });

    // Only mark as completed if the server run is still active
    // and has not been marked as failed
    db.serverRun.updateMany({
      where: { oid: this.serverRun.oid, status: 'active' },
      data: { status: 'completed' }
    });

    await db.serverSession.updateMany({
      where: { id: this.session.id },
      data: { status: 'stopped' }
    });

    this.#bus
      .then(b => b.close())
      .catch(e => {
        Sentry.captureException(e);
        console.error('Error closing bus', e);
      });

    this.implementation.close().catch(e => {
      Sentry.captureException(e);
      console.error('Error closing implementation', e);
    });
  }

  async checkTimeout() {
    let now = Date.now();
    let messageDiff = now - this.#lastClientRequestMessageAt;
    let startDiff = now - this.#statedAt;

    if (messageDiff > NO_CLIENT_REQUEST_TIMEOUT) {
      debug.warn(`Broker run timeout: ${messageDiff}ms`);
      this.close();

      // TODO: create event for this

      // this.#bus.then(bus =>
      //   bus.sendDebugMessage({
      //     type: 'note',
      //     payload: {
      //       title: 'Hibernating MCP Server',
      //       message:
      //         'The server is hibernating due to inactivity, send a request to wake it up.'
      //     }
      //   })
      // );
    } else if (startDiff > MAX_AGE) {
      debug.warn(`Broker run max age timeout: ${startDiff}ms`);
      this.close();

      // TODO: create event for this

      // this.#bus.then(bus =>
      //   bus.sendDebugMessage({
      //     type: 'note',
      //     payload: {
      //       title: 'Stopping MCP Server',
      //       message: 'Stopping the server due to max age timeout.'
      //     }
      //   })
      // );
    }
  }

  get waitForClose() {
    return this.#completedPromise.promise;
  }

  private async updateSession(ses: Partial<ServerSession>) {
    let updated = await db.serverSession.update({
      where: { id: this.session.id },
      data: ses as any
    });

    Object.assign(this.session, updated);
  }

  private startBusListener() {
    this.#bus
      .then(async bus => {
        let pullAndSend = async () => {
          let messages = await bus.pullMessages({ type: RELEVANT_TYPES });

          for (let message of messages) {
            if (message.type == 'request') {
              this.#lastClientRequestMessageAt = Date.now();
            }

            if ('method' in message.payload && message.payload.method == 'initialize') {
              let initRes = InitializeRequestSchema.safeParse(message.payload);
              if (initRes.success) {
                await this.updateSession({
                  clientCapabilities: initRes.data.params.capabilities,
                  clientInfo: initRes.data.params.clientInfo,
                  mcpVersion: initRes.data.params.protocolVersion
                });
              }
            }

            await this.implementation.sendMessage({
              ...message.payload,
              id: getUnifiedIdIfNeeded('server', message)!
            });
          }
        };

        // bus.onClose(() => {
        //   this.close();
        // });

        bus.onMessage(async () => {
          this.#lastClientMessageAt = Date.now();

          await pullAndSend();
        });

        bus.onStop(async () => {
          this.close();
        });

        await pullAndSend();
      })
      .catch(e => {
        console.error('Error creating bus', e);
        this.close();
      });
  }

  private startConnectionListener() {
    this.implementation.onClose(() => {
      this.close();
    });

    this.implementation.onError(async e => {
      (await this.#bus).sendServerError({ message: e.message });
    });

    this.implementation.onMessage(async msg => {
      if (
        ('method' in msg && 'id' in msg && String(msg.id).startsWith(MCP_IDS.INIT)) ||
        !this.session.mcpInitialized
      ) {
        let initResult = InitializeResultSchema.safeParse((msg as JSONRPCResponse).result);

        if (initResult.success) {
          await this.initServerVersionAttributesIfNeeded(initResult.data);

          // If we are re-establishing the connection,
          // we can't send the initialize message again
          if (this.session.mcpInitialized) {
            // But it's our responsibility to send the
            // initialized confirmation now
            await this.implementation.sendMessage({
              jsonrpc: '2.0',
              method: 'notifications/initialized'
            });

            return; // DO NOT SEND THE INIT MESSAGE TO THE CLIENT
          } else {
            await this.updateSession({
              mcpInitialized: true
            });

            msg = {
              jsonrpc: '2.0',
              id: (msg as JSONRPCResponse).id,
              result: {
                ...initResult.data,
                protocolVersion: this.session.mcpVersion
              }
            } as JSONRPCResponse;
          }
        }
      }

      (await this.#bus).sendMessage(msg);
    });

    // We are re-establishing the connection, so we
    // need to replay the initialize message
    if (this.session.mcpInitialized) {
      this.implementation.sendMessage({
        jsonrpc: '2.0',
        id: `${MCP_IDS.INIT}${generatePlainId(15)}`,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: this.session.clientCapabilities,
          clientInfo: this.session.clientInfo
        }
      });
    }
  }

  private async initServerVersionAttributesIfNeeded(initResult: InitializeResult) {
    if (
      this.serverVersion.tools == null &&
      this.serverVersion.prompts == null &&
      this.serverVersion.resourceTemplates == null &&
      this.serverVersion.serverCapabilities == null
    ) {
      (async () => {
        let tools = initResult.capabilities.tools ? await this.implementation.listTools() : [];
        let prompts = initResult.capabilities.prompts
          ? await this.implementation.listPrompts()
          : [];
        let resourceTemplates = initResult.capabilities.resources
          ? await this.implementation.listResourceTemplates()
          : [];

        await db.serverVersion.updateMany({
          where: {
            id: this.serverVersion.id
          },
          data: {
            serverCapabilities: initResult.capabilities,
            serverInfo: initResult.serverInfo,

            tools,
            prompts,
            resourceTemplates
          }
        });

        await db.serverVariant.updateMany({
          where: {
            oid: this.serverVersion.serverVariantOid,
            currentVersionOid: this.serverVersion.oid
          },
          data: {
            serverCapabilities: initResult.capabilities,
            serverInfo: initResult.serverInfo,

            tools,
            prompts,
            resourceTemplates
          }
        });
      })().catch(e => {
        Sentry.captureException(e);
        console.error('Error initializing server', e);
      });
    }
  }
}

setInterval(() => {
  for (let con of managers.values()) con.checkTimeout();
}, 10 * 1000);
