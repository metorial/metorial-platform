import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { sessionMcpMessagingService, sessionService } from '@metorial-subspace/module-session';
import {
  assertCanUseSessionById,
  getInstanceInternalEnvironmentIdentifier,
  getProjectInternalTenantIdentifier,
  tenantService
} from '@metorial-subspace/module-tenant';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type {
  Instance,
  ProductAssistantSubspaceMcpConnection,
  Project,
  ResourceActor
} from '@metorial/db';
import { db, ID, withTransaction } from '@metorial/db';
import { env } from '../../../env';
import { InternalMcpTransport, type MCPServerConfig } from '../../../lib/open-harness/lib/mcp';
import type { SubspaceMcpToolList } from '../../../types';
let CONNECTION_IDLE_MS = 15 * 60 * 1000;
let CONNECTION_MAX_AGE_MS = 6 * 60 * 60 * 1000;
let TOOL_CACHE_TTL_MS = 10 * 60 * 1000;

type SessionCaller = Pick<ResourceActor, 'oid'> | null;

type SubspaceServicesLike = {
  tenant: {
    getTenantAndEnvironmentById: (input: {
      tenantId: string;
      environmentId: string;
    }) => Promise<{ tenant: any; environment: any }>;
  };
  session: {
    getSessionByIdInternal: (input: {
      tenant: any;
      environment: any;
      sessionId: string;
    }) => Promise<{ id: string; status?: string }>;
    assertCanUseSession: (input: {
      instance: Instance;
      actor: SessionCaller;
      sessionId: string;
    }) => Promise<void>;
  };
};

let getCallerOrganizationActor = async (actor: SessionCaller) => {
  if (!actor) return null;

  let resourceActor = await db.resourceActor.findUnique({
    where: { oid: actor.oid },
    select: {
      organizationActor: true,
      consumerProfile: { select: { organizationActor: true } }
    }
  });

  return (
    resourceActor?.consumerProfile?.organizationActor ??
    resourceActor?.organizationActor ??
    null
  );
};

let assertCanUseSession = async (d: {
  instance: Instance;
  actor: SessionCaller;
  sessionId: string;
}) => {
  let organizationActor = await getCallerOrganizationActor(d.actor);
  if (!organizationActor) {
    throw new ServiceError(
      forbiddenError({
        message: `Subspace session ${d.sessionId} cannot be used by this actor.`
      })
    );
  }

  await assertCanUseSessionById({
    instance: d.instance,
    organizationActor,
    sessionId: d.sessionId,
    isCrossConsumerUseDenied: true
  });
};

let subspaceServices: SubspaceServicesLike = {
  tenant: {
    getTenantAndEnvironmentById: input => tenantService.getTenantAndEnvironmentById(input)
  },
  session: {
    getSessionByIdInternal: input => sessionService.getSessionByIdInternal(input),
    assertCanUseSession
  }
};

let addMs = (date: Date, ms: number) => new Date(date.getTime() + ms);

let isFreshConnection = (connection: ProductAssistantSubspaceMcpConnection, now: Date) =>
  now.getTime() - connection.lastUsedAt.getTime() <= CONNECTION_IDLE_MS &&
  now.getTime() - connection.createdAt.getTime() <= CONNECTION_MAX_AGE_MS;

let assertActiveSession = (session: { status?: string }, sessionId: string) => {
  if (session.status && session.status != 'active') {
    throw new ServiceError(
      badRequestError({
        message: `Subspace session ${sessionId} is not active.`
      })
    );
  }
};

export type ExplorerAssistantInput = {
  sessionId: string;
  solutionId: string;
  subspaceTenantId: string;
  environmentId: string;
};

export class SubspaceAssistant {
  constructor(private readonly subspaceServices: SubspaceServicesLike) {}

  async assertCanUseSession(d: {
    instance: Instance;
    actor: SessionCaller;
    input: { sessionId: string };
  }) {
    await this.subspaceServices.session.assertCanUseSession({
      instance: d.instance,
      actor: d.actor,
      sessionId: d.input.sessionId
    });
  }

  async getInput(d: {
    project: Project;
    instance: Instance;
    actor: SessionCaller;
    input: { sessionId: string };
  }): Promise<ExplorerAssistantInput> {
    await this.assertCanUseSession(d);

    let scope = await this.subspaceServices.tenant.getTenantAndEnvironmentById({
      tenantId: getProjectInternalTenantIdentifier(d.project),
      environmentId: getInstanceInternalEnvironmentIdentifier(d.instance)
    });
    let session = await this.subspaceServices.session.getSessionByIdInternal({
      tenant: scope.tenant,
      environment: scope.environment,
      sessionId: d.input.sessionId
    });

    assertActiveSession(session, d.input.sessionId);

    return {
      sessionId: session.id,
      solutionId: env.subspace.SUBSPACE_SOLUTION,
      subspaceTenantId: getProjectInternalTenantIdentifier(d.project),
      environmentId: getInstanceInternalEnvironmentIdentifier(d.instance)
    };
  }

  async createMcpServerConfig(d: {
    project: Project;
    instance: Instance;
    actor: SessionCaller;
    input: ExplorerAssistantInput;
  }): Promise<MCPServerConfig> {
    await this.assertCanUseSession(d);

    let existing = await this.getUsableConnection(d);
    return {
      name: 'Metorial Explorer',
      version: '1.0.0',
      transport: () =>
        new InternalMcpTransport({
          connectionToken: existing?.connectionToken,
          sendMessage: async (message, connectionToken, onProgress) =>
            await sessionMcpMessagingService.send({
              solutionId: d.input.solutionId,
              tenantId: d.input.subspaceTenantId,
              sessionId: d.input.sessionId,
              connectionToken,
              agentClient: {
                name: 'Metorial Assistant',
                type: 'system_client',
                foreignId: `product-assistant:${d.project.id}:${d.instance.id}:${d.input.sessionId}`
              },
              connectionPrivateMetadata: {
                source: 'product-assistant',
                assistant: 'explorer'
              },
              message: message as JSONRPCMessage,
              onProgress: async progress => await onProgress(progress)
            }),
          getCachedTools: async () =>
            existing
              ? await this.getCachedTools({ connectionId: existing.connectionId })
              : null,
          setCachedTools: async tools => {
            let connection = await this.getCurrentConnection(d);
            if (connection) {
              await this.setCachedTools({
                connectionId: connection.connectionId,
                tools
              });
            }
          },
          onConnection: async connection => {
            await this.persistConnection({
              ...d,
              connectionId: connection.connectionId,
              connectionToken: connection.connectionToken
            });
          },
          onActivity: async () => {
            let connection = await this.getCurrentConnection(d);
            if (connection) {
              await this.touchConnection({ connectionId: connection.connectionId });
            }
          }
        })
    };
  }

  async getCachedTools(d: { connectionId: string }): Promise<SubspaceMcpToolList | null> {
    let cache = await db.productAssistantSubspaceMcpToolCache.findFirst({
      where: {
        connectionId: d.connectionId,
        expiresAt: { gt: new Date() }
      }
    });

    return (cache?.tools as SubspaceMcpToolList | undefined) ?? null;
  }

  async setCachedTools(d: { connectionId: string; tools: SubspaceMcpToolList }) {
    let now = new Date();

    await db.productAssistantSubspaceMcpToolCache.upsert({
      where: {
        connectionId: d.connectionId
      },
      update: {
        tools: d.tools,
        cachedAt: now,
        expiresAt: addMs(now, TOOL_CACHE_TTL_MS)
      },
      create: {
        id: await ID.generateId('productAssistantSubspaceMcpToolCache'),
        connectionId: d.connectionId,
        tools: d.tools,
        cachedAt: now,
        expiresAt: addMs(now, TOOL_CACHE_TTL_MS)
      }
    });
  }

  async touchConnection(d: { connectionId: string }) {
    await db.productAssistantSubspaceMcpConnection.updateMany({
      where: {
        connectionId: d.connectionId
      },
      data: {
        lastUsedAt: new Date()
      }
    });
  }

  private async getCurrentConnection(d: {
    project: Project;
    instance: Instance;
    input: ExplorerAssistantInput;
  }) {
    return await db.productAssistantSubspaceMcpConnection.findUnique({
      where: {
        instanceOid_sessionId: {
          instanceOid: d.instance.oid,
          sessionId: d.input.sessionId
        }
      }
    });
  }

  private async getUsableConnection(d: {
    project: Project;
    instance: Instance;
    input: ExplorerAssistantInput;
  }) {
    let connection = await this.getCurrentConnection(d);
    if (!connection) return null;

    if (isFreshConnection(connection, new Date())) return connection;

    await db.productAssistantSubspaceMcpToolCache.deleteMany({
      where: {
        connectionId: connection.connectionId
      }
    });

    return null;
  }

  private async persistConnection(d: {
    project: Project;
    instance: Instance;
    input: ExplorerAssistantInput;
    connectionId: string;
    connectionToken: string;
  }) {
    let now = new Date();

    await withTransaction(async tx => {
      let existing = await tx.productAssistantSubspaceMcpConnection.findUnique({
        where: {
          instanceOid_sessionId: {
            instanceOid: d.instance.oid,
            sessionId: d.input.sessionId
          }
        }
      });

      if (existing?.connectionId && existing.connectionId != d.connectionId) {
        await tx.productAssistantSubspaceMcpToolCache.deleteMany({
          where: {
            connectionId: existing.connectionId
          }
        });
      }

      await tx.productAssistantSubspaceMcpConnection.upsert({
        where: {
          instanceOid_sessionId: {
            instanceOid: d.instance.oid,
            sessionId: d.input.sessionId
          }
        },
        update: {
          solutionId: d.input.solutionId,
          subspaceTenantId: d.input.subspaceTenantId,
          connectionId: d.connectionId,
          connectionToken: d.connectionToken,
          lastUsedAt: now,
          ...(existing?.connectionId == d.connectionId ? {} : { createdAt: now })
        },
        create: {
          id: await ID.generateId('productAssistantSubspaceMcpConnection'),
          projectOid: d.project.oid,
          instanceOid: d.instance.oid,
          sessionId: d.input.sessionId,
          solutionId: d.input.solutionId,
          subspaceTenantId: d.input.subspaceTenantId,
          connectionId: d.connectionId,
          connectionToken: d.connectionToken,
          lastUsedAt: now
        }
      });
    });
  }
}

export let subspaceAssistant = new SubspaceAssistant(subspaceServices);

export let createSubspaceAssistantForTest = (services: SubspaceServicesLike) =>
  new SubspaceAssistant(services);
