import { db } from '@metorial/db';
import { internalServerError, ServiceError } from '@metorial/error';
import { Fabric } from '@metorial/fabric';
import { generatePlainId } from '@metorial/id';
import {
  EngineSession,
  McpManagerClient,
  McpParticipant_ParticipantType
} from '@metorial/mcp-engine-generated';
import { McpClient, McpServer } from '@metorial/mcp-utils';
import { secretService } from '@metorial/module-secret';
import { getSentry } from '@metorial/sentry';
import { addServerDeploymentDiscovery } from '../../queues/discoverServer';
import { getClientByHash, ManagerClient, mustGetClient } from '../client';
import { getSessionConfig } from '../config';
import { FullServerSession, getFullServerSession } from '../utils';
import { EngineRunConfig } from './types';
import { getEngineSessionType } from './util';

let Sentry = getSentry();

let createEngineSession = async (
  config: EngineRunConfig & {
    client: ManagerClient;
    serverSession: FullServerSession;
    mcpClient?: McpClient;
  }
) => {
  let srvSes = config.serverSession;
  let deployment = srvSes.serverDeployment;
  let client = config.client;

  let active = await client.checkActiveSession({
    sessionId: srvSes.id
  });

  if (!active.isActive) {
    let engineSessionTracer = generatePlainId(15);

    let { data: DANGEROUSLY_UNENCRYPTED_CONFIG } =
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
      mcpClient:
        srvSes.clientCapabilities || config.mcpClient
          ? {
              type: McpParticipant_ParticipantType.client,
              participantJson: JSON.stringify(
                config.mcpClient ??
                  ({
                    protocolVersion: srvSes.mcpVersion!,
                    capabilities: srvSes.clientCapabilities!,
                    clientInfo: srvSes.clientInfo!
                  } satisfies McpClient)
              )
            }
          : undefined,
      config: await getSessionConfig(srvSes.serverDeployment, DANGEROUSLY_UNENCRYPTED_CONFIG),
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

    return engineSession.session;
  }

  return active.session;
};

export type EngineSessionManagerContext = {
  setEngineSession: (engineSession: EngineSession) => void;
};

export class EngineSessionManager {
  #engineSessionPromise: Promise<EngineSession> | null = null;
  #mcpClient: McpClient | undefined;

  private constructor(
    public readonly config: EngineRunConfig,
    private engineSessionCurrent: EngineSession,
    private readonly client: McpManagerClient,
    private srvSes: NonNullable<FullServerSession>
  ) {}

  get engineSession() {
    if (this.#engineSessionPromise) return this.#engineSessionPromise;
    return Promise.resolve(this.engineSessionCurrent);
  }

  get serverSession() {
    return this.srvSes;
  }

  get serverDeployment() {
    return this.serverSession?.serverDeployment;
  }

  get serverVariant() {
    return this.serverSession?.serverDeployment.serverVariant;
  }

  get serverVersion() {
    return this.serverSession?.serverDeployment.serverVariant.currentVersion!;
  }

  get serverImplementation() {
    return this.serverSession?.serverDeployment.serverImplementation;
  }

  static async create(config: EngineRunConfig): Promise<EngineSessionManager | null> {
    let srvSes = await getFullServerSession(config.serverSession);
    if (!srvSes) return null;

    let deployment = srvSes.serverDeployment;
    let variant = deployment.serverVariant;
    let version = variant.currentVersion;
    if (!version || variant.status != 'active') return null;

    await Fabric.fire('server.engine_session.created:before', {
      organization: config.instance.organization,
      instance: config.instance,
      serverSession: config.serverSession
    });

    let client = await mustGetClient(() => getClientByHash(variant.identifier));
    if (!client) {
      throw new ServiceError(
        internalServerError({
          message: 'Metorial is unable to run this MCP server. Please contact support.',
          reason: 'mtengine/no_manager'
        })
      );
    }

    let engineSession = await createEngineSession({
      ...config,
      client,
      serverSession: srvSes
    });
    if (!engineSession) return null;

    return new EngineSessionManager(config, engineSession, client, srvSes);
  }

  private get context(): EngineSessionManagerContext {
    let self = this;

    return {
      setEngineSession: (engineSession: EngineSession) =>
        self.updateEngineSession(engineSession)
    };
  }

  async updateEngineSession(engineSession: EngineSession) {
    this.engineSessionCurrent = engineSession;

    if (engineSession.mcpClient?.participantJson) {
      this.#mcpClient = JSON.parse(engineSession.mcpClient.participantJson);
    }

    await db.engineSession.updateMany({
      where: { id: engineSession.id },
      data: {
        serverSessionOid: this.config.serverSession.oid,
        type: getEngineSessionType(engineSession),
        createdAt: new Date(engineSession.createdAt.toNumber())
      }
    });

    let clientInfo = engineSession.mcpClient?.participantJson
      ? (JSON.parse(engineSession.mcpClient.participantJson) as McpClient)
      : null;
    let serverInfo = engineSession.mcpServer?.participantJson
      ? (JSON.parse(engineSession.mcpServer.participantJson) as McpServer)
      : null;

    if (clientInfo || serverInfo) {
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
  }

  async withClient<T>(
    provider: (
      client: McpManagerClient,
      engineSession: EngineSession,
      ctx: EngineSessionManagerContext
    ) => Promise<T>,
    engineSession: EngineSession = this.engineSessionCurrent
  ): Promise<T> {
    try {
      return await provider(this.client, engineSession, this.context);
    } catch (err: any) {
      let engineSession = await this.handleError(err);
      return this.withClient(provider, engineSession);
    }
  }

  async *withClientGenerator<T>(
    provider: (
      client: McpManagerClient,
      engineSession: EngineSession,
      ctx: EngineSessionManagerContext
    ) => AsyncGenerator<T>,
    engineSession: EngineSession = this.engineSessionCurrent
  ): AsyncGenerator<T> {
    try {
      yield* provider(this.client, engineSession, this.context);
    } catch (err: any) {
      let engineSession = await this.handleError(err);
      yield* this.withClientGenerator(provider, engineSession);
    }
  }

  private async handleError(err: any) {
    if (
      err.message.includes('session not found') ||
      err.details?.includes?.('session not found')
    ) {
      if (this.#engineSessionPromise) {
        return this.#engineSessionPromise;
      }

      this.#engineSessionPromise = (async () => {
        // Get the most recent server session
        let currentServerSession = await db.serverSession.findUnique({
          where: { id: this.srvSes.id }
        });

        let engineSession = await createEngineSession({
          ...this.config,
          client: this.client,
          serverSession: this.srvSes,
          mcpClient: currentServerSession?.clientInfo
            ? ({
                clientInfo: currentServerSession.clientInfo,
                capabilities: currentServerSession.clientCapabilities,
                protocolVersion: currentServerSession.mcpVersion
              } as McpClient)
            : this.#mcpClient
        });

        if (!engineSession) {
          throw new ServiceError(
            internalServerError({
              message: 'Metorial is unable to run this MCP server. Please contact support.',
              reason: 'mtengine/no_session'
            })
          );
        }

        this.engineSessionCurrent = engineSession;

        setTimeout(() => {
          this.#engineSessionPromise = null;
        });

        return engineSession;
      })();

      return this.#engineSessionPromise;
    }

    Sentry.captureException(err, {
      tags: {
        type: 'engine_session_manager'
      },
      extra: {
        serverSessionId: this.srvSes.id,
        engineSessionId: this.engineSessionCurrent.id
      }
    });

    throw new ServiceError(
      internalServerError({
        reason: 'mtengine/session_error'
      })
    );
  }
}
