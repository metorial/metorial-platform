import { badRequestError, ServiceError } from '@lowerdeck/error';
import { sessionMcpMessagingService, sessionService } from '@metorial-subspace/module-session';
import { tenantService } from '@metorial-subspace/module-tenant';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type {
  ProductAssistantSubspaceMcpConnection,
  ResourceGroup,
  ResourceTenant
} from '@metorial/db';
import { db, ID, withTransaction } from '@metorial/db';
import { env } from '../../../env';
import { InternalMcpTransport, type MCPServerConfig } from '../../../lib/open-harness/lib/mcp';
import type { SubspaceMcpToolList } from '../../../types';
let CONNECTION_IDLE_MS = 15 * 60 * 1000;
let CONNECTION_MAX_AGE_MS = 6 * 60 * 60 * 1000;
let TOOL_CACHE_TTL_MS = 10 * 60 * 1000;

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
  };
};

let subspaceServices: SubspaceServicesLike = {
  tenant: {
    getTenantAndEnvironmentById: input => tenantService.getTenantAndEnvironmentById(input)
  },
  session: {
    getSessionByIdInternal: input => sessionService.getSessionByIdInternal(input)
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

  async getInput(d: {
    tenant: ResourceTenant;
    environment: ResourceGroup;
    input: { sessionId: string };
  }): Promise<ExplorerAssistantInput> {
    let scope = await this.subspaceServices.tenant.getTenantAndEnvironmentById({
      tenantId: d.tenant.identifier,
      environmentId: d.environment.identifier
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
      subspaceTenantId: d.tenant.identifier,
      environmentId: d.environment.identifier
    };
  }

  async createMcpServerConfig(d: {
    tenant: ResourceTenant;
    environment: ResourceGroup;
    input: ExplorerAssistantInput;
  }): Promise<MCPServerConfig> {
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
                foreignId: `product-assistant:${d.tenant.id}:${d.environment.id}:${d.input.sessionId}`
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
    tenant: ResourceTenant;
    environment: ResourceGroup;
    input: ExplorerAssistantInput;
  }) {
    return await db.productAssistantSubspaceMcpConnection.findUnique({
      where: {
        resourceTenantOid_resourceGroupOid_sessionId: {
          resourceTenantOid: d.tenant.oid,
          resourceGroupOid: d.environment.oid,
          sessionId: d.input.sessionId
        }
      }
    });
  }

  private async getUsableConnection(d: {
    tenant: ResourceTenant;
    environment: ResourceGroup;
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
    tenant: ResourceTenant;
    environment: ResourceGroup;
    input: ExplorerAssistantInput;
    connectionId: string;
    connectionToken: string;
  }) {
    let now = new Date();

    await withTransaction(async tx => {
      let existing = await tx.productAssistantSubspaceMcpConnection.findUnique({
        where: {
          resourceTenantOid_resourceGroupOid_sessionId: {
            resourceTenantOid: d.tenant.oid,
            resourceGroupOid: d.environment.oid,
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
          resourceTenantOid_resourceGroupOid_sessionId: {
            resourceTenantOid: d.tenant.oid,
            resourceGroupOid: d.environment.oid,
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
          resourceTenantOid: d.tenant.oid,
          resourceGroupOid: d.environment.oid,
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
