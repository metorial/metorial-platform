import {
  db,
  ID,
  Instance,
  Organization,
  ServerDeployment,
  ServerImplementation,
  ServerRun,
  ServerSession,
  ServerVariant,
  ServerVersion
} from '@metorial/db';
import { internalServerError, ServiceError } from '@metorial/error';
import { Fabric } from '@metorial/fabric';
import { generatePlainId } from '@metorial/id';
import { createLock } from '@metorial/lock';
import {
  CreateSessionResponse,
  EngineRunStatus,
  EngineRunType,
  EngineSession,
  EngineSessionRun,
  EngineSessionType,
  McpError,
  McpManagerClient,
  McpMessageType,
  McpOutput,
  McpParticipant_ParticipantType,
  SessionEvent
} from '@metorial/mcp-engine-generated';
import { secretService } from '@metorial/module-secret';
import { getSentry } from '@metorial/sentry';
import { UnifiedID } from '@metorial/unified-id';
import { InitializeRequest, JSONRPCMessage } from '@modelcontextprotocol/sdk/types';
import { addRunSync } from '../queues/syncRuns';
import { getClientByHash } from './client';
import { getSessionConfig } from './config';
import { createSessionMessage } from './data/message';
import {
  EngineMcpMessage,
  engineMcpMessageFromPb,
  engineMcpMessageToPbRaw,
  fromJSONRPCMessage
} from './mcp/message';
import { MCPMessageType, messageTypeToPb } from './mcp/types';
import { forceSync } from './sync/force';
import { getFullServerSession } from './utils';

const INACTIVITY_TIMEOUT = 1000 * 60;

type McpClient = InitializeRequest['params'];

let Sentry = getSentry();

export interface EngineRunConfig {
  serverSession: ServerSession & {
    serverDeployment: ServerDeployment;
  };
  instance: Instance & {
    organization: Organization;
  };
}

let activeSessions = new Map<string, EngineSessionConnection>();

let sessionLock = createLock({
  name: 'eng/eses'
});

export class EngineSessionConnection {
  #lastInteraction: Date = new Date();
  #unifiedId: UnifiedID;
  #serverRun: ServerRun | null = null;

  constructor(
    private readonly config: EngineRunConfig,
    private readonly engineSessionInfo: CreateSessionResponse,
    private readonly client: McpManagerClient,
    private readonly version: ServerVersion,
    private readonly variant: ServerVariant,
    private readonly deployment: ServerDeployment,
    private readonly implementation: ServerImplementation
  ) {
    this.#unifiedId = new UnifiedID(this.config.serverSession.id);

    activeSessions.set(config.serverSession.id, this);
  }

  static canClose(session: EngineSessionConnection) {
    let timeSinceLastInteraction = new Date().getTime() - session.lastInteraction.getTime();
    return timeSinceLastInteraction > INACTIVITY_TIMEOUT;
  }

  static async create(config: EngineRunConfig): Promise<EngineSessionConnection | null> {
    let existing = activeSessions.get(config.serverSession.id);
    if (existing) {
      existing.touch();
      return existing;
    }

    let srvSes = await getFullServerSession(config.serverSession);
    if (!srvSes) return null;

    if (!srvSes.mcpVersion || !srvSes.clientCapabilities || !srvSes.clientInfo) {
      throw new Error(
        'WTF - Engine Session instance created before client sent MCP initialization'
      );
    }

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

    let client = getClientByHash(version.identifier);
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

    if (!active) {
      let engineSessionTracer = generatePlainId(15);

      let DANGEROUSLY_UNENCRYPTED_CONFIG = await secretService.DANGEROUSLY_readSecretValue({
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
        mcpClient: {
          type: McpParticipant_ParticipantType.client,
          participantJson: JSON.stringify({
            protocolVersion: srvSes.mcpVersion!,
            capabilities: srvSes.clientCapabilities!,
            clientInfo: srvSes.clientInfo!
          } satisfies McpClient)
        },
        config: await getSessionConfig(srvSes, DANGEROUSLY_UNENCRYPTED_CONFIG),
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

      return new EngineSessionConnection(
        config,
        engineSession,
        client,
        version,
        variant,
        deployment,
        implementation
      );
    }

    return new EngineSessionConnection(
      config,
      active,
      client,
      version,
      variant,
      deployment,
      implementation
    );
  }

  get lastInteraction() {
    return this.#lastInteraction;
  }

  async *getMcpStream(i: {
    replayAfterUuid?: string;
    onlyIds?: string[];
    onlyMessageTypes?: MCPMessageType[];
  }) {
    this.touch();

    let stream = this.client.streamMcpMessages({
      sessionId: this.engineSessionInfo.sessionId,

      replayAfterUuid: i.replayAfterUuid as string,
      onlyIds: i.onlyIds as string[],
      onlyMessageTypes: i.onlyMessageTypes?.map(t =>
        messageTypeToPb(t)
      ) as any as McpMessageType[]
    });

    let currentRun: EngineSessionRun | undefined;

    let touchIv = setInterval(() => {
      this.touch();
    }, 1000 * 15);

    try {
      for await (let message of stream) {
        if (message.mcpMessage) {
          let msg = engineMcpMessageFromPb(message.mcpMessage, {
            type: 'server',
            id: currentRun?.id ?? this.config.serverSession.id
          });

          yield msg;

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
    }
  ) {
    this.touch();
    let touchIv = setInterval(() => {
      this.touch();
    }, 1000 * 15);

    try {
      let messages = raw.map(msg =>
        fromJSONRPCMessage(msg, {
          type: 'client',
          id: this.config.serverSession.oid.toString(36)
        })
      );

      let stream = await this.client.sendMcpMessage({
        sessionId: this.engineSessionInfo.sessionId,
        mcpMessages: messages.map(m => engineMcpMessageToPbRaw(m)),
        includeResponses: !!opts.includeResponses
      });

      let invocationId =
        this.config.serverSession.id.slice(-10) + Date.now().toString(36) + generatePlainId(5);

      for await (let message of stream) {
        if (message.mcpMessage) {
          let msg = engineMcpMessageFromPb(message.mcpMessage, {
            type: 'server',
            id: invocationId
          });

          yield msg;

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
      includeResponses: false
    });

    for await (let _ of stream) {
      // Just want for the stream to finish
    }
  }

  close() {
    activeSessions.delete(this.config.serverSession.id);
  }

  #lastStoredAt = 0;
  private touch() {
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
    await forceSync({ engineSessionId: this.engineSessionInfo.session!.id });

    let details = err?.details ?? err?.extra ?? err;
    let metadata = details?.metadata ?? details;

    let code = metadata?.code ?? details?.reason ?? details?.kind ?? err?.code ?? 'unknown';
    let message = metadata?.message ?? details?.message ?? err?.message ?? 'unknown';

    Sentry.captureException(err, {
      extra: {
        code,
        message,
        metadata,

        serverSessionId: this.config.serverSession.id,
        instanceId: this.config.instance.id,
        engineSessionId: this.engineSessionInfo.session?.id
      }
    });

    if (code == 'run_error') {
      throw new ServiceError(
        internalServerError({
          reason: 'mtengine/run_error',
          description: `Metorial Engine was able to connect to the server: ${message}.`
        })
      );
    }

    if (code == 'mcp_message_processing_failed') {
      throw new ServiceError(
        internalServerError({
          reason: 'mtengine/mcp_processing_failed',
          description: `Metorial Engine received a server error while processing the MCP message: ${message}.`
        })
      );
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
        serverSession: this.config.serverSession,
        unifiedId: this.#unifiedId
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
    });
  }
}

let getEngineSessionType = (ses: EngineSession) =>
  ({
    [EngineSessionType.UNRECOGNIZED]: 'unknown' as const,
    [EngineSessionType.session_type_unknown]: 'unknown' as const,
    [EngineSessionType.session_type_container]: 'remote' as const,
    [EngineSessionType.session_type_remote]: 'container' as const
  })[ses.type] ?? 'unknown';

let getEngineRunType = (ses: EngineSessionRun) =>
  ({
    [EngineRunType.UNRECOGNIZED]: 'unknown' as const,
    [EngineRunType.run_type_unknown]: 'unknown' as const,
    [EngineRunType.run_type_container]: 'remote' as const,
    [EngineRunType.run_type_remote]: 'container' as const
  })[ses.type] ?? 'unknown';

for (let activeSession of activeSessions.values()) {
  if (EngineSessionConnection.canClose(activeSession)) {
    activeSession.close();
  }
}
