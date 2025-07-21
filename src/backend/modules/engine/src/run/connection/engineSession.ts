import { db } from '@metorial/db';
import { internalServerError, ServiceError } from '@metorial/error';
import { Fabric } from '@metorial/fabric';
import { generatePlainId } from '@metorial/id';
import {
  EngineSession,
  McpManagerClient,
  McpParticipant_ParticipantType
} from '@metorial/mcp-engine-generated';
import { secretService } from '@metorial/module-secret';
import { getSentry } from '@metorial/sentry';
import { addServerDeploymentDiscovery } from '../../queues/discoverServer';
import { getClientByHash, ManagerClient, mustGetClient } from '../client';
import { getSessionConfig } from '../config';
import { FullServerSession, getFullServerSession } from '../utils';
import { EngineRunConfig, McpClient } from './types';
import { getEngineSessionType } from './util';

let Sentry = getSentry();

let createEngineSession = async (
  config: EngineRunConfig & {
    client: ManagerClient;
    serverSession: FullServerSession;
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

export class EngineSessionManager {
  #engineSessionPromise: Promise<EngineSession> | null = null;

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
    if (!version) return null;

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

  async withClient<T>(
    provider: (client: McpManagerClient, engineSession: EngineSession) => Promise<T>,
    engineSession: EngineSession = this.engineSessionCurrent
  ): Promise<T> {
    try {
      return await provider(this.client, this.engineSessionCurrent);
    } catch (err: any) {
      let engineSession = await this.handleError(err);
      return this.withClient(provider, engineSession);
    }
  }

  async *withClientGenerator<T>(
    provider: (client: McpManagerClient, engineSession: EngineSession) => AsyncGenerator<T>,
    engineSession: EngineSession = this.engineSessionCurrent
  ): AsyncGenerator<T> {
    try {
      yield* provider(this.client, this.engineSessionCurrent);
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
        let engineSession = await createEngineSession({
          ...this.config,
          client: this.client,
          serverSession: this.srvSes
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
