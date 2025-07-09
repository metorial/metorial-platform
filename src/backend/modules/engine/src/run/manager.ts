import {
  db,
  ID,
  Instance,
  Organization,
  ServerDeployment,
  ServerImplementation,
  ServerSession,
  ServerVariant,
  ServerVersion
} from '@metorial/db';
import { internalServerError, ServiceError } from '@metorial/error';
import { Fabric } from '@metorial/fabric';
import { generateCustomId } from '@metorial/id';
import { createLock } from '@metorial/lock';
import {
  CreateSessionResponse,
  EngineRunStatus,
  EngineRunType,
  EngineSession,
  EngineSessionRun,
  EngineSessionType,
  McpManagerClient,
  McpMessageType,
  McpParticipant_ParticipantType
} from '@metorial/mcp-engine-generated';
import { secretService } from '@metorial/module-secret';
import { InitializeRequest } from '@modelcontextprotocol/sdk/types';
import { getClientByHash } from './client';
import { getSessionConfig } from './config';
import { engineMcpMessageFromPb } from './mcp/message';
import { MCPMessageType, messageTypeToPb } from './mcp/types';
import { getFullServerSession } from './utils';

type McpClient = InitializeRequest['params'];

export interface EngineRunConfig {
  serverSession: ServerSession & {
    serverDeployment: ServerDeployment;
  };
  instance: Instance & {
    organization: Organization;
  };
}

let activeSessions = new Map<string, EngineSessionInstance>();

let sessionLock = createLock({
  name: 'eng/eses'
});

export class EngineSessionInstance {
  #lastInteraction: Date = new Date();

  constructor(
    private readonly config: EngineRunConfig,
    private readonly engineSessionInfo: CreateSessionResponse,
    private readonly client: McpManagerClient,
    private readonly version: ServerVersion,
    private readonly variant: ServerVariant,
    private readonly deployment: ServerDeployment,
    private readonly implementation: ServerImplementation
  ) {
    activeSessions.set(config.serverSession.id, this);
  }

  static async create(config: EngineRunConfig): Promise<EngineSessionInstance | null> {
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

    let engineSessionTracer = generateCustomId('eng_trac_');

    let DANGEROUSLY_UNENCRYPTED_CONFIG = await secretService.DANGEROUSLY_readSecretValue({
      secretId: deployment.config.configSecretOid,
      instance: config.instance,
      type: 'server_deployment_config',
      metadata: { serverSessionId: srvSes.id, engineSessionTracer }
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

    let engineSession = await client.createSession({
      metadata: {
        serverSessionId: srvSes.id,
        instanceId: config.instance.id
      },
      mcpClient: {
        type: McpParticipant_ParticipantType.client,
        participantJson: JSON.stringify({
          protocolVersion: srvSes.mcpVersion,
          capabilities: srvSes.clientCapabilities,
          clientInfo: srvSes.clientInfo
        } satisfies McpClient)
      },
      config: await getSessionConfig(srvSes, DANGEROUSLY_UNENCRYPTED_CONFIG),
      sessionId: srvSes.id
    });

    let ses = await db.engineSession.create({
      data: {
        id: engineSession.session!.id,
        serverSessionOid: srvSes.oid,
        type: getEngineSessionType(engineSession.session!)
      }
    });

    await Fabric.fire('server.engine_session.created:after', {
      organization: config.instance.organization,
      instance: config.instance,
      serverSession: srvSes,
      engineSession: ses
    });

    return new EngineSessionInstance(
      config,
      engineSession,
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
    let stream = this.client.streamMcpMessages({
      sessionId: this.engineSessionInfo.sessionId,

      replayAfterUuid: i.replayAfterUuid as string,
      onlyIds: i.onlyIds as string[],
      onlyMessageTypes: i.onlyMessageTypes?.map(t =>
        messageTypeToPb(t)
      ) as any as McpMessageType[]
    });

    let touchIv = setInterval(() => {
      this.touch();
    }, 1000 * 30);

    try {
      for await (let message of stream) {
        if (message.mcpMessage) {
          // TODO: store messages in the database
          yield engineMcpMessageFromPb(message.mcpMessage);
        }

        if (message.sessionEvent) {
          if (message.sessionEvent.infoRun) {
            this.upsertEngineRun(message.sessionEvent.infoRun.run!);
          }

          if (message.sessionEvent.startRun) {
            this.upsertEngineRun(message.sessionEvent.startRun.run!);
          }

          if (message.sessionEvent.stopRun) {
            this.upsertEngineRun(message.sessionEvent.stopRun.run!);
          }

          if (message.sessionEvent.infoSession) {
            this.updateEngineSession(message.sessionEvent.infoSession.session!);
          }
        }

        if (message.mcpError) {
          // TODO: store errors in the database
        }

        if (message.mcpOutput) {
          // TODO: store session events in the database
        }
      }
    } finally {
      clearInterval(touchIv);
    }
  }

  private touch() {
    this.#lastInteraction = new Date();
  }

  private async updateEngineSession(ses: EngineSession) {
    await db.engineSession.update({
      where: { id: ses.id },
      data: {
        serverSessionOid: this.config.serverSession.oid,
        type: getEngineSessionType(ses)
      }
    });
  }

  private async upsertEngineRun(run: EngineSessionRun) {
    return sessionLock.usingLock(this.config.serverSession.id, async () => {
      let existingRun = await db.engineRun.findUnique({
        where: { id: run.id }
      });
      if (existingRun) return existingRun;

      await db.engineRun.create({
        data: {
          id: run.id,
          type: getEngineRunType(run),
          hasEnded: run.status != EngineRunStatus.run_status_active
        }
      });

      await Fabric.fire('server.server_run.created:before', {
        organization: this.config.instance.organization,
        instance: this.config.instance
      });

      let serverRun = await db.serverRun.create({
        data: {
          id: await ID.generateId('serverRun'),
          status: 'active',
          type: this.version.sourceType == 'remote' ? 'external' : 'hosted',
          serverVersionOid: this.version.oid,
          serverDeploymentOid: this.deployment.oid,
          instanceOid: this.config.instance.oid,
          serverSessionOid: this.config.serverSession.oid,
          engineRunId: run.id
        }
      });

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
