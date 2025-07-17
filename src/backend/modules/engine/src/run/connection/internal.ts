import {
  db,
  ID,
  ServerDeployment,
  ServerImplementation,
  ServerRun,
  ServerVariant,
  ServerVersion
} from '@metorial/db';
import { debug } from '@metorial/debug';
import { internalServerError, ServiceError } from '@metorial/error';
import { Fabric } from '@metorial/fabric';
import { generatePlainId } from '@metorial/id';
import { createLock } from '@metorial/lock';
import {
  CreateSessionResponse,
  EngineRunStatus,
  EngineSession,
  EngineSessionRun,
  McpError,
  McpManagerClient,
  McpOutput,
  McpParticipant_ParticipantType,
  SessionEvent
} from '@metorial/mcp-engine-generated';
import { secretService } from '@metorial/module-secret';
import { getSentry } from '@metorial/sentry';
import { getUnifiedIdIfNeeded, UnifiedID } from '@metorial/unified-id';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { addServerDeploymentDiscovery } from '../../queues/discoverServer';
import { addRunSync } from '../../queues/syncRuns';
import { getClientByHash } from '../client';
import { getSessionConfig } from '../config';
import { createSessionMessage } from '../data/message';
import {
  EngineMcpMessage,
  engineMcpMessageFromPb,
  engineMcpMessageToPbRaw,
  fromJSONRPCMessage
} from '../mcp/message';
import { MCPMessageType, messageTypeToPb } from '../mcp/types';
import { forceSync } from '../sync/force';
import { getFullServerSession } from '../utils';
import { EngineSessionConnectionBase } from './base';
import { EngineSessionProxy } from './proxy';
import { EngineRunConfig, McpClient } from './types';
import { getEngineRunType, getEngineSessionType } from './util';

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

  constructor(
    private readonly config: EngineRunConfig,
    private readonly engineSessionInfo: CreateSessionResponse,
    private readonly client: McpManagerClient,
    private readonly version: ServerVersion,
    private readonly variant: ServerVariant,
    private readonly deployment: ServerDeployment,
    private readonly implementation: ServerImplementation
  ) {
    super();

    this.#unifiedId = new UnifiedID(this.config.serverSession.id);

    activeSessions.set(config.serverSession.id, this);
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

    let srvSes = await getFullServerSession(config.serverSession);
    if (!srvSes) return null;

    // if (!srvSes.mcpVersion || !srvSes.clientCapabilities || !srvSes.clientInfo) {
    //   throw new Error(
    //     'WTF - Engine Session instance created before client sent MCP initialization'
    //   );
    // }

    let deployment = srvSes.serverDeployment;
    let implementation = deployment.serverImplementation;
    let variant = deployment.serverVariant;

    let version = variant.currentVersion;
    if (!version) return null;

    await Fabric.fire('server.engine_session.created:before', {
      organization: config.instance.organization,
      instance: config.instance,
      serverSession: srvSes
    });

    let client = getClientByHash(variant.identifier);
    if (!client) {
      throw new ServiceError(
        internalServerError({
          message: 'Metorial is unable to run this MCP server. Please contact support.',
          reason: 'mtengine/no_manager'
        })
      );
    }

    let active = await client.checkActiveSession({
      sessionId: srvSes.id
    });

    if (!active.isActive) {
      let engineSessionTracer = generatePlainId(15);

      let { secret, data: DANGEROUSLY_UNENCRYPTED_CONFIG } =
        await secretService.DANGEROUSLY_readSecretValue({
          secretId: deployment.config.configSecretOid,
          instance: config.instance,
          type: 'server_deployment_config',
          metadata: { serverSessionId: srvSes.id, engineSessionTracer }
        });

      let engineSession = await client.createSession({
        metadata: {
          serverSessionId: srvSes.id,
          instanceId: config.instance.id,
          engineSessionTracer
        },
        mcpClient: srvSes.clientCapabilities
          ? {
              type: McpParticipant_ParticipantType.client,
              participantJson: JSON.stringify({
                protocolVersion: srvSes.mcpVersion!,
                capabilities: srvSes.clientCapabilities!,
                clientInfo: srvSes.clientInfo!
              } satisfies McpClient)
            }
          : undefined,
        config: await getSessionConfig(
          srvSes.serverDeployment,
          DANGEROUSLY_UNENCRYPTED_CONFIG
        ),
        sessionId: srvSes.id
      });

      let ses = await db.engineSession.upsert({
        where: { id: engineSession.session!.id },
        update: {},
        create: {
          id: engineSession.session!.id,
          serverSessionOid: srvSes.oid,
          type: getEngineSessionType(engineSession.session!),
          lastSyncAt: new Date(0),
          createdAt: new Date(engineSession.session!.createdAt.toNumber())
        }
      });

      await Fabric.fire('server.engine_session.created:after', {
        organization: config.instance.organization,
        instance: config.instance,
        serverSession: srvSes,
        engineSession: ses
      });

      if (!srvSes.serverDeployment.serverVariant.lastDiscoveredAt) {
        await addServerDeploymentDiscovery({
          serverDeploymentId: srvSes.serverDeployment.id,
          delay: 1000 * 5 // 5 seconds
        });
      }

      return new EngineSessionConnectionInternal(
        config,
        engineSession,
        client,
        version,
        variant,
        deployment,
        implementation
      );
    }

    return new EngineSessionConnectionInternal(
      config,
      active,
      client,
      version,
      variant,
      deployment,
      implementation
    );
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

    let stream = this.client.streamMcpMessages(
      {
        sessionId: this.engineSessionInfo.sessionId,

        replayAfterUuid: i.replayAfterUuid,
        onlyIds: i.onlyIds ?? [],
        onlyMessageTypes: (i.onlyMessageTypes ?? []).map(t => messageTypeToPb(t))
      },
      {
        signal: AbortSignal.any([this.#abort.signal, i.signal])
      }
    );

    let currentRun: EngineSessionRun | undefined;

    let touchIv = setInterval(() => {
      this.touch();
    }, 1000 * 15);

    try {
      for await (let message of stream) {
        if (message.mcpMessage) {
          let msg = engineMcpMessageFromPb(
            message.mcpMessage,
            {
              type: 'server',
              id: currentRun?.id ?? this.config.serverSession.id
            },
            this.#unifiedId
          );

          yield {
            ...msg,
            message: {
              ...msg.message,
              id: getUnifiedIdIfNeeded('client', msg)!
            }
          };

          this.upsertMessageFromEngineMessage(msg).catch(err => Sentry.captureException(err));
        }

        if (message.sessionEvent) {
          let { currentRun: run } = await this.handleSessionEvent(message.sessionEvent);
          if (run) currentRun = run;
        }

        if (message.mcpError) {
          this.handleMcpError(message.mcpError).catch(err => Sentry.captureException(err));
        }

        if (message.mcpOutput) {
          this.handleMcpOutput(message.mcpOutput).catch(err => Sentry.captureException(err));
        }
      }
    } catch (err: any) {
      await this.handleGrpcError(err);
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

    try {
      let messages = raw.map(msg =>
        fromJSONRPCMessage(
          msg,
          {
            type: 'client',
            id: `mccl_${this.config.serverSession.oid.toString(36)}`
          },
          this.#unifiedId
        )
      );

      for (let msg of messages) {
        this.upsertMessageFromEngineMessage(msg).catch(err => Sentry.captureException(err));
      }

      let stream = this.client.sendMcpMessage(
        {
          sessionId: this.engineSessionInfo.sessionId,
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
          signal: AbortSignal.any([this.#abort.signal, opts.signal])
        }
      );

      let invocationId =
        this.config.serverSession.id.slice(-10) + Date.now().toString(36) + generatePlainId(5);

      for await (let message of stream) {
        if (message.mcpMessage) {
          let msg = engineMcpMessageFromPb(
            message.mcpMessage,
            {
              type: 'server',
              id: invocationId
            },
            this.#unifiedId
          );

          yield {
            ...msg,
            message: {
              ...msg.message,
              id: getUnifiedIdIfNeeded('client', msg)!
            }
          };

          this.upsertMessageFromEngineMessage(msg).catch(err => Sentry.captureException(err));
        }

        if (message.sessionEvent) {
          await this.handleSessionEvent(message.sessionEvent);
        }

        if (message.mcpError) {
          this.handleMcpError(message.mcpError).catch(err => Sentry.captureException(err));
        }
      }
    } catch (err: any) {
      await this.handleGrpcError(err);
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

    await forceSync({ engineSessionId: this.engineSessionInfo.session!.id });

    let details = err?.details ?? err?.extra ?? err;

    Sentry.captureException(err, {
      extra: {
        details,

        serverSessionId: this.config.serverSession.id,
        instanceId: this.config.instance.id,
        engineSessionId: this.engineSessionInfo.session?.id
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
    }

    throw new ServiceError(
      internalServerError({
        reason: 'mtengine/session_error'
      })
    );
  }

  private async handleMcpError(err: McpError) {
    // Noop for now. The error will be picked up the the sync job in the background
  }

  private async handleMcpOutput(err: McpOutput) {
    // Noop for now. The output/event will be picked up the the sync job in the background
  }

  private async handleSessionEvent(evt: SessionEvent) {
    let currentRun: EngineSessionRun | undefined;

    if (evt.infoRun?.run) {
      currentRun = evt.infoRun.run!;
      await this.upsertEngineRun(currentRun);
    }

    if (evt.startRun?.run) {
      currentRun = evt.startRun.run!;
      await this.upsertEngineRun(currentRun);
    }

    if (evt.stopRun?.run) {
      currentRun = evt.stopRun.run!;
      await this.upsertEngineRun(currentRun);
      await addRunSync({ engineRunId: currentRun.id });
    }

    if (evt.infoSession?.session) {
      await this.updateEngineSession(evt.infoSession.session!);
    }

    return { currentRun };
  }

  private async upsertMessageFromEngineMessage(msg: EngineMcpMessage) {
    try {
      await createSessionMessage({
        message: msg,
        serverSession: this.config.serverSession
      });
    } catch (err: any) {
      if (err.code != 'P2002') throw err;
    }
  }

  private async updateEngineSession(ses: EngineSession) {
    await db.engineSession.update({
      where: { id: ses.id },
      data: {
        serverSessionOid: this.config.serverSession.oid,
        type: getEngineSessionType(ses),
        createdAt: new Date(ses.createdAt.toNumber())
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
        await db.engineRun.create({
          data: {
            id: run.id,
            type: getEngineRunType(run),
            hasEnded: run.status != EngineRunStatus.run_status_active,
            lastSyncAt: new Date(0),
            createdAt: new Date(run.createdAt.toNumber()),
            serverSessionOid: this.config.serverSession.oid,
            engineSessionId: this.engineSessionInfo.session!.id
          }
        });

        await Fabric.fire('server.server_run.created:before', {
          organization: this.config.instance.organization,
          instance: this.config.instance
        });

        let serverRun = await db.serverRun.create({
          data: {
            id: ID.normalizeUUID('serverRun', run.id),
            status: 'active',
            type: this.version.sourceType == 'remote' ? 'external' : 'hosted',
            serverVersionOid: this.version.oid,
            serverDeploymentOid: this.deployment.oid,
            instanceOid: this.config.instance.oid,
            serverSessionOid: this.config.serverSession.oid,
            engineRunId: run.id
          }
        });
        this.#serverRun = serverRun;

        await Fabric.fire('server.server_run.created:after', {
          serverRun,
          organization: this.config.instance.organization,
          instance: this.config.instance
        });
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
