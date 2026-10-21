import { delay } from '@lowerdeck/delay';
import {
  badRequestError,
  goneError,
  internalServerError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { getSentry } from '@lowerdeck/sentry';
import { serialize } from '@lowerdeck/serialize';
import { ConduitSendError } from '@metorial-subspace/conduit';
import type {
  ConduitDiagnosticsResult,
  ConduitInput,
  ConduitListToolsResult,
  ConduitResult
} from '@metorial-subspace/connection-utils';
import {
  type AgentInstance,
  db,
  type Environment,
  getId,
  ID,
  type ProviderAuthConfig,
  type ProviderAuthCredentials,
  type ProviderAuthMethod,
  type ProviderDeployment,
  type ProviderDeploymentConfigPairProviderVersion,
  type Session,
  type SessionConnection,
  type SessionConnectionMcpConnectionTransport,
  type SessionConnectionTransport,
  type SessionMessage,
  type SessionMessageFailureReason,
  type SessionParticipant,
  type SessionProvider,
  type SessionProviderInstance,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { isRecordDeleted } from '@metorial-subspace/list-utils';
import {
  agentClientService,
  agentInstanceService,
  agentService
} from '@metorial-subspace/module-agent';
import { enclaveIngressPolicyService } from '@metorial-subspace/module-enclave';
import {
  checkToolAccess,
  checkToolAuthMethodSatisfied,
  checkToolScopesSatisfied,
  providerDeploymentConfigPairInternalService,
  providerDeploymentInternalService,
  resolveGrantedScopes
} from '@metorial-subspace/module-provider-internal';
import {
  applySessionProviderNameTemplate,
  parseNameFromSessionProviderTemplates,
  sessionProviderNameTemplateService
} from '@metorial-subspace/module-session';
import { ephemeralManagedSessionService } from '@metorial-subspace/module-session/src/services/ephemeralManagedSession';
import { addDays, addHours, addMinutes, differenceInMinutes, subHours } from 'date-fns';
import { isEqual } from 'lodash';
import { recordConnectionAuditEvent } from '../audit/recordMessage';
import {
  DEFAULT_SESSION_EXPIRATION_DAYS,
  SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT,
  SESSION_PROVIDER_INSTANCE_MAX_AGE_MINUTES,
  SESSION_PROVIDER_INSTANCE_RENEWAL_THRESHOLD_MINUTES,
  SESSIONLESS_CONNECTION_MAX_AGE_HOURS,
  SESSIONLESS_CONNECTION_MAX_IDLE_HOURS,
  UNINITIALIZED_SESSION_EXPIRATION_MINUTES
} from '../const';
import { env } from '../env';
import {
  buildCallbackEventTools,
  type CallbackEventToolScope,
  isCallbackEventTool,
  resolveCallbackEventToolScope,
  runCallbackEventTool
} from '../lib/callbackEventTools';
import { conduit } from '../lib/conduit';
import {
  buildConnectionFailedDetail,
  buildConnectionFailedTool,
  CONNECTION_FAILED_TOOL_KEY,
  type ConnectionFailedProvider
} from '../lib/connectionFailedTool';
import {
  buildConnectionStatusReport,
  buildConnectionStatusTool,
  CONNECTION_STATUS_TOOL_KEY
} from '../lib/connectionStatusTool';
import { broadcastNats } from '../lib/nats';
import { listSpecificationTools } from '../lib/providerToolCache';
import {
  buildRequestScopedTool,
  METORIAL_TOOL_KEY_PREFIX,
  type RequestScopedTools,
  type RequestScopedToolsResolver
} from '../lib/requestTools';
import { isSyntheticTool } from '../lib/syntheticTool';
import {
  CONNECTION_DIAGNOSTICS_TIMEOUT_MS,
  CONNECTION_TOOL_DISCOVERY_TIMEOUT_MS
} from '../lib/timeouts';
import { topics } from '../lib/topic';
import { completeMessage } from '../shared/completeMessage';
import { createError } from '../shared/createError';
import { createMessage, type CreateMessageProps } from '../shared/createMessage';
import { createWarning } from '../shared/createWarning';
import {
  extractToolCallOperation,
  getToolCallArguments,
  withToolCallArguments
} from '../shared/toolCallOperation';
import { upsertParticipant } from '../shared/upsertParticipant';
import {
  type ConnectionScopedSpecification,
  isConnectionScopedProviderVersionOid,
  resolveConnectionScopedSpecification
} from './connectionSpecification';
import { resolveProviderToolListingSpecificationOid } from './toolSpecification';
import { getPublicMcpAccess } from '@metorial-subspace/public-mcp-guard';
import type { CallToolResult as McpCallToolResult } from '@modelcontextprotocol/sdk/types.js';

let Sentry = getSentry();

let instanceLock = createLock({
  name: 'sub/conn/sess/inst/lock',
  redisUrl: env.service.REDIS_URL
});

let connectionTokenLock = createLock({
  name: 'sub/conn/session/connectionToken/lock',
  redisUrl: env.service.REDIS_URL
});

let sessionlessConnectionLock = createLock({
  name: 'sub/conn/session/sessionless/lock',
  redisUrl: env.service.REDIS_URL
});

let providerInstanceResolutionPromises = new Map<string, Promise<any>>();

let isBuiltInSyntheticToolKey = (key: string, connectionFailedToolKeys: Set<string>) =>
  key === CONNECTION_STATUS_TOOL_KEY ||
  isCallbackEventTool(key) ||
  connectionFailedToolKeys.has(key);

type ReusableProviderInstance = SessionProviderInstance & {
  pairVersion: ProviderDeploymentConfigPairProviderVersion;
};

let sender = conduit.createSender({
  defaultTimeout: 10_000,
  maxRetries: 10
});

export interface InitProps {
  client: {
    identifier: string;
    name: string;
    [key: string]: any;
  };
  mcpCapabilities?: Record<string, any>;
  mcpProtocolVersion?: string;
  mcpTransport: SessionConnectionMcpConnectionTransport;
  agentInstance?: AgentInstance | null;
  systemIdentifier?: string;
  allowReservedClientIdentifier?: boolean;
  mcpClientKey?: string;
  expiresAt?: Date;
}

export interface SessionlessConnectionProps {
  clientKey: string;
  client: InitProps['client'];
  mcpCapabilities: Record<string, any>;
  mcpProtocolVersion: string;
}

export interface CallToolProps {
  toolId: string;
  input: PrismaJson.SessionMessageInput;
  waitForResponse: boolean;
  transport: SessionConnectionTransport;
  rationale?: string;
  operation?: string;
  clientMcpId?: PrismaJson.SessionMessageClientMcpId;
  parentMessage?: SessionMessage;
}

type CallToolResult = Omit<ConduitResult, 'message'> & {
  message: SessionMessage;
  processingPromise?: Promise<void>;
};

type SyntheticCallOutcome = {
  status: 'succeeded' | 'failed';
  output: PrismaJson.SessionMessageOutput;
  failureReason?: SessionMessageFailureReason;
  stored?: {
    input: PrismaJson.SessionMessageInput;
    output: PrismaJson.SessionMessageOutput;
  };
};

export interface SenderMangerProps {
  sessionId: string;
  solutionId: string;
  tenantId: string;
  connectionToken?: string;
  transport: SessionConnectionTransport;
  agentClient?:
    | {
        name: string;
        type: 'mcp_client_oauth';
        privateMetadata?: Record<string, any>;
        foreignId: string;
        oauthRegistrationId: string;
      }
    | {
        name: string;
        type: 'system_client';
        privateMetadata?: Record<string, any>;
        foreignId: string;
      };
  connectionPrivateMetadata?: Record<string, any>;
  requestTools?: RequestScopedToolsResolver;
  adapter?: { identifier: string };
  ingressPolicyCheck?: {
    sourceIp: string;
    hostname?: string;
    port?: number;
    recordLog?: boolean;
  };
}

export class SenderManager {
  readonly sender = sender;

  private constructor(
    readonly session: Session,
    public connection:
      | (SessionConnection & { participant?: SessionParticipant | null })
      | undefined,
    readonly tenant: Tenant,
    readonly solution: Solution,
    readonly transport: SessionConnectionTransport,
    readonly agentClient: SenderMangerProps['agentClient'],
    readonly connectionPrivateMetadata: SenderMangerProps['connectionPrivateMetadata'],
    private readonly requestToolsResolver?: RequestScopedToolsResolver
  ) {}

  // Public MCP sessions are only reachable through the grant that currently owns them.
  private static async assertPublicMcpSessionAccess(session: {
    oid: bigint;
    ownerPublicMcpServerOid: bigint | null;
  }) {
    if (!session.ownerPublicMcpServerOid) return;

    let access = getPublicMcpAccess();
    if (!access?.grantOid || access.publicMcpServerOid !== session.ownerPublicMcpServerOid) {
      throw new ServiceError(notFoundError('session'));
    }

    let grant = await db.publicMcpServerGrant.findUnique({
      where: { oid: access.grantOid },
      select: { status: true, currentSessionOid: true, publicMcpServerOid: true }
    });
    if (
      !grant ||
      grant.status !== 'active' ||
      grant.publicMcpServerOid !== session.ownerPublicMcpServerOid ||
      grant.currentSessionOid !== session.oid
    ) {
      throw new ServiceError(notFoundError('session'));
    }
  }

  private static async resolveSession(d: SenderMangerProps) {
    if (d.connectionToken) {
      let loadConnection = async () =>
        await db.sessionConnection.findFirst({
          where: {
            token: d.connectionToken,
            tenant: { OR: [{ id: d.tenantId }, { identifier: d.tenantId }] },
            solution: { OR: [{ id: d.solutionId }, { identifier: d.solutionId }] }
          },
          include: {
            session: {
              include: {
                ephemeralManagedSession: true
              }
            },
            participant: true,
            tenant: true,
            solution: true
          }
        });

      let connection = await loadConnection();

      if (connection?.session.ephemeralManagedSession) {
        let currentSession = await ephemeralManagedSessionService.resolveBackingSessionById({
          sessionId: connection.session.ephemeralManagedSession.id,
          tenantId: d.tenantId,
          solutionId: d.solutionId,
          tenantOid: connection.tenantOid,
          solutionOid: connection.solutionOid
        });

        if (currentSession && currentSession.oid !== connection.session.oid) {
          let resolvedConnection = await connectionTokenLock.usingLock(
            d.connectionToken,
            async () => {
              let lockedConnection = await loadConnection();
              if (!lockedConnection) return null;

              if (lockedConnection.session.ephemeralManagedSession) {
                let lockedCurrentSession =
                  await ephemeralManagedSessionService.resolveBackingSessionById({
                    sessionId: lockedConnection.session.ephemeralManagedSession.id,
                    tenantId: d.tenantId,
                    solutionId: d.solutionId,
                    tenantOid: lockedConnection.tenantOid,
                    solutionOid: lockedConnection.solutionOid
                  });

                if (
                  lockedCurrentSession &&
                  lockedCurrentSession.oid !== lockedConnection.session.oid
                ) {
                  let now = new Date();
                  let oldToken = lockedConnection.token;
                  let replacementToken = await ID.generateId('sessionConnection_token');

                  let currentConnection = await withTransaction(async db => {
                    await db.sessionConnection.update({
                      where: { oid: lockedConnection.oid },
                      data: {
                        token: replacementToken,
                        isReplaced: true
                      }
                    });

                    let newConnection = await db.sessionConnection.create({
                      data: {
                        ...getId('sessionConnection'),
                        token: oldToken,
                        systemIdentifier: lockedConnection.systemIdentifier,
                        isEphemeral: lockedCurrentSession.isEphemeral,
                        isInternal: lockedCurrentSession.isInternal,
                        adapterGlobalOid: lockedCurrentSession.adapterGlobalOid,
                        status: lockedConnection.status,
                        transport: lockedConnection.transport,
                        isParentDeleted: lockedConnection.isParentDeleted,
                        hasErrors: lockedConnection.hasErrors,
                        hasWarnings: lockedConnection.hasWarnings,
                        state: lockedConnection.state,
                        initState: lockedConnection.initState,
                        isManuallyDisabled: lockedConnection.isManuallyDisabled,
                        isReplaced: false,
                        isForManualToolCalls: lockedConnection.isForManualToolCalls,
                        sessionOid: lockedCurrentSession.oid,
                        participantOid: lockedConnection.participantOid,
                        tenantOid: lockedCurrentSession.tenantOid,
                        projectOid: lockedCurrentSession.projectOid,
                        environmentOid: lockedCurrentSession.environmentOid,
                        instanceOid: lockedCurrentSession.instanceOid,
                        solutionOid: lockedCurrentSession.solutionOid,
                        mcpData: lockedConnection.mcpData,
                        mcpTransport: lockedConnection.mcpTransport,
                        mcpProtocolVersion: lockedConnection.mcpProtocolVersion,
                        privateMetadata: lockedConnection.privateMetadata,
                        expiresAt:
                          lockedConnection.initState === 'pending'
                            ? addMinutes(new Date(), UNINITIALIZED_SESSION_EXPIRATION_MINUTES)
                            : addDays(new Date(), DEFAULT_SESSION_EXPIRATION_DAYS),
                        lastPingAt: now,
                        lastActiveAt: now,
                        disconnectedAt:
                          lockedConnection.state === 'connected'
                            ? null
                            : lockedConnection.disconnectedAt
                      },
                      include: { participant: true }
                    });

                    await db.session.updateMany({
                      where: { oid: lockedCurrentSession.oid },
                      data: {
                        connectionState: newConnection.state,
                        lastConnectionCreatedAt: now,
                        lastActiveAt: now
                      }
                    });

                    return newConnection;
                  });

                  return {
                    ...lockedCurrentSession,
                    connection: currentConnection
                  };
                }
              }

              return {
                ...lockedConnection.session,
                tenant: lockedConnection.tenant,
                solution: lockedConnection.solution,
                connection: lockedConnection
              };
            }
          );

          if (resolvedConnection) return resolvedConnection;

          connection = await loadConnection();
        }
      }

      if (connection) {
        return {
          ...connection.session,
          tenant: connection.tenant,
          solution: connection.solution,
          connection: connection
        };
      }
    }

    let session = await db.session.findFirst({
      where: {
        id: d.sessionId,
        tenant: { OR: [{ id: d.tenantId }, { identifier: d.tenantId }] },
        solution: { OR: [{ id: d.solutionId }, { identifier: d.solutionId }] }
      },
      include: {
        tenant: true,
        solution: true
      }
    });
    if (session) {
      return {
        ...session,
        connection: undefined
      };
    }

    let ephemeralManagedSession =
      await ephemeralManagedSessionService.resolveBackingSessionById({
        sessionId: d.sessionId,
        tenantId: d.tenantId,
        solutionId: d.solutionId
      });
    if (!ephemeralManagedSession) return null;

    return {
      ...ephemeralManagedSession,
      connection: undefined
    };
  }

  static async create(d: SenderMangerProps): Promise<SenderManager> {
    let session = await this.resolveSession(d);
    if (!session) throw new ServiceError(notFoundError('session'));
    await this.assertPublicMcpSessionAccess(session);
    if (isRecordDeleted(session)) {
      throw new ServiceError(goneError({ message: 'Session has been archived or deleted' }));
    }

    let requestedAdapter = d.adapter
      ? await db.providerAdapterGlobal.findUnique({
          where: { identifier: d.adapter.identifier }
        })
      : null;
    if (session.isInternal) {
      if (!requestedAdapter || requestedAdapter.oid !== session.adapterGlobalOid) {
        throw new ServiceError(
          badRequestError({
            code: 'internal_session_adapter_mismatch',
            message: 'The adapter supplied for this internal session is missing or incorrect.'
          })
        );
      }
    } else if (d.adapter) {
      throw new ServiceError(
        badRequestError({
          code: 'adapter_not_allowed_for_ordinary_session',
          message: 'Adapters may only be used with internal sessions.'
        })
      );
    }

    let connection = session.connection;
    if (d.connectionToken && !connection) {
      throw new ServiceError(notFoundError('connection'));
    }
    if (isRecordDeleted(connection)) {
      throw new ServiceError(
        goneError({ message: 'Connection has been archived or deleted' })
      );
    }
    if (
      connection &&
      (connection.isInternal !== session.isInternal ||
        (connection.adapterGlobalOid ?? null) !== (session.adapterGlobalOid ?? null))
    ) {
      throw new ServiceError(
        badRequestError({
          code: 'connection_adapter_scope_mismatch',
          message: 'The connection does not match the internal scope of its session.'
        })
      );
    }

    let environment: Environment | null = null;
    if (d.ingressPolicyCheck) {
      environment = await db.environment.findUniqueOrThrow({
        where: { oid: session.environmentOid }
      });

      await enclaveIngressPolicyService.assertSessionIngressAccessInternal({
        tenant: session.tenant,
        environment,
        session,
        sessionId: session.id,
        sourceIp: d.ingressPolicyCheck.sourceIp,
        hostname: d.ingressPolicyCheck.hostname,
        port: d.ingressPolicyCheck.port,
        recordLog: d.ingressPolicyCheck.recordLog
      });
    }

    if (connection) {
      if (connection.isManuallyDisabled) {
        throw new ServiceError(goneError({ message: 'Connection has been disabled' }));
      }
      if (connection.status === 'archived') {
        throw new ServiceError(goneError({ message: 'Connection has been archived' }));
      }

      if (connection.expiresAt < new Date()) {
        if (connection.mcpTransport === 'sessionless') {
          throw new ServiceError(goneError({ message: 'Connection has expired' }));
        }

        if (connection.initState === 'pending') {
          throw new ServiceError(
            badRequestError({
              message: 'Connection not initialized in time'
            })
          );
        }

        await db.sessionConnection.updateMany({
          where: { oid: connection!.oid },
          data: {
            expiresAt: addDays(new Date(), DEFAULT_SESSION_EXPIRATION_DAYS)
          }
        });
      }

      if (connection.transport !== d.transport) {
        throw new ServiceError(
          badRequestError({
            message: `Connection cannot be used with transport ${d.transport}`
          })
        );
      }

      if (connection.state === 'disconnected') {
        (async () => {
          await db.sessionConnection.updateMany({
            where: { oid: connection.oid },
            data: {
              state: 'connected',
              lastActiveAt: new Date(),
              lastPingAt: new Date(),
              disconnectedAt: null
            }
          });

          await db.session.updateMany({
            where: { oid: session.oid },
            data: {
              connectionState: 'connected',
              lastActiveAt: new Date()
            }
          });

          if (!session.isInternal) {
            await db.sessionEvent.createMany({
              data: {
                ...getId('sessionEvent'),
                type: 'connection_connected',
                sessionOid: session.oid,
                connectionOid: connection.oid,
                tenantOid: session.tenantOid,
                projectOid: session.projectOid,
                solutionOid: session.solutionOid,
                environmentOid: session.environmentOid,
                instanceOid: session.instanceOid
              }
            });
          }
        })().catch(() => {});
      }
    }

    let manager = new SenderManager(
      session,
      connection,
      session.tenant,
      session.solution,
      d.transport,
      d.agentClient,
      d.connectionPrivateMetadata,
      d.requestTools
    );
    if (environment) manager.#environmentPromise = Promise.resolve(environment);

    return manager;
  }

  #environmentPromise: Promise<Environment> | null = null;
  private getEnvironment() {
    this.#environmentPromise ??= db.environment.findUniqueOrThrow({
      where: { oid: this.session.environmentOid }
    });
    return this.#environmentPromise;
  }

  #upsertAgentClientPromise: ReturnType<typeof this.upsertAgentClientIfNeeded> | null = null;
  private async upsertAgentClientIfNeeded() {
    if (!this.agentClient) return null;

    let environment = await this.getEnvironment();

    return await agentClientService.upsertAgentClientInternal({
      tenant: this.tenant,
      environment,
      input: this.agentClient
    });
  }

  private async ensureAgentClientUpserted() {
    if (!this.agentClient) return null;
    if (this.#upsertAgentClientPromise) return await this.#upsertAgentClientPromise;

    this.#upsertAgentClientPromise = this.upsertAgentClientIfNeeded();
    return await this.#upsertAgentClientPromise;
  }

  private async ensureConnectionClientAgentContext(d: InitProps['client']) {
    let agentClientContext = await this.ensureAgentClientUpserted();

    let environment = await this.getEnvironment();

    let agent = await agentService.upsertAgentInternal({
      tenant: this.tenant,
      environment,
      input: {
        name: d.name,
        type: 'mcp_client'
      }
    });

    let agentInstance = await agentInstanceService.upsertAgentInstanceInternal({
      tenant: this.tenant,
      environment,
      agent,
      agentClient: agentClientContext?.agentClient,
      agentClientRegistration: agentClientContext?.agentClientRegistration,
      input: {
        name: d.name,
        version: typeof d.version === 'string' ? d.version : undefined,
        description: undefined,
        type: 'mcp_client'
      }
    });

    return {
      agent,
      agentClient: agentClientContext?.agentClient ?? null,
      agentClientRegistration: agentClientContext?.agentClientRegistration ?? null,
      agentInstance
    };
  }

  private async ensureConnectionParticipant() {
    if (!this.connection) return null;
    if (this.connection.participant) return this.connection.participant;

    let connection = await db.sessionConnection.findFirst({
      where: { oid: this.connection.oid },
      include: { participant: true }
    });
    if (!connection?.participant) return null;

    this.connection = Object.assign(this.connection, connection);
    return connection.participant;
  }

  #prefetchedInstances = new Map<bigint, ReusableProviderInstance | null>();

  private async prefetchProviderInstances(providers: SessionProvider[]) {
    let instances = await db.sessionProviderInstance.findMany({
      where: {
        sessionProviderOid: { in: providers.map(provider => provider.oid) },
        expiresAt: { gt: new Date() }
      },
      include: { pairVersion: true },
      orderBy: { oid: 'desc' }
    });

    for (let provider of providers) {
      let instance = instances.find(i => i.sessionProviderOid === provider.oid) ?? null;
      this.#prefetchedInstances.set(provider.oid, instance);
    }
  }

  private async findLiveProviderInstance(provider: SessionProvider) {
    if (this.#prefetchedInstances.has(provider.oid)) {
      let prefetched = this.#prefetchedInstances.get(provider.oid)!;
      this.#prefetchedInstances.delete(provider.oid);
      return prefetched;
    }

    return await db.sessionProviderInstance.findFirst({
      where: {
        sessionProviderOid: provider.oid,
        expiresAt: { gt: new Date() }
      },
      include: { pairVersion: true }
    });
  }

  private async findReusableProviderInstance(provider: SessionProvider) {
    let currentInstance = await this.findLiveProviderInstance(provider);
    if (!currentInstance) return null;

    let ageInMinutes = Math.abs(differenceInMinutes(new Date(), currentInstance.createdAt));
    if (ageInMinutes > SESSION_PROVIDER_INSTANCE_MAX_AGE_MINUTES) return null;

    let renewAfter = addMinutes(
      new Date(),
      SESSION_PROVIDER_INSTANCE_RENEWAL_THRESHOLD_MINUTES
    );
    if (currentInstance.expiresAt > renewAfter) return currentInstance;

    return await db.sessionProviderInstance.update({
      where: { oid: currentInstance.oid },
      data: {
        expiresAt: addMinutes(new Date(), SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT)
      },
      include: { pairVersion: true }
    });
  }

  private async resolveProviderInstance(provider: SessionProvider) {
    let reusableInstance = await this.findReusableProviderInstance(provider);
    if (reusableInstance) {
      return { status: 'ok' as const, instance: reusableInstance };
    }

    let fullProvider = await db.sessionProvider.findFirstOrThrow({
      where: { oid: provider.oid },
      include: {
        environment: true,
        deployment: { include: { currentVersion: true } },
        config: { include: { currentVersion: true } },
        authConfig: { include: { currentVersion: true } },
        provider: { include: { defaultVariant: { include: { currentVersion: true } } } }
      }
    });

    let dependencyIsDeleted =
      isRecordDeleted(fullProvider.deployment) ||
      isRecordDeleted(fullProvider.config) ||
      isRecordDeleted(fullProvider.authConfig);
    if (dependencyIsDeleted) {
      await db.sessionProvider.updateMany({
        where: { oid: provider.oid },
        data: { status: 'archived' }
      });
      return null;
    }

    let version = await providerDeploymentInternalService.getCurrentVersion({
      environment: fullProvider.environment,
      deployment: fullProvider.deployment,
      provider: fullProvider.provider
    });
    if (!version?.specificationOid) {
      let discoveryError = {
        type: 'connection_error' as const,
        error: {
          code: version ? 'specification_unavailable' : 'version_unavailable',
          message: version
            ? 'The provider version has no discovered specification yet'
            : 'The provider has no usable version'
        }
      };

      await createError({
        session: this.session,
        connection: this.connection,

        type: 'provider_discovery_failed',
        output: { type: 'error', data: discoveryError.error }
      });

      let detail = buildConnectionFailedDetail({ provider: fullProvider, discoveryError });

      return {
        status: 'discovery_failed' as const,
        discoveryError,
        detail,
        mcpError: { code: -32603, message: detail.shortMessage }
      };
    }

    let pair = await providerDeploymentConfigPairInternalService.useDeploymentConfigPair({
      deployment: fullProvider.deployment,
      authConfig: fullProvider.authConfig,
      config: fullProvider.config,
      version
    });

    let rec = pair.version.latestDiscoveryRecord;

    // Warnings belong to the pair version's discovery record, so an earlier instance on the
    // same pair version has already reported them for this session provider.
    if (rec?.warnings.length) {
      let alreadyReported = await db.sessionProviderInstance.findFirst({
        where: { sessionProviderOid: provider.oid, pairVersionOid: pair.version.oid },
        select: { oid: true }
      });

      if (!alreadyReported) {
        for (let warning of rec.warnings) {
          await createWarning({
            session: this.session,
            connection: this.connection,
            warning: {
              code: warning.code,
              message: warning.message,
              payload: warning.data
            }
          });
        }
      }
    }

    if (
      pair.version.specificationDiscoveryStatus == 'failed' &&
      !pair.version.specificationOid
    ) {
      await createError({
        session: this.session,
        connection: this.connection,

        type: 'provider_discovery_failed',
        output: rec?.error
          ? {
              type: 'error',
              data:
                rec.error.type == 'timeout_error'
                  ? {
                      code: 'discovery_timeout',
                      message:
                        rec.error.message ?? 'Provider specification discovery timed out'
                    }
                  : {
                      code: rec.error.error.code,
                      message:
                        rec.error.error.message ??
                        `Unable to discover provider capabilities: ${rec.error.error.code}`
                    }
            }
          : {
              type: 'error',
              data: {
                code: 'discovery_failed',
                message: 'Failed to discover provider specification'
              }
            }
      });

      let detail = buildConnectionFailedDetail({
        provider: fullProvider,
        discoveryError: rec?.error
      });

      return {
        status: 'discovery_failed' as const,
        discoveryError: rec?.error ?? null,
        detail,
        mcpError:
          rec?.error?.type == 'mcp_error'
            ? { ...rec.error.error, message: detail.shortMessage }
            : {
                code: -32603,
                message: detail.shortMessage
              }
      };
    }

    try {
      return await instanceLock.usingLock(
        provider.id,
        async () => {
          return await withTransaction(async tdb => {
            let currentInstance = await tdb.sessionProviderInstance.findFirst({
              where: {
                sessionProviderOid: provider.oid,
                expiresAt: { gt: new Date() }
              },
              include: { pairVersion: true }
            });

            if (currentInstance) {
              let ageInMinutes = Math.abs(
                differenceInMinutes(new Date(), currentInstance.createdAt)
              );
              if (ageInMinutes <= SESSION_PROVIDER_INSTANCE_MAX_AGE_MINUTES) {
                return {
                  status: 'ok' as const,
                  instance: await tdb.sessionProviderInstance.update({
                    where: { oid: currentInstance.oid },
                    data: {
                      expiresAt: addMinutes(
                        new Date(),
                        SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT
                      )
                    },
                    include: { pairVersion: true }
                  })
                };
              }
            }

            await tdb.sessionProviderInstance.updateMany({
              where: {
                sessionProviderOid: provider.oid,
                expiresAt: { gt: new Date() }
              },
              data: { expiresAt: new Date() }
            });

            return {
              status: 'ok' as const,
              instance: await tdb.sessionProviderInstance.create({
                data: {
                  ...getId('sessionProviderInstance'),
                  sessionProviderOid: provider.oid,
                  sessionOid: provider.sessionOid,
                  pairOid: pair.pair.oid,
                  pairVersionOid: pair.version.oid,
                  expiresAt: addMinutes(
                    new Date(),
                    SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT
                  )
                },
                include: { pairVersion: true }
              })
            };
          });
        },
        { acquisitionTimeoutMs: 5_000 }
      );
    } catch (error) {
      // A contender may have committed immediately before our acquisition budget
      // elapsed. Prefer its valid instance over surfacing lock contention.
      let winnerInstance = await this.findReusableProviderInstance(provider);
      if (winnerInstance) return { status: 'ok' as const, instance: winnerInstance };
      throw error;
    }
  }

  private async ensureProviderInstance(provider: SessionProvider) {
    let existing = providerInstanceResolutionPromises.get(provider.id);
    if (existing) {
      return (await existing) as Awaited<ReturnType<typeof this.resolveProviderInstance>>;
    }

    let promise = this.resolveProviderInstance(provider);
    providerInstanceResolutionPromises.set(provider.id, promise);

    try {
      return await promise;
    } finally {
      if (providerInstanceResolutionPromises.get(provider.id) === promise) {
        providerInstanceResolutionPromises.delete(provider.id);
      }
    }
  }

  #connectionSpecificationPromises = new Map<
    string,
    Promise<ConnectionScopedSpecification | null>
  >();

  private async resolveConnectionSpecification(d: {
    provider: SessionProvider;
    instance: SessionProviderInstance & { pairVersion: { versionOid: bigint } };
  }) {
    let connection = this.connection;
    if (!connection) return null;

    let cached = this.#connectionSpecificationPromises.get(d.provider.id);
    if (cached) return await cached;

    let promise = (async () => {
      let isConnectionScoped = await isConnectionScopedProviderVersionOid(
        d.instance.pairVersion.versionOid
      );
      if (!isConnectionScoped) return null;

      return await resolveConnectionScopedSpecification({
        connectionOid: connection.oid,
        sessionProviderOid: d.provider.oid,
        discover: async () => {
          let res = await sender.send(
            topics.instance.encode({ instance: d.instance, connection }),
            {
              type: 'provider.list_tools',
              sessionInstanceId: d.instance.id
            } satisfies ConduitInput,
            CONNECTION_TOOL_DISCOVERY_TIMEOUT_MS
          );

          if (!res.success) {
            return {
              status: 'failure',
              error: {
                code: /timeout/i.test(String(res.error))
                  ? 'provider_connect_timeout'
                  : 'provider_unreachable',
                message: 'The MCP server did not return its tools in time.'
              }
            };
          }

          return res.result as ConduitListToolsResult;
        }
      });
    })();

    promise.catch(() => {});
    this.#connectionSpecificationPromises.set(d.provider.id, promise);

    return await promise;
  }

  private async listToolsForProvider(
    provider: SessionProvider & {
      provider: { name: string };
      deployment: ProviderDeployment;
      authConfig?:
        | (ProviderAuthConfig & {
            authCredentials?: ProviderAuthCredentials | null;
            authMethod?: ProviderAuthMethod | null;
          })
        | null;
    }
  ) {
    let res = await this.ensureProviderInstance(provider);
    if (!res) {
      return {
        status: 'ok' as const,
        tools: []
      };
    }

    if (res.status === 'discovery_failed') return { ...res, provider };

    let connectionSpecification = await this.resolveConnectionSpecification({
      provider,
      instance: res.instance
    }).catch(error => {
      Sentry.captureException(error);
      console.error('Error resolving connection scoped specification:', error);
      return null;
    });

    let specificationOid =
      connectionSpecification?.specificationOid ??
      (await resolveProviderToolListingSpecificationOid({
        pairVersion: res.instance.pairVersion
      }));

    let connectionError = connectionSpecification?.error ?? null;

    // Without any specification the provider has nothing to serve, so the
    // session gets the synthetic connection-failed tool instead.
    if (!specificationOid && connectionError) {
      let discoveryError = {
        type: 'connection_error' as const,
        error: connectionError
      };
      let detail = buildConnectionFailedDetail({ provider, discoveryError });

      return {
        status: 'discovery_failed' as const,
        discoveryError,
        detail,
        mcpError: { code: -32603, message: detail.shortMessage },
        provider
      };
    }

    let tools = specificationOid
      ? await listSpecificationTools({ specificationOid, session: this.session })
      : [];

    let authMethodFilteredTools = tools.filter(
      tool => checkToolAuthMethodSatisfied(tool, provider.authConfig?.authMethod).allowed
    );

    let grantedScopes = resolveGrantedScopes({
      authConfig: provider.authConfig,
      authCredentials: provider.authConfig?.authCredentials
    });

    let scopeFilteredTools =
      grantedScopes === null
        ? authMethodFilteredTools
        : authMethodFilteredTools.filter(
            tool => checkToolScopesSatisfied(tool, grantedScopes).allowed
          );

    let result = {
      status: 'ok' as const,
      tools: scopeFilteredTools.map(t => ({
        ...t,
        key: applySessionProviderNameTemplate(provider.nameTemplate!, t.key),
        sessionProvider: provider,
        sessionProviderInstance: res.instance
      }))
    };
    return result;
  }

  async listProviders() {
    let providers = await db.sessionProvider.findMany({
      where: { sessionOid: this.session.oid, status: 'active', isParentDeleted: false },
      include: {
        provider: true,
        deployment: true,
        config: true,
        authConfig: { include: { authCredentials: true, authMethod: true } }
      }
    });

    return await sessionProviderNameTemplateService.ensureForSessionProvidersInternal({
      tenant: this.tenant,
      providers
    });
  }

  async listToolsIncludingInternalAndNonAllowed() {
    let providers = await this.listProviders();
    if (providers.length > 1) await this.prefetchProviderInstances(providers);

    let discoveryRes = await Promise.all(
      providers.map(provider => this.listToolsForProvider(provider))
    );

    let failedRes = discoveryRes.filter(
      (res): res is Extract<typeof res, { status: 'discovery_failed' }> =>
        res.status === 'discovery_failed'
    );

    let tools = discoveryRes.flatMap(r => (r.status == 'ok' ? r.tools : []));

    if (!this.session.isInternal) {
      tools.push(buildConnectionStatusTool(this.session) as unknown as (typeof tools)[number]);

      if (await resolveCallbackEventToolScope(providers)) {
        tools.push(
          ...(buildCallbackEventTools(this.session) as unknown as (typeof tools)[number][])
        );
      }
    }

    if (!this.session.isInternal && failedRes.length > 0) {
      // A failed provider never fails the whole listing: the session keeps
      // working and each failed provider gets a synthetic
      // `{provider}_connection_failed` tool that explains the failure.
      for (let failed of failedRes) {
        tools.push(
          buildConnectionFailedTool(
            failed.provider,
            failed.detail
          ) as unknown as (typeof tools)[number]
        );
      }
    }

    let requestTools = (await this.getRequestTools())?.tools ?? [];
    if (requestTools.length) {
      let requestToolKeys = new Set(requestTools.map(tool => tool.key));
      let shadowedTools = tools.filter(tool => requestToolKeys.has(tool.key));
      if (shadowedTools.length) this.reportShadowedProviderTools(shadowedTools);

      tools = [
        ...tools.filter(tool => !requestToolKeys.has(tool.key)),
        ...(requestTools as unknown as (typeof tools)[number][])
      ];
    }

    return {
      status: 'ok' as const,
      tools: tools.sort((a, b) => a.id.localeCompare(b.id))
    };
  }

  #requestToolsPromise: Promise<{
    requestTools: RequestScopedTools;
    tools: ReturnType<typeof buildRequestScopedTool>[];
  } | null> | null = null;

  private getRequestTools() {
    let resolver = this.requestToolsResolver;
    if (this.session.isInternal || !resolver) return Promise.resolve(null);

    this.#requestToolsPromise ??= (async () => {
      try {
        let requestTools = await resolver();
        if (!requestTools) return null;

        let providers = await this.listProviders();
        let connectionFailedToolKeys = new Set(
          providers.flatMap(provider =>
            provider.nameTemplate
              ? [
                  applySessionProviderNameTemplate(
                    provider.nameTemplate,
                    CONNECTION_FAILED_TOOL_KEY
                  )
                ]
              : []
          )
        );

        let keys = new Set<string>();
        let unprefixedToolKeys: string[] = [];
        let tools = requestTools.tools.filter(tool => {
          if (!tool.key.startsWith(METORIAL_TOOL_KEY_PREFIX)) {
            unprefixedToolKeys.push(tool.key);
            return false;
          }

          if (
            keys.has(tool.key) ||
            isBuiltInSyntheticToolKey(tool.key, connectionFailedToolKeys)
          ) {
            return false;
          }

          keys.add(tool.key);
          return true;
        });

        if (unprefixedToolKeys.length) this.reportUnprefixedRequestTools(unprefixedToolKeys);

        return {
          requestTools,
          tools: tools.map(tool => buildRequestScopedTool(this.session, tool))
        };
      } catch (error) {
        Sentry.captureException(error);
        return null;
      }
    })();

    return this.#requestToolsPromise;
  }

  private reportUnprefixedRequestTools(toolKeys: string[]) {
    Sentry.captureMessage('Dropped request tools without the reserved key prefix', {
      level: 'warning',
      extra: {
        sessionId: this.session.id,
        prefix: METORIAL_TOOL_KEY_PREFIX,
        toolKeys
      }
    });
  }

  #reportedShadowedProviderTools = false;

  private reportShadowedProviderTools(tools: { key: string }[]) {
    if (this.#reportedShadowedProviderTools) return;
    this.#reportedShadowedProviderTools = true;

    Sentry.captureMessage('Request tools replaced provider tools with the same key', {
      level: 'warning',
      extra: {
        sessionId: this.session.id,
        toolKeys: tools.map(tool => tool.key)
      }
    });
  }

  async listToolsIncludingInternal() {
    let allToolsRes = await this.listToolsIncludingInternalAndNonAllowed();

    return {
      status: 'ok' as const,
      tools: allToolsRes.tools.filter(
        tool =>
          isSyntheticTool(tool) || checkToolAccess(tool, tool.sessionProvider, 'list').allowed
      )
    };
  }

  async listTools() {
    let allTools = await this.listToolsIncludingInternal();

    return {
      status: 'ok' as const,
      tools: allTools.tools.filter(tool => {
        let mcpType = tool.value.mcpToolType.type;
        return mcpType !== 'mcp.logging_setLevel' && mcpType !== 'mcp.completion_complete';
      })
    };
  }

  private getToolMatches<
    P extends { id: string; tag: string; nameTemplate: string | null }
  >(d: { toolId: string; providers: P[] }) {
    type ToolMatch = {
      provider: P;
      originalToolName: string;
      finalToolName: string;
    };

    if (this.session.isInternal) {
      return d.providers.map(
        (provider): ToolMatch => ({
          provider,
          originalToolName: d.toolId,
          finalToolName: d.toolId
        })
      );
    }

    let templateMatch: ToolMatch | null = null;

    try {
      let match = parseNameFromSessionProviderTemplates(d.toolId, d.providers);
      if (match) {
        templateMatch = {
          provider: match.provider,
          originalToolName: match.originalName,
          finalToolName: match.finalName
        };
      }
    } catch (error: any) {
      throw new ServiceError(badRequestError({ message: error.message }));
    }

    let legacyMatch = this.getLegacyToolMatch({ toolId: d.toolId, providers: d.providers });

    return [templateMatch, legacyMatch].filter((match): match is ToolMatch => match !== null);
  }

  private getLegacyToolMatch<P extends { tag: string }>(d: {
    toolId: string;
    providers: P[];
  }) {
    let parts = d.toolId.split('_');
    let providerTag = parts.pop();
    let toolKeyParts = parts;
    if (toolKeyParts.length === 0 || !providerTag?.trim()) {
      return null;
    }

    let provider = d.providers.find(p => p.tag === providerTag);
    if (!provider) return null;

    return {
      provider,
      originalToolName: toolKeyParts.join('_'),
      finalToolName: d.toolId
    };
  }

  private async getProviderToolByResolvedName(d: {
    provider: SessionProvider & {
      provider: { name: string };
      authConfig?:
        | (ProviderAuthConfig & {
            authCredentials?: ProviderAuthCredentials | null;
            authMethod?: ProviderAuthMethod | null;
          })
        | null;
    };
    originalToolName: string;
    finalToolName: string;
  }) {
    let instanceRes = await this.ensureProviderInstance(d.provider);
    if (!instanceRes) throw new ServiceError(notFoundError('provider.instance'));

    if (instanceRes.status === 'discovery_failed') {
      throw new ServiceError(
        preconditionFailedError({
          message: instanceRes.detail.shortMessage,
          _mcpError: instanceRes.mcpError
        })
      );
    }

    let instance = instanceRes.instance;

    let connectionSpecification = await this.resolveConnectionSpecification({
      provider: d.provider,
      instance
    }).catch(() => null);

    let specificationOid =
      connectionSpecification?.specificationOid ?? instance.pairVersion.specificationOid;

    for (let attempt = 0; !specificationOid && attempt < 5; attempt++) {
      await delay(2000);

      let retry = await this.ensureProviderInstance(d.provider);
      if (!retry || retry.status !== 'ok') break;

      instance = retry.instance;
      specificationOid = instance.pairVersion.specificationOid;
    }

    if (!specificationOid) {
      throw new ServiceError(
        badRequestError({ message: 'Tool not callable (not discovered yet)' })
      );
    }

    // Find the tool by key in the specification of the current instance
    let specificationTools = await listSpecificationTools({
      specificationOid,
      session: this.session
    });
    let tool = specificationTools.find(t => t.key === d.originalToolName);
    if (!tool) return null;

    let { allowed } = checkToolAccess(tool, d.provider, 'call');
    if (!allowed) {
      throw new ServiceError(badRequestError({ message: 'Tool access not allowed' }));
    }

    let authMethodCheck = checkToolAuthMethodSatisfied(
      tool,
      d.provider.authConfig?.authMethod
    );
    if (!authMethodCheck.allowed) {
      throw new ServiceError(
        badRequestError({ message: 'Tool is not available for this authentication method' })
      );
    }

    let grantedScopes = resolveGrantedScopes({
      authConfig: d.provider.authConfig,
      authCredentials: d.provider.authConfig?.authCredentials
    });
    if (grantedScopes !== null) {
      let scopeCheck = checkToolScopesSatisfied(tool, grantedScopes);
      if (!scopeCheck.allowed) {
        throw new ServiceError(
          badRequestError({
            message: 'Tool requires scopes that have not been granted to this credential'
          })
        );
      }
    }

    return {
      provider: d.provider,
      instance,
      tool: {
        ...tool,
        key: d.finalToolName,
        sessionProvider: d.provider,
        sessionProviderInstance: instance
      }
    };
  }

  private async resolveConnectionFailedTool(provider: ConnectionFailedProvider) {
    let instanceRes = await this.ensureProviderInstance(provider);
    if (!instanceRes || instanceRes.status !== 'discovery_failed') return null;

    return {
      provider,
      instance: null,
      detail: instanceRes.detail,
      tool: buildConnectionFailedTool(provider, instanceRes.detail)
    };
  }

  // Request tool args can hold caller content; unknown tools need none stored.
  async shouldRedactStoredToolInput(toolId: string) {
    try {
      let requestTool = await this.findRequestTool(toolId);
      if (requestTool) return true;

      if (toolId === CONNECTION_STATUS_TOOL_KEY || isCallbackEventTool(toolId)) return false;

      let providers = await this.listProviders();
      return this.getToolMatches({ toolId, providers }).length === 0;
    } catch {
      return true;
    }
  }

  // Prefix check avoids a DB hit on every provider tools/call.
  private async findRequestTool(toolId: string) {
    if (!toolId.startsWith(METORIAL_TOOL_KEY_PREFIX)) return null;

    let requestTools = await this.getRequestTools();
    let tool = requestTools?.tools.find(tool => tool.key === toolId);
    if (!requestTools || !tool) return null;

    return { tool, requestTools: requestTools.requestTools };
  }

  async getToolById(d: { toolId: string }) {
    let requestTool = await this.findRequestTool(d.toolId);
    if (requestTool) {
      return {
        provider: null,
        instance: null,
        requestTool: true as const,
        tool: requestTool.tool,
        requestTools: requestTool.requestTools
      };
    }

    if (d.toolId === CONNECTION_STATUS_TOOL_KEY) {
      if (this.session.isInternal) {
        throw new ServiceError(notFoundError('tool', d.toolId));
      }
      return {
        provider: null,
        instance: null,
        connectionStatus: true as const,
        tool: buildConnectionStatusTool(this.session)
      };
    }

    if (isCallbackEventTool(d.toolId)) {
      let tool = buildCallbackEventTools(this.session).find(t => t.key === d.toolId);
      let scope = this.session.isInternal
        ? null
        : await resolveCallbackEventToolScope(await this.listProviders());
      if (!tool || !scope) {
        throw new ServiceError(notFoundError('tool', d.toolId));
      }
      return {
        provider: null,
        instance: null,
        callbackEventTool: true as const,
        tool,
        scope
      };
    }

    let providers = await this.listProviders();
    let matches = this.getToolMatches({ toolId: d.toolId, providers });

    if (matches.length === 0) {
      throw new ServiceError(badRequestError({ message: 'Invalid tool ID format' }));
    }

    for (let match of matches) {
      if (match!.originalToolName === CONNECTION_FAILED_TOOL_KEY) {
        if (this.session.isInternal) continue;
        let synthetic = await this.resolveConnectionFailedTool(match!.provider);
        if (synthetic) return synthetic;
      }
    }

    for (let match of matches) {
      let resolved = await this.getProviderToolByResolvedName(match!);
      if (resolved) return resolved;
    }

    throw new ServiceError(notFoundError('tool', d.toolId));
  }

  async getInternalToolByProviderType(d: {
    provider: Awaited<ReturnType<SenderManager['listProviders']>>[number];
    type: string;
  }) {
    if (this.session.isInternal) {
      throw new ServiceError(notFoundError('tool', d.type));
    }
    let toolsRes = await this.listToolsForProvider(d.provider);
    if (toolsRes.status === 'discovery_failed') {
      throw new ServiceError(
        preconditionFailedError({
          message: toolsRes.detail.shortMessage,
          _mcpError: toolsRes.mcpError
        })
      );
    }

    let tool = toolsRes.tools.find(item => item.value.mcpToolType.type === d.type);
    if (!tool) {
      throw new ServiceError(notFoundError('tool', d.type));
    }

    return tool;
  }

  async createMessage(d: CreateMessageProps) {
    return await createMessage({
      ...d,
      session: this.session,
      connection: this.connection ?? null
    });
  }

  private async publishTargetedResult(connection: SessionConnection, result: ConduitResult) {
    try {
      await broadcastNats.publish(
        topics.sessionConnection.encode({ session: this.session, connection }),
        serialize.encode({
          type: 'message_processed',
          sessionId: this.session.id,
          channel: 'targeted_response',
          result
        })
      );
    } catch (error) {
      Sentry.captureException(error);
    }
  }

  private async completeSyntheticCall(d: {
    tool: { key: string };
    participant: SessionParticipant;
    callProps: CallToolProps;
    provider?: SessionProvider;
    run: (input: PrismaJson.SessionMessageInput) => Promise<SyntheticCallOutcome>;
  }) {
    let extractedToolCall = extractToolCallOperation({
      input: d.callProps.input,
      rationale: d.callProps.rationale,
      operation: d.callProps.operation
    });

    let system = await upsertParticipant({
      session: this.session,
      from: { type: 'system' }
    });

    let outcome = await d.run(extractedToolCall.input);

    let message = await this.createMessage({
      status: outcome.status,
      type: d.callProps.transport === 'mcp' ? 'mcp_message' : 'tool_call',
      source: 'client',
      input: outcome.stored?.input ?? extractedToolCall.input,
      rationale: extractedToolCall.rationale,
      operation: extractedToolCall.operation,
      senderParticipant: d.participant,
      responderParticipant: system,
      failureReason: outcome.failureReason,
      clientMcpId: d.callProps.clientMcpId,
      transport: d.callProps.transport,
      methodOrToolKey: d.tool.key,
      isProductive: true,
      provider: d.provider,
      parentMessage: d.callProps.parentMessage,
      output: outcome.stored?.output ?? outcome.output
    });

    let result = {
      message,
      output: outcome.output,
      status: message.status,
      completedAt: message.completedAt
    } satisfies ConduitResult;

    if (this.connection) await this.publishTargetedResult(this.connection, result);

    return result;
  }

  private async completeConnectionFailedCall(d: {
    provider: SessionProvider;
    tool: { key: string };
    detail: ReturnType<typeof buildConnectionFailedDetail>;
    participant: SessionParticipant;
    callProps: CallToolProps;
  }) {
    return await this.completeSyntheticCall({
      tool: d.tool,
      participant: d.participant,
      callProps: d.callProps,
      provider: d.provider,
      run: async () => ({
        status: 'failed',
        failureReason: 'provider_error',
        output: {
          type: 'error',
          data: {
            code: 'provider_connection_failed',
            message: d.detail.longMessage,
            ...d.detail.data
          }
        }
      })
    });
  }

  private async fetchProviderDiagnostics(provider: SessionProvider) {
    let connection = this.connection;
    if (!connection) return null;

    let run = await db.providerRun.findFirst({
      where: {
        connectionOid: connection.oid,
        sessionProviderOid: provider.oid,
        status: 'running'
      },
      orderBy: { createdAt: 'desc' },
      include: { instance: true }
    });
    if (!run) return null;

    let res = await sender.send(
      topics.instance.encode({ instance: run.instance, connection }),
      {
        type: 'provider.diagnostics',
        sessionInstanceId: run.instance.id
      } satisfies ConduitInput,
      CONNECTION_DIAGNOSTICS_TIMEOUT_MS
    );
    if (!res.success) return null;

    let result = res.result as ConduitDiagnosticsResult;
    return result.status === 'ok' ? result.diagnostics : null;
  }

  private async completeConnectionStatusCall(d: {
    tool: { key: string };
    participant: SessionParticipant;
    callProps: CallToolProps;
  }) {
    return await this.completeSyntheticCall({
      tool: d.tool,
      participant: d.participant,
      callProps: d.callProps,
      run: async () => {
        let report = await buildConnectionStatusReport({
          session: this.session,
          connection: this.connection,
          providers: await this.listProviders(),
          getDiagnostics: provider => this.fetchProviderDiagnostics(provider)
        });

        return {
          status: 'succeeded',
          output: {
            type: 'tool.result',
            data: { summary: report.summary, ...report.data }
          }
        };
      }
    });
  }

  private async completeCallbackEventToolCall(d: {
    tool: { key: string };
    scope: CallbackEventToolScope;
    participant: SessionParticipant;
    callProps: CallToolProps;
  }) {
    return await this.completeSyntheticCall({
      tool: d.tool,
      participant: d.participant,
      callProps: d.callProps,
      run: async input => {
        try {
          let data = await runCallbackEventTool({
            toolKey: d.tool.key,
            arguments: getToolCallArguments(input),
            tenant: this.tenant,
            session: this.session,
            scope: d.scope
          });

          return { status: 'succeeded', output: { type: 'tool.result', data } };
        } catch (error) {
          return {
            status: 'failed',
            failureReason: 'system_error',
            output: {
              type: 'error',
              data:
                error instanceof ServiceError
                  ? error.data
                  : { code: 'system_error', message: 'Failed to execute tool' }
            }
          };
        }
      }
    });
  }

  private async completeRequestToolCall(d: {
    requestTools: RequestScopedTools;
    tool: { key: string };
    participant: SessionParticipant;
    callProps: CallToolProps;
  }) {
    return await this.completeSyntheticCall({
      tool: d.tool,
      participant: d.participant,
      callProps: d.callProps,
      run: async input => {
        let args = getToolCallArguments(input);
        let outcome = await this.runRequestTool({
          requestTools: d.requestTools,
          key: d.tool.key,
          args,
          clientMcpId: d.callProps.clientMcpId
        });

        let redactForLog = d.requestTools.redactForLog;
        if (!redactForLog) return outcome;

        let data = outcome.status === 'succeeded' ? outcome.output.data : undefined;

        let redacted = this.redactRequestToolCallForLog(redactForLog, {
          key: d.tool.key,
          input: args,
          output: data
        });

        return {
          ...outcome,
          stored: {
            input: withToolCallArguments(input, redacted.input),
            output:
              outcome.status === 'succeeded'
                ? { type: 'tool.result', data: redacted.output ?? {} }
                : outcome.output
          }
        };
      }
    });
  }

  private redactRequestToolCallForLog(
    redactForLog: NonNullable<RequestScopedTools['redactForLog']>,
    d: Parameters<NonNullable<RequestScopedTools['redactForLog']>>[0]
  ) {
    try {
      return redactForLog(d);
    } catch (error) {
      Sentry.captureException(error);
      return { input: { redacted: true }, output: { redacted: true } };
    }
  }

  private async runRequestTool(d: {
    requestTools: RequestScopedTools;
    key: string;
    args: unknown;
    clientMcpId: CallToolProps['clientMcpId'];
  }): Promise<SyntheticCallOutcome> {
    try {
      let data = await d.requestTools.call(d.key, d.args);
      return { status: 'succeeded', output: { type: 'tool.result', data } };
    } catch (error) {
      if (error instanceof ServiceError) {
        return {
          status: 'failed',
          output: {
            type: 'mcp',
            data: {
              jsonrpc: '2.0',
              id: d.clientMcpId!,
              result: {
                content: [{ type: 'text', text: JSON.stringify(error.data) }],
                isError: true
              } satisfies McpCallToolResult
            }
          }
        };
      }

      Sentry.captureException(error);

      return {
        status: 'failed',
        failureReason: 'system_error',
        output: {
          type: 'error',
          data: { code: 'system_error', message: 'Failed to execute tool' }
        }
      };
    }
  }

  async callTool(d: CallToolProps): Promise<CallToolResult> {
    let connection = this.connection;
    if (!connection) {
      throw new ServiceError(
        badRequestError({ message: 'No connection id/token passed to connection' })
      );
    }
    if (connection.initState !== 'completed') {
      throw new ServiceError(badRequestError({ message: 'Connection is not initialized' }));
    }
    let participant = await this.ensureConnectionParticipant();
    if (!participant) {
      throw new Error('Connection participant not loaded');
    }

    let resolved = await this.getToolById({ toolId: d.toolId });

    if ('requestTool' in resolved && resolved.requestTools) {
      return await this.completeRequestToolCall({
        requestTools: resolved.requestTools,
        tool: resolved.tool,
        participant,
        callProps: d
      });
    }

    // The status tool is answered by Metorial itself so that it stays available
    // even when every provider connection is broken.
    if ('connectionStatus' in resolved) {
      return await this.completeConnectionStatusCall({
        tool: resolved.tool,
        participant,
        callProps: d
      });
    }

    if ('callbackEventTool' in resolved) {
      return await this.completeCallbackEventToolCall({
        tool: resolved.tool,
        scope: resolved.scope,
        participant,
        callProps: d
      });
    }

    // The synthetic connection-failed tool has no backing provider instance;
    // complete the call immediately with a detailed error for the agent.
    if (!resolved.instance && 'detail' in resolved) {
      return await this.completeConnectionFailedCall({
        provider: resolved.provider,
        tool: resolved.tool,
        detail: resolved.detail,
        participant,
        callProps: d
      });
    }

    let { provider, tool, instance } = resolved;

    let extractedToolCall = extractToolCallOperation({
      input: d.input,
      rationale: d.rationale,
      operation: d.operation
    });

    let { allowed } = checkToolAccess(tool, provider, 'call');

    if (!allowed) {
      throw new ServiceError(badRequestError({ message: 'Tool access not allowed' }));
    }

    let message = await this.createMessage({
      status: 'waiting_for_response',
      type: d.transport === 'mcp' ? 'mcp_message' : 'tool_call',
      source: 'client',
      input: extractedToolCall.input,
      rationale: extractedToolCall.rationale,
      operation: extractedToolCall.operation,
      senderParticipant: participant,
      clientMcpId: d.clientMcpId,
      transport: d.transport,
      tool,
      isProductive: true,
      provider,
      parentMessage: d.parentMessage
    });

    let processingPromise = (async () => {
      try {
        let res = await sender.send(topics.instance.encode({ instance, connection }), {
          type: 'tool_call',
          sessionInstanceId: instance.id,
          sessionMessageId: message.id,

          toolCallableId: tool.callableId,
          toolId: tool.id,
          toolKey: tool.key,

          input: extractedToolCall.input
        } satisfies ConduitInput);

        if (!res.success) {
          let system = await upsertParticipant({
            session: this.session,
            from: { type: 'system' }
          });

          let failureReason =
            typeof res.error === 'string' && /timeout/i.test(res.error)
              ? ('timeout' as const)
              : ('system_error' as const);

          message = await completeMessage(
            { messageId: message.id },
            {
              status: 'failed',
              completedAt: new Date(),
              failureReason,
              responderParticipant: system,
              output: {
                type: 'error',
                data:
                  failureReason === 'timeout'
                    ? {
                        code: 'timeout',
                        message: 'The conduit request timed out before the provider responded.'
                      }
                    : internalServerError({
                        message: 'Failed to process tool call'
                      }).toResponse()
              }
            }
          );

          await this.publishTargetedResult(connection, {
            message,
            output: message.output,
            status: message.status,
            completedAt: message.completedAt
          });
        } else {
          let data = res.result as ConduitResult;
          message = Object.assign(message, {
            ...data.message,
            output: data.output ?? data.message?.output
          });
        }
      } catch (err) {
        Sentry.captureException(err);

        console.error('Error sending tool call message:', err);

        let system = await upsertParticipant({
          session: this.session,
          from: { type: 'system' }
        });

        let failureReason =
          err instanceof ConduitSendError && /timeout/i.test(err.message)
            ? ('timeout' as const)
            : ('system_error' as const);
        let errorResponse =
          failureReason === 'timeout'
            ? {
                code: 'timeout',
                message: err instanceof Error ? err.message : 'The conduit request timed out.'
              }
            : internalServerError({
                message: err instanceof Error ? err.message : 'Failed to process tool call'
              }).toResponse();

        message = await completeMessage(
          { messageId: message.id },
          {
            status: 'failed',
            completedAt: new Date(),
            failureReason,
            responderParticipant: system,
            output: {
              type: 'error',
              data: errorResponse
            }
          }
        );

        await this.publishTargetedResult(connection, {
          message,
          output: message.output,
          status: message.status,
          completedAt: message.completedAt
        });
      }
    })();

    if (d.waitForResponse) {
      await processingPromise;
    }

    return {
      message,
      output: message.output,
      status: message.status,
      completedAt: message.completedAt,
      processingPromise: d.waitForResponse ? undefined : processingPromise
    } satisfies CallToolResult;
  }

  #createConnectionPromise: Promise<SessionConnection> | null = null;
  async createConnection() {
    await this.ensureAgentClientUpserted();

    if (this.connection) return this.connection;
    if (this.#createConnectionPromise) return await this.#createConnectionPromise;

    let con = db.sessionConnection
      .create({
        data: {
          ...getId('sessionConnection'),

          token: await ID.generateId('sessionConnection_token'),

          isEphemeral: this.session.isEphemeral,
          isInternal: this.session.isInternal,
          adapterGlobalOid: this.session.adapterGlobalOid,

          status: 'active',
          state: 'connected',
          initState: 'pending',
          transport: this.transport,

          isManuallyDisabled: false,
          isReplaced: false,

          mcpTransport: 'none',
          mcpProtocolVersion: null,
          privateMetadata: this.connectionPrivateMetadata,

          sessionOid: this.session.oid,
          tenantOid: this.session.tenantOid,
          projectOid: this.session.projectOid,
          solutionOid: this.session.solutionOid,
          environmentOid: this.session.environmentOid,
          instanceOid: this.session.instanceOid,

          mcpData: {},

          expiresAt: addMinutes(new Date(), UNINITIALIZED_SESSION_EXPIRATION_MINUTES),
          lastPingAt: new Date(),
          lastActiveAt: new Date()
        }
      })
      .then(c => c); // Force promise to run

    void (async () => {
      await db.session.updateMany({
        where: { oid: this.session.oid },
        data: {
          connectionState: 'connected',
          lastActiveAt: new Date()
        }
      });
    })().catch(() => {});

    this.#createConnectionPromise = con;
    this.connection = await con;

    return this.connection;
  }

  async setConnection(connection: SessionConnection) {
    if (
      connection.sessionOid !== this.session.oid ||
      connection.isInternal !== this.session.isInternal ||
      (connection.adapterGlobalOid ?? null) !== (this.session.adapterGlobalOid ?? null)
    ) {
      throw new ServiceError(
        badRequestError({
          code: 'connection_adapter_scope_mismatch',
          message: 'The connection does not match the internal scope of its session.'
        })
      );
    }
    this.connection = Object.assign(this.connection ?? {}, connection);
  }

  async resolveSessionlessConnection(d: SessionlessConnectionProps) {
    let existing = await this.findSessionlessConnection(d.clientKey);
    if (existing) return await this.reuseSessionlessConnection(existing, d);

    return await sessionlessConnectionLock.usingLock(
      `${this.session.oid}:${d.clientKey}`,
      async () => {
        let current = await this.findSessionlessConnection(d.clientKey);
        if (current) return await this.reuseSessionlessConnection(current, d);

        return await this.initialize({
          client: d.client,
          mcpCapabilities: d.mcpCapabilities,
          mcpProtocolVersion: d.mcpProtocolVersion,
          mcpTransport: 'sessionless',
          mcpClientKey: d.clientKey,
          expiresAt: addHours(new Date(), SESSIONLESS_CONNECTION_MAX_AGE_HOURS)
        });
      }
    );
  }

  private async findSessionlessConnection(clientKey: string) {
    let now = new Date();

    return await db.sessionConnection.findFirst({
      where: {
        sessionOid: this.session.oid,
        mcpClientKey: clientKey,
        mcpTransport: 'sessionless',
        transport: this.transport,
        status: 'active',
        isManuallyDisabled: false,
        expiresAt: { gt: now },
        lastActiveAt: { gt: subHours(now, SESSIONLESS_CONNECTION_MAX_IDLE_HOURS) }
      },
      orderBy: { lastActiveAt: 'desc' },
      include: { participant: true }
    });
  }

  private async reuseSessionlessConnection(
    connection: SessionConnection,
    d: SessionlessConnectionProps
  ) {
    let now = new Date();
    let wasDisconnected = connection.state === 'disconnected';
    let mcpDataChanged =
      connection.mcpProtocolVersion !== d.mcpProtocolVersion ||
      !isEqual(connection.mcpData?.capabilities, d.mcpCapabilities);

    let updated = await db.sessionConnection.update({
      where: { oid: connection.oid },
      data: {
        lastActiveAt: now,
        lastPingAt: now,
        ...(wasDisconnected ? { state: 'connected' as const, disconnectedAt: null } : {}),
        ...(mcpDataChanged
          ? {
              mcpProtocolVersion: d.mcpProtocolVersion,
              mcpData: {
                ...connection.mcpData,
                capabilities: d.mcpCapabilities,
                protocolVersion: d.mcpProtocolVersion
              }
            }
          : {})
      },
      include: { participant: true }
    });

    if (wasDisconnected) {
      await db.session.updateMany({
        where: { oid: this.session.oid },
        data: { connectionState: 'connected', lastActiveAt: now }
      });

      if (!this.session.isInternal) {
        await db.sessionEvent.createMany({
          data: {
            ...getId('sessionEvent'),
            type: 'connection_connected',
            sessionOid: this.session.oid,
            connectionOid: updated.oid,
            tenantOid: this.session.tenantOid,
            projectOid: this.session.projectOid,
            solutionOid: this.session.solutionOid,
            environmentOid: this.session.environmentOid,
            instanceOid: this.session.instanceOid
          }
        });
      }
    }

    await this.setConnection(updated);
    return updated;
  }

  async disableConnection() {
    if (!this.connection) {
      throw new ServiceError(badRequestError({ message: 'No connection to disable' }));
    }
    if (this.session.isInternal) {
      throw new ServiceError(
        badRequestError({
          code: 'internal_session_readonly',
          message: 'Internal session connections cannot be disabled by customers.'
        })
      );
    }

    this.connection = await db.sessionConnection.update({
      where: { oid: this.connection.oid },
      data: {
        isManuallyDisabled: true,
        state: 'disconnected',
        disconnectedAt: new Date()
      },
      include: { participant: true }
    });

    if (!this.session.isInternal) {
      await db.sessionEvent.createMany({
        data: {
          ...getId('sessionEvent'),
          type: 'connection_disabled',
          sessionOid: this.session.oid,
          connectionOid: this.connection.oid,
          tenantOid: this.session.tenantOid,
          projectOid: this.session.projectOid,
          solutionOid: this.session.solutionOid,
          environmentOid: this.session.environmentOid,
          instanceOid: this.session.instanceOid
        }
      });
    }
  }

  async initialize(d: InitProps & { isManualConnection?: boolean }) {
    await this.ensureAgentClientUpserted();

    // Ignore if already initialized
    if (this.connection?.initState === 'completed') return this.connection;

    if (d.client.identifier.startsWith('metorial#') && !d.allowReservedClientIdentifier) {
      throw new ServiceError(
        badRequestError({
          message: 'Client identifier cannot start with reserved prefix metorial#'
        })
      );
    }

    let connectionClientAgentContext = d.agentInstance
      ? { agentInstance: d.agentInstance }
      : d.client.identifier.startsWith('metorial#') || d.isManualConnection
        ? null
        : await this.ensureConnectionClientAgentContext(d.client);

    let participant = await upsertParticipant({
      session: this.session,
      from: d.agentInstance
        ? {
            type: 'connection_client',
            transport: d.mcpTransport === 'none' ? 'metorial_protocol' : 'mcp',
            participant: d.client,
            agentInstance: d.agentInstance
          }
        : d.client.identifier.startsWith('metorial#')
          ? { type: 'system' }
          : {
              type: 'connection_client',
              transport: d.mcpTransport === 'none' ? 'metorial_protocol' : 'mcp',
              participant: d.client,
              agentInstance: connectionClientAgentContext?.agentInstance
            }
    });

    let connectionData = {
      state: 'connected' as const,
      initState: 'completed' as const,
      isManuallyDisabled: false,

      sessionOid: this.session.oid,
      participantOid: participant.oid,

      mcpData: {
        clientInfo: {
          ...d.client,
          version: d.client.version ?? '1.0.0'
        },
        capabilities: d.mcpCapabilities,
        protocolVersion: d.mcpProtocolVersion
      },
      mcpProtocolVersion: d.mcpProtocolVersion,
      mcpTransport: d.mcpTransport,

      expiresAt: d.expiresAt ?? addDays(new Date(), DEFAULT_SESSION_EXPIRATION_DAYS),
      lastPingAt: new Date(),
      lastActiveAt: new Date(),
      disconnectedAt: null,

      transport: this.transport,
      ...(d.systemIdentifier === undefined ? {} : { systemIdentifier: d.systemIdentifier }),
      ...(d.mcpClientKey === undefined ? {} : { mcpClientKey: d.mcpClientKey })
    };

    let connection: SessionConnection;
    let isNewConnection = !this.connection;
    if (this.connection) {
      connection = await db.sessionConnection.update({
        where: { oid: this.connection.oid },
        data: connectionData,
        include: { participant: true }
      });
    } else {
      connection = await db.sessionConnection.create({
        data: {
          ...getId('sessionConnection'),
          ...connectionData,
          isForManualToolCalls: !!d.isManualConnection,
          isReplaced: false,
          isEphemeral: this.session.isEphemeral,
          isInternal: this.session.isInternal,
          adapterGlobalOid: this.session.adapterGlobalOid,
          status: 'active',
          tenantOid: this.tenant.oid,
          projectOid: this.tenant.projectOid,
          solutionOid: this.solution.oid,
          environmentOid: this.session.environmentOid,
          instanceOid: this.session.instanceOid,
          privateMetadata: this.connectionPrivateMetadata,
          token: await ID.generateId('sessionConnection_token')
        },
        include: { participant: true }
      });
    }

    this.connection = Object.assign(this.connection ?? {}, connection);

    if (d.isManualConnection && !connection.isForManualToolCalls) {
      throw new ServiceError(
        internalServerError({ message: 'Connection cannot be used for manual tool calls' })
      );
    }

    // Only a row that did not exist before. Re-initialising an existing connection --
    // an SSE client reattaching with the same token -- runs through the update branch
    // above and would otherwise emit a second `create` for the same connection id. The
    // rollover earlier in this file is likewise bookkeeping, not someone connecting.
    if (isNewConnection) {
      await recordConnectionAuditEvent({
        ...connection,
        session: this.session,
        participant
      });
    }

    await db.session.updateMany({
      where: { oid: this.session.oid },
      data: {
        connectionState: 'connected',
        lastConnectionCreatedAt: new Date(),
        lastActiveAt: new Date()
      }
    });

    let connectionEvents = !this.session.isInternal
      ? [
          {
            ...getId('sessionEvent'),
            type: 'connection_created' as const,
            sessionOid: this.session.oid,
            connectionOid: connection.oid,
            tenantOid: this.session.tenantOid,
            projectOid: this.session.projectOid,
            solutionOid: this.session.solutionOid,
            environmentOid: this.session.environmentOid,
            instanceOid: this.session.instanceOid
          },
          {
            ...getId('sessionEvent'),
            type: 'connection_connected' as const,
            sessionOid: this.session.oid,
            connectionOid: connection.oid,
            tenantOid: this.session.tenantOid,
            projectOid: this.session.projectOid,
            solutionOid: this.session.solutionOid,
            environmentOid: this.session.environmentOid,
            instanceOid: this.session.instanceOid
          }
        ]
      : [];
    if (connectionEvents.length) {
      await db.sessionEvent.createMany({ data: connectionEvents });
    }

    (async () => {
      let res = await db.session.updateMany({
        where: { oid: this.session.oid, isStarted: false },
        data: { isStarted: true }
      });
      if (res.count > 0 && !this.session.isInternal) {
        await db.sessionEvent.createMany({
          data: {
            ...getId('sessionEvent'),
            type: 'session_started',
            sessionOid: this.session.oid,
            tenantOid: this.session.tenantOid,
            projectOid: this.session.projectOid,
            solutionOid: this.session.solutionOid,
            environmentOid: this.session.environmentOid,
            instanceOid: this.session.instanceOid
          }
        });
      }
    })().catch(() => {});

    this.connection = connection;

    return connection;
  }
}
