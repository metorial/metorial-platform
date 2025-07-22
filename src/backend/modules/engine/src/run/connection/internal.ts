import { db, ServerRun } from '@metorial/db';
import { debug } from '@metorial/debug';
import { internalServerError, ServiceError } from '@metorial/error';
import { createLock } from '@metorial/lock';
import {
  EngineSession,
  EngineSessionRun,
  McpError,
  McpOutput,
  SessionEvent
} from '@metorial/mcp-engine-generated';
import { McpClient, McpServer } from '@metorial/mcp-utils';
import { getSentry } from '@metorial/sentry';
import { getUnifiedIdIfNeeded, UnifiedID } from '@metorial/unified-id';
import { InitializeRequest, JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { addRunSync } from '../../queues/syncRuns';
import { createEngineRun } from '../data/engineRun';
import { createSessionMessage } from '../data/message';
import {
  EngineMcpMessage,
  engineMcpMessageFromPb,
  engineMcpMessageToPbRaw,
  fromJSONRPCMessage
} from '../mcp/message';
import { MCPMessageType, messageTypeToPb } from '../mcp/types';
import { forceSync } from '../sync/force';
import { EngineSessionConnectionBase } from './base';
import { EngineSessionManager } from './engineSession';
import { EngineSessionProxy } from './proxy';
import { EngineRunConfig } from './types';
import { getEngineSessionType } from './util';

const INACTIVITY_TIMEOUT = 1000 * 60;

let Sentry = getSentry();

let activeSessions = new Map<string, EngineSessionConnectionInternal>();

let sessionLock = createLock({
  name: 'eng/eses'
});

export class EngineSessionConnectionInternal extends EngineSessionConnectionBase {
  #lastInteraction: Date = new Date();
  #unifiedId: UnifiedID;
  #serverRun: ServerRun | null = null;
  #abort: AbortController = new AbortController();
  #proxies: Set<EngineSessionProxy> = new Set();

  constructor(private readonly engineSessionManager: EngineSessionManager) {
    super();

    this.#unifiedId = new UnifiedID(this.config.serverSession.id);

    activeSessions.set(this.config.serverSession.id, this);
  }

  get config() {
    return this.engineSessionManager.config;
  }

  get engineSessionInfo() {
    return this.engineSessionManager.engineSession;
  }

  static canClose(session: EngineSessionConnectionInternal) {
    let timeSinceLastInteraction = new Date().getTime() - session.lastInteraction.getTime();
    return timeSinceLastInteraction > INACTIVITY_TIMEOUT;
  }

  static async ensure(
    config: EngineRunConfig
  ): Promise<EngineSessionConnectionInternal | null> {
    let existing = activeSessions.get(config.serverSession.id);
    if (existing) {
      existing.touch();
      return existing;
    }

    let manager = await EngineSessionManager.create(config);
    if (!manager) return null;

    return new EngineSessionConnectionInternal(manager);
  }

  registerProxy(proxy: EngineSessionProxy) {
    this.#proxies.add(proxy);
  }

  unregisterProxy(proxy: EngineSessionProxy) {
    this.#proxies.delete(proxy);

    // if (this.#proxies.size === 0) {
    //   // If there are no proxies left, we can close the session
    //   if (EngineSessionConnectionInternal.canClose(this)) {
    //     this.close();
    //   }
    // }
  }

  get lastInteraction() {
    return this.#lastInteraction;
  }

  async *getMcpStream(i: {
    replayAfterUuid?: string;
    onlyIds?: string[];
    onlyMessageTypes?: MCPMessageType[];
    signal: AbortSignal;
  }) {
    this.touch();

    let self = this;

    let touchIv = setInterval(() => {
      self.touch();
    }, 1000 * 15);

    try {
      yield* this.engineSessionManager.withClientGenerator(
        async function* (client, engineSession) {
          try {
            let stream = client.streamMcpMessages(
              {
                sessionId: engineSession.externalId,

                replayAfterUuid: i.replayAfterUuid,
                onlyIds: i.onlyIds ?? [],
                onlyMessageTypes: (i.onlyMessageTypes ?? []).map(t => messageTypeToPb(t))
              },
              {
                signal: AbortSignal.any([self.#abort.signal, i.signal])
              }
            );

            let runId: string | null = null;

            for await (let message of stream) {
              if (message.mcpMessage) {
                let msg = engineMcpMessageFromPb(
                  message.mcpMessage,
                  {
                    type: 'server',
                    id: runId ?? self.config.serverSession.id
                  },
                  self.#unifiedId
                );

                yield {
                  ...msg,
                  message: {
                    ...msg.message,
                    id: getUnifiedIdIfNeeded('client', msg)!
                  }
                };

                self
                  .upsertMessageFromEngineMessage(msg)
                  .catch(err => Sentry.captureException(err));
              }

              if (message.sessionEvent) {
                runId = self.getRunIdFromSessionEvent(message.sessionEvent);
                await self.handleSessionEvent(message.sessionEvent);
              }

              if (message.mcpError) {
                self
                  .handleMcpError(message.mcpError)
                  .catch(err => Sentry.captureException(err));
              }

              if (message.mcpOutput) {
                self
                  .handleMcpOutput(message.mcpOutput)
                  .catch(err => Sentry.captureException(err));
              }
            }
          } catch (err: any) {
            await self.handleGrpcError(err);
          }
        }
      );
    } finally {
      clearInterval(touchIv);
    }
  }

  async *sendMcpMessageStream(
    raw: JSONRPCMessage[],
    opts: {
      includeResponses?: boolean;
      signal: AbortSignal;
    }
  ) {
    if (raw.length === 0) return;

    this.touch();
    let touchIv = setInterval(() => {
      this.touch();
    }, 1000 * 15);

    let self = this;

    try {
      yield* this.engineSessionManager.withClientGenerator(
        async function* (client, engineSession) {
          try {
            let runId: string | null = null;

            let messages = raw.map(msg =>
              fromJSONRPCMessage(
                msg,
                {
                  type: 'client',
                  id: `mccl_${self.config.serverSession.oid.toString(36)}`
                },
                self.#unifiedId
              )
            );

            for (let msg of messages) {
              self
                .upsertMessageFromEngineMessage(msg)
                .catch(err => Sentry.captureException(err));

              if (msg.type == 'request' && msg.method == 'initialize') {
                let protocolVersion = (msg.message as any as InitializeRequest).params
                  .protocolVersion;
                await self.setProtocolVersion(protocolVersion);
              }
            }

            let stream = client.sendMcpMessage(
              {
                sessionId: engineSession.externalId,
                mcpMessages: messages.map(m =>
                  engineMcpMessageToPbRaw({
                    ...m,
                    message: {
                      ...m.message,
                      id: getUnifiedIdIfNeeded('server', m)!
                    }
                  })
                ),
                includeResponses: !!opts.includeResponses
              },
              {
                signal: AbortSignal.any([self.#abort.signal, opts.signal])
              }
            );

            for await (let message of stream) {
              if (message.mcpMessage) {
                let msg = engineMcpMessageFromPb(
                  message.mcpMessage,
                  {
                    type: 'server',
                    id: runId ?? self.config.serverSession.id
                  },
                  self.#unifiedId
                );

                yield {
                  ...msg,
                  message: {
                    ...msg.message,
                    id: getUnifiedIdIfNeeded('client', msg)!
                  }
                };

                self
                  .upsertMessageFromEngineMessage(msg)
                  .catch(err => Sentry.captureException(err));
              }

              if (message.sessionEvent) {
                runId = self.getRunIdFromSessionEvent(message.sessionEvent);
                await self.handleSessionEvent(message.sessionEvent);
              }

              if (message.mcpError) {
                self
                  .handleMcpError(message.mcpError)
                  .catch(err => Sentry.captureException(err));
              }
            }
          } catch (err: any) {
            await self.handleGrpcError(err);
          }
        }
      );
    } finally {
      clearInterval(touchIv);
    }
  }

  async sendMcpMessage(raw: JSONRPCMessage[]) {
    let stream = this.sendMcpMessageStream(raw, {
      includeResponses: false,
      signal: this.#abort.signal
    });

    for await (let _ of stream) {
      // Just want for the stream to finish
    }
  }

  close() {
    this.#proxies.clear();
    this.#abort.abort();
    activeSessions.delete(this.config.serverSession.id);
  }

  private async setProtocolVersion(version: string) {
    if (!version) return;

    db.serverSession
      .update({
        where: { oid: this.config.serverSession.oid },
        data: {
          mcpVersion: version,
          mcpInitialized: true
        }
      })
      .catch(e => Sentry.captureException(e));
  }

  #lastStoredAt = 0;
  private touch() {
    if (this.#abort.signal.aborted) return;

    this.#lastInteraction = new Date();

    let timeSinceLastStored = this.#lastInteraction.getTime() - this.#lastStoredAt;
    if (timeSinceLastStored > 1000 * 45 && this.#serverRun) {
      db.serverRun
        .updateMany({
          where: { oid: this.#serverRun.oid },
          data: { lastPingAt: this.#lastInteraction }
        })
        .catch(err => Sentry.captureException(err));
    }
  }

  private async handleGrpcError(err: any) {
    if (err.message?.includes('aborted')) return;

    debug.error('Engine Session Connection Error', {
      error: err,
      serverSessionId: this.config.serverSession.id
    });

    let engineSession = await this.engineSessionInfo;

    await forceSync({ engineSessionId: engineSession.id });

    let details = err?.details ?? err?.extra ?? err.message ?? err;

    Sentry.captureException(err, {
      extra: {
        details,

        serverSessionId: this.config.serverSession.id,
        instanceId: this.config.instance.id,
        engineSessionId: engineSession.id
      }
    });

    if (typeof details == 'string') {
      if (details.includes('failed to start server')) {
        throw new ServiceError(
          internalServerError({
            reason: 'mtengine/run_error',
            description: `Metorial Engine was able to connect to the server.`
          })
        );
      }

      if (details.includes('failed to process MCP message')) {
        throw new ServiceError(
          internalServerError({
            reason: 'mtengine/mcp_processing_failed',
            description: `Metorial Engine received a server error while processing the MCP message.`
          })
        );
      }

      if (details.includes('timeout')) {
        throw new ServiceError(
          internalServerError({
            reason: 'mtengine/timeout',
            description: `Metorial Engine timed out while waiting for a response from the server.`
          })
        );
      }
    }

    // Need to throw the raw error to ensure
    // that other errors can be handled by the
    // engine session manager
    throw err;
  }

  private async handleMcpError(err: McpError) {
    // Noop for now. The error will be picked up the the sync job in the background
  }

  private async handleMcpOutput(err: McpOutput) {
    // Noop for now. The output/event will be picked up the the sync job in the background
  }

  private getRunIdFromSessionEvent(evt: SessionEvent) {
    if (evt.infoRun?.run) return evt.infoRun.run.id;
    if (evt.startRun?.run) return evt.startRun.run.id;
    if (evt.stopRun?.run) return evt.stopRun.run.id;

    return null;
  }

  private async handleSessionEvent(evt: SessionEvent) {
    (async () => {
      if (evt.infoRun?.run) {
        let currentRun = evt.infoRun.run;
        await this.upsertEngineRun(currentRun);
      }

      if (evt.startRun?.run) {
        let currentRun = evt.startRun.run;
        await this.upsertEngineRun(currentRun);
      }

      if (evt.stopRun?.run) {
        let currentRun = evt.stopRun.run;
        await this.upsertEngineRun(currentRun);
        await addRunSync({ engineRunId: currentRun.id });
      }

      if (evt.infoSession?.session) {
        this.engineSessionManager.setEngineSession(evt.infoSession.session);
        await this.updateEngineSession(evt.infoSession.session);
      }
    })().catch(e => Sentry.captureException(e));
  }

  private async upsertMessageFromEngineMessage(msg: EngineMcpMessage) {
    try {
      await createSessionMessage({
        message: msg,
        serverSession: this.config.serverSession,
        instance: this.config.instance
      });
    } catch (err: any) {
      if (err.code != 'P2002') throw err;
    }
  }

  private async updateEngineSession(ses: EngineSession) {
    await db.engineSession.updateMany({
      where: { id: ses.id },
      data: {
        serverSessionOid: this.config.serverSession.oid,
        type: getEngineSessionType(ses),
        createdAt: new Date(ses.createdAt.toNumber())
      }
    });

    let clientInfo = ses.mcpClient?.participantJson
      ? (JSON.parse(ses.mcpClient.participantJson) as McpClient)
      : null;
    let serverInfo = ses.mcpServer?.participantJson
      ? (JSON.parse(ses.mcpServer.participantJson) as McpServer)
      : null;

    await db.serverSession.updateMany({
      where: { oid: this.config.serverSession.oid },
      data: {
        clientInfo: clientInfo?.clientInfo,
        clientCapabilities: clientInfo?.capabilities,

        serverInfo: serverInfo?.serverInfo,
        serverCapabilities: serverInfo?.capabilities
      }
    });
  }

  #lastSeenRunId: string | null = null;
  private async upsertEngineRun(run: EngineSessionRun) {
    if (this.#lastSeenRunId == run.id) return;

    return sessionLock.usingLock(this.config.serverSession.id, async () => {
      let lastRunId = this.#lastSeenRunId;

      this.#lastSeenRunId = run.id;

      let existingRun = await db.engineRun.findUnique({
        where: { id: run.id }
      });
      if (existingRun) return existingRun;

      if (lastRunId) await addRunSync({ engineRunId: lastRunId });

      try {
        let { serverRun } = await createEngineRun({
          run,
          serverSession: this.config.serverSession,
          version: this.engineSessionManager.serverVersion,
          instance: this.config.instance
        });

        this.#serverRun = serverRun;
      } catch (err: any) {
        if (err.code != 'P2002') throw err;

        // If the run already exists, we just return it
        return db.engineRun.findUnique({
          where: { id: run.id }
        })!;
      }
    });
  }
}

for (let activeSession of activeSessions.values()) {
  if (EngineSessionConnectionInternal.canClose(activeSession)) {
    activeSession.close();
  }
}
