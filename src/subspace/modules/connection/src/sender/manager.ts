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
import type { ConduitInput, ConduitResult } from '@metorial-subspace/connection-utils';
import {
  type AgentInstance,
  db,
  getId,
  ID,
  type ProviderAuthConfig,
  type ProviderAuthCredentials,
  type ProviderAuthMethod,
  type ProviderDeployment,
  type Session,
  type SessionConnection,
  type SessionConnectionMcpConnectionTransport,
  type SessionConnectionTransport,
  type SessionMessage,
  type SessionParticipant,
  type SessionProvider,
  type Solution,
  type Tenant
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
import { addDays, addMinutes } from 'date-fns';
import {
  DEFAULT_SESSION_EXPIRATION_DAYS,
  SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT,
  UNINITIALIZED_SESSION_EXPIRATION_MINUTES
} from '../const';
import { env } from '../env';
import { conduit } from '../lib/conduit';
import { broadcastNats } from '../lib/nats';
import {
  buildConnectionFailedDetail,
  buildConnectionFailedTool,
  CONNECTION_FAILED_TOOL_KEY,
  type ConnectionFailedProvider
} from '../lib/connectionFailedTool';
import { isSyntheticTool } from '../lib/syntheticTool';
import { topics } from '../lib/topic';
import { completeMessage } from '../shared/completeMessage';
import { createError } from '../shared/createError';
import { createMessage, type CreateMessageProps } from '../shared/createMessage';
import { createWarning } from '../shared/createWarning';
import { extractToolCallOperation } from '../shared/toolCallOperation';
import { upsertParticipant } from '../shared/upsertParticipant';
import { resolveProviderToolListingSpecificationOid } from './toolSpecification';

let Sentry = getSentry();

let instanceLock = createLock({
  name: 'sub/conn/sess/inst/lock',
  redisUrl: env.service.REDIS_URL
});

let sender = conduit.createSender({
  defaultTimeout: 15_000,
  maxRetries: 0
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
    readonly connectionPrivateMetadata: SenderMangerProps['connectionPrivateMetadata']
  ) {}

  private static async resolveSession(d: SenderMangerProps) {
    if (d.connectionToken) {
      let connection = await db.sessionConnection.findFirst({
        where: {
          token: d.connectionToken,
          tenant: { OR: [{ id: d.tenantId }, { identifier: d.tenantId }] },
          solution: { OR: [{ id: d.solutionId }, { identifier: d.solutionId }] }
        },
        include: {
          session: true,
          participant: true,
          tenant: true,
          solution: true
        }
      });

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
    if (isRecordDeleted(session)) {
      throw new ServiceError(goneError({ message: 'Session has been archived or deleted' }));
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

    if (d.ingressPolicyCheck) {
      let environment = await db.environment.findUniqueOrThrow({
        where: { oid: session.environmentOid }
      });

      await enclaveIngressPolicyService.assertSessionIngressAccess({
        tenant: session.tenant,
        solution: session.solution,
        environment,
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

          await db.sessionEvent.createMany({
            data: {
              ...getId('sessionEvent'),
              type: 'connection_connected',
              sessionOid: session.oid,
              connectionOid: connection.oid,
              tenantOid: session.tenantOid,
              solutionOid: session.solutionOid,
              environmentOid: session.environmentOid
            }
          });
        })().catch(() => {});
      }
    }

    return new SenderManager(
      session,
      connection,
      session.tenant,
      session.solution,
      d.transport,
      d.agentClient,
      d.connectionPrivateMetadata
    );
  }

  #upsertAgentClientPromise: ReturnType<typeof this.upsertAgentClientIfNeeded> | null = null;
  private async upsertAgentClientIfNeeded() {
    if (!this.agentClient) return null;

    let environment = await db.environment.findUniqueOrThrow({
      where: { oid: this.session.environmentOid }
    });

    return await agentClientService.upsertAgentClient({
      tenant: this.tenant,
      solution: this.solution,
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

    let environment = await db.environment.findUniqueOrThrow({
      where: { oid: this.session.environmentOid }
    });

    let agent = await agentService.upsertAgent({
      tenant: this.tenant,
      solution: this.solution,
      environment,
      input: {
        name: d.name,
        type: 'mcp_client'
      }
    });

    let agentInstance = await agentInstanceService.upsertAgentInstance({
      tenant: this.tenant,
      solution: this.solution,
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

  private async ensureProviderInstance(provider: SessionProvider) {
    let currentInstance = await db.sessionProviderInstance.findFirst({
      where: {
        sessionProviderOid: provider.oid,
        expiresAt: { gt: new Date() }
      },
      include: { pairVersion: true }
    });
    if (currentInstance) {
      return {
        status: 'ok' as const,
        instance: await db.sessionProviderInstance.update({
          where: { oid: currentInstance.oid },
          data: {
            expiresAt: addMinutes(new Date(), SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT)
          },
          include: { pairVersion: true }
        })
      };
    }

    return instanceLock.usingLock(provider.id, async () => {
      let currentInstance = await db.sessionProviderInstance.findFirst({
        where: {
          sessionProviderOid: provider.oid,
          expiresAt: { gt: new Date() }
        },
        include: { pairVersion: true }
      });
      if (currentInstance) {
        return {
          status: 'ok' as const,
          instance: currentInstance
        };
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
        throw new ServiceError(badRequestError({ message: 'Provider has no usable version' }));
      }

      let pair = await providerDeploymentConfigPairInternalService.useDeploymentConfigPair({
        deployment: fullProvider.deployment,
        authConfig: fullProvider.authConfig,
        config: fullProvider.config,
        version
      });

      let rec = pair.version.latestDiscoveryRecord;

      if (rec) {
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

      return {
        status: 'ok' as const,
        instance: await db.sessionProviderInstance.create({
          data: {
            ...getId('sessionProviderInstance'),
            sessionProviderOid: provider.oid,
            sessionOid: provider.sessionOid,
            pairOid: pair.pair.oid,
            pairVersionOid: pair.version.oid,
            expiresAt: addMinutes(new Date(), SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT)
          },
          include: { pairVersion: true }
        })
      };
    });
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

    let specificationOid = await resolveProviderToolListingSpecificationOid({
      pairVersion: res.instance.pairVersion
    });

    let tools = specificationOid
      ? await db.providerTool.findMany({
          where: { specificationOid }
        })
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

    return {
      status: 'ok' as const,
      tools: scopeFilteredTools.map(t => ({
        ...t,
        key: applySessionProviderNameTemplate(provider.nameTemplate!, t.key),
        sessionProvider: provider,
        sessionProviderInstance: res.instance
      }))
    };
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

    return await sessionProviderNameTemplateService.ensureForSessionProviders({
      tenant: this.tenant,
      providers
    });
  }

  async listToolsIncludingInternalAndNonAllowed() {
    let providers = await this.listProviders();

    let discoveryRes = await Promise.all(
      providers.map(provider => this.listToolsForProvider(provider))
    );

    let failedRes = discoveryRes.filter(
      (res): res is Extract<typeof res, { status: 'discovery_failed' }> =>
        res.status === 'discovery_failed'
    );

    let tools = discoveryRes.flatMap(r => (r.status == 'ok' ? r.tools : []));

    if (failedRes.length > 0) {
      // Only surface the hard discovery error when no provider could be
      // discovered. Otherwise the session keeps working and we inject a
      // synthetic `{provider}_connection_failed` tool per failed provider.
      if (failedRes.length === discoveryRes.length) {
        return {
          status: 'discovery_failed' as const,
          mcpError: failedRes[0]!.mcpError
        };
      }

      for (let failed of failedRes) {
        tools.push(
          buildConnectionFailedTool(
            failed.provider,
            failed.detail
          ) as unknown as (typeof tools)[number]
        );
      }
    }

    return {
      status: 'ok' as const,
      tools: tools.sort((a, b) => a.id.localeCompare(b.id))
    };
  }

  async listToolsIncludingInternal() {
    let allToolsRes = await this.listToolsIncludingInternalAndNonAllowed();
    if (allToolsRes.status === 'discovery_failed') return allToolsRes;

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
    if (allTools.status === 'discovery_failed') return allTools;

    return {
      status: 'ok' as const,
      tools: allTools.tools.filter(tool => {
        let mcpType = tool.value.mcpToolType.type;
        return mcpType !== 'mcp.logging_setLevel' && mcpType !== 'mcp.completion_complete';
      })
    };
  }

  private async getProviderByTag(d: { tag: string }) {
    let provider = await db.sessionProvider.findFirst({
      where: {
        sessionOid: this.session.oid,
        tag: d.tag,
        status: 'active'
      },
      include: {
        provider: true,
        deployment: true,
        config: true,
        authConfig: { include: { authCredentials: true, authMethod: true } }
      }
    });
    if (!provider) throw new ServiceError(notFoundError('provider', d.tag));
    return provider;
  }

  private async getLegacyToolMatch(d: { toolId: string }) {
    let parts = d.toolId.split('_');
    let providerTag = parts.pop();
    let toolKeyParts = parts;
    if (toolKeyParts.length === 0 || !providerTag?.trim()) {
      return null;
    }

    let provider: Awaited<ReturnType<SenderManager['getProviderByTag']>> | null = null;
    try {
      provider = await this.getProviderByTag({ tag: providerTag! });
    } catch (error) {
      if (error instanceof ServiceError) {
        return null;
      }

      throw error;
    }

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

    let i = 0;
    while (!instanceRes?.instance?.pairVersion.specificationOid) {
      if (i++ >= 5) {
        throw new ServiceError(
          badRequestError({ message: 'Tool not callable (not discovered yet)' })
        );
      }

      await delay(2000);

      instanceRes = (await this.ensureProviderInstance(d.provider))! as any;
    }

    // Find the tool by key in the specification of the current instance
    let tool = await db.providerTool.findFirst({
      where: {
        key: d.originalToolName,
        specificationOid: instanceRes.instance.pairVersion.specificationOid
      }
    });
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
      instance: instanceRes.instance,
      tool: {
        ...tool,
        key: d.finalToolName,
        sessionProvider: d.provider,
        sessionProviderInstance: instanceRes.instance
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

  async getToolById(d: { toolId: string }) {
    let providers = await this.listProviders();

    let templateMatch: {
      provider: (typeof providers)[number];
      originalToolName: string;
      finalToolName: string;
    } | null = null;

    try {
      let match = parseNameFromSessionProviderTemplates(d.toolId, providers);
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

    let legacyMatch = await this.getLegacyToolMatch(d);
    let matches = [templateMatch, legacyMatch].filter(Boolean);

    if (matches.length === 0) {
      throw new ServiceError(badRequestError({ message: 'Invalid tool ID format' }));
    }

    // If the requested tool is the synthetic `{provider}_connection_failed`
    // tool of a provider that failed discovery, resolve it without dispatching
    // to a real provider instance.
    for (let match of matches) {
      if (match!.originalToolName === CONNECTION_FAILED_TOOL_KEY) {
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

  private async completeConnectionFailedCall(d: {
    provider: SessionProvider;
    tool: { key: string };
    detail: ReturnType<typeof buildConnectionFailedDetail>;
    participant: SessionParticipant;
    callProps: CallToolProps;
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

    // The connection-failed tool is synthetic and has no ProviderTool row, so
    // we pass `methodOrToolKey` (not `tool`) to avoid creating a toolCall with
    // an invalid foreign key. The message is completed immediately with a
    // detailed, agent-targeted error explaining the failure.
    let message = await this.createMessage({
      status: 'failed',
      type: d.callProps.transport === 'mcp' ? 'mcp_message' : 'tool_call',
      source: 'client',
      input: extractedToolCall.input,
      rationale: extractedToolCall.rationale,
      operation: extractedToolCall.operation,
      senderParticipant: d.participant,
      responderParticipant: system,
      failureReason: 'provider_error',
      clientMcpId: d.callProps.clientMcpId,
      transport: d.callProps.transport,
      methodOrToolKey: d.tool.key,
      isProductive: true,
      provider: d.provider,
      parentMessage: d.callProps.parentMessage,
      output: {
        type: 'error',
        data: {
          code: 'provider_connection_failed',
          message: d.detail.longMessage,
          ...d.detail.data
        }
      }
    });

    return {
      message,
      output: message.output,
      status: message.status,
      completedAt: message.completedAt
    } satisfies ConduitResult;
  }

  async callTool(d: CallToolProps) {
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

    let publishTargetedResult = async (result: ConduitResult) => {
      await broadcastNats.publish(
        topics.sessionConnection.encode({
          session: this.session,
          connection
        }),
        serialize.encode({
          type: 'message_processed',
          sessionId: this.session.id,
          channel: 'targeted_response',
          result
        })
      );
    };

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

          await publishTargetedResult({
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

        await publishTargetedResult({
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
      completedAt: message.completedAt
    } satisfies ConduitResult;
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
          solutionOid: this.session.solutionOid,
          environmentOid: this.session.environmentOid,

          mcpData: {},

          expiresAt: addMinutes(new Date(), UNINITIALIZED_SESSION_EXPIRATION_MINUTES),
          lastPingAt: new Date()
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
    this.connection = Object.assign(this.connection ?? {}, connection);
  }

  async disableConnection() {
    if (!this.connection) {
      throw new ServiceError(badRequestError({ message: 'No connection to disable' }));
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

    await db.sessionEvent.createMany({
      data: {
        ...getId('sessionEvent'),
        type: 'connection_disabled',
        sessionOid: this.session.oid,
        connectionOid: this.connection.oid,
        tenantOid: this.session.tenantOid,
        solutionOid: this.session.solutionOid,
        environmentOid: this.session.environmentOid
      }
    });
  }

  async initialize(d: InitProps & { isManualConnection?: boolean }) {
    await this.ensureAgentClientUpserted();

    // Ignore if already initialized
    if (this.connection?.initState === 'completed') return this.connection;

    if (d.client.identifier.startsWith('metorial#') && !d.isManualConnection) {
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

      expiresAt: addDays(new Date(), DEFAULT_SESSION_EXPIRATION_DAYS),
      lastPingAt: new Date(),
      lastActiveAt: new Date(),
      disconnectedAt: null,

      transport: this.transport
    };

    let connection: SessionConnection;
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
          status: 'active',
          tenantOid: this.tenant.oid,
          solutionOid: this.solution.oid,
          environmentOid: this.session.environmentOid,
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

    await db.session.updateMany({
      where: { oid: this.session.oid },
      data: {
        connectionState: 'connected',
        lastConnectionCreatedAt: new Date(),
        lastActiveAt: new Date()
      }
    });

    await db.sessionEvent.createMany({
      data: [
        {
          ...getId('sessionEvent'),
          type: 'connection_created',
          sessionOid: this.session.oid,
          connectionOid: connection.oid,
          tenantOid: this.session.tenantOid,
          solutionOid: this.session.solutionOid,
          environmentOid: this.session.environmentOid
        },
        {
          ...getId('sessionEvent'),
          type: 'connection_connected',
          sessionOid: this.session.oid,
          connectionOid: connection.oid,
          tenantOid: this.session.tenantOid,
          solutionOid: this.session.solutionOid,
          environmentOid: this.session.environmentOid
        }
      ]
    });

    (async () => {
      let res = await db.session.updateMany({
        where: { oid: this.session.oid, isStarted: false },
        data: { isStarted: true }
      });
      if (res.count > 0) {
        await db.sessionEvent.createMany({
          data: {
            ...getId('sessionEvent'),
            type: 'session_started',
            sessionOid: this.session.oid,
            tenantOid: this.session.tenantOid,
            solutionOid: this.session.solutionOid,
            environmentOid: this.session.environmentOid
          }
        });
      }
    })().catch(() => {});

    this.connection = connection;

    return connection;
  }
}
