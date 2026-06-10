import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createSubspaceControllerClient } from '@metorial-platform-systems/subspace-client';
import type { Environment, SubspaceMcpConnection, Tenant } from '../../../db';
import { db, withTransaction } from '../../../db';
import { env } from '../../../env';
import { getId } from '../../../id';
import {
  ReusableHttpMcpTransport,
  type MCPServerConfig
} from '../../../lib/open-harness/lib/mcp';
import type { SubspaceMcpToolList } from '../../../types';

let CONNECTION_IDLE_MS = 15 * 60 * 1000;
let CONNECTION_MAX_AGE_MS = 6 * 60 * 60 * 1000;
let TOOL_CACHE_TTL_MS = 10 * 60 * 1000;

let subspace = createSubspaceControllerClient({
  endpoint: env.subspace.SUBSPACE_URL,
  getHeaders: async () => ({
    'Subspace-Solution-Id': env.subspace.SUBSPACE_SOLUTION
  })
});

type SubspaceControllerLike = {
  session: {
    get: (input: {
      tenantId: string;
      environmentId: string;
      sessionId: string;
    }) => Promise<{ id: string; status?: string }>;
  };
};

let addMs = (date: Date, ms: number) => new Date(date.getTime() + ms);

let isFreshConnection = (connection: SubspaceMcpConnection, now: Date) =>
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
  constructor(private readonly subspaceClient: SubspaceControllerLike) {}

  async getInput(d: {
    tenant: Tenant;
    environment: Environment;
    input: { sessionId: string };
  }): Promise<ExplorerAssistantInput> {
    let session = await this.subspaceClient.session.get({
      tenantId: d.tenant.identifier,
      environmentId: d.environment.identifier,
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
    tenant: Tenant;
    environment: Environment;
    input: ExplorerAssistantInput;
  }): Promise<MCPServerConfig> {
    let existing = await this.getUsableConnection(d);
    let url = this.getMcpUrl(d.input);

    return {
      name: 'Metorial Explorer',
      version: '1.0.0',
      transport: () =>
        new ReusableHttpMcpTransport({
          url,
          headers: this.getMcpHeaders({
            tenant: d.tenant,
            environment: d.environment,
            input: d.input,
            url
          }),
          connectionToken: existing?.connectionToken,
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
    let cache = await db.subspaceMcpToolCache.findFirst({
      where: {
        connectionId: d.connectionId,
        expiresAt: { gt: new Date() }
      }
    });

    return (cache?.tools as SubspaceMcpToolList | undefined) ?? null;
  }

  async setCachedTools(d: { connectionId: string; tools: SubspaceMcpToolList }) {
    let now = new Date();

    await db.subspaceMcpToolCache.upsert({
      where: {
        connectionId: d.connectionId
      },
      update: {
        tools: d.tools,
        cachedAt: now,
        expiresAt: addMs(now, TOOL_CACHE_TTL_MS)
      },
      create: {
        ...getId('subspaceMcpToolCache'),
        connectionId: d.connectionId,
        tools: d.tools,
        cachedAt: now,
        expiresAt: addMs(now, TOOL_CACHE_TTL_MS)
      }
    });
  }

  async touchConnection(d: { connectionId: string }) {
    await db.subspaceMcpConnection.updateMany({
      where: {
        connectionId: d.connectionId
      },
      data: {
        lastUsedAt: new Date()
      }
    });
  }

  private async getCurrentConnection(d: {
    tenant: Tenant;
    environment: Environment;
    input: ExplorerAssistantInput;
  }) {
    return await db.subspaceMcpConnection.findUnique({
      where: {
        tenantOid_environmentOid_sessionId: {
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
          sessionId: d.input.sessionId
        }
      }
    });
  }

  private async getUsableConnection(d: {
    tenant: Tenant;
    environment: Environment;
    input: ExplorerAssistantInput;
  }) {
    let connection = await this.getCurrentConnection(d);
    if (!connection) return null;

    if (isFreshConnection(connection, new Date())) return connection;

    await db.subspaceMcpToolCache.deleteMany({
      where: {
        connectionId: connection.connectionId
      }
    });

    return null;
  }

  private async persistConnection(d: {
    tenant: Tenant;
    environment: Environment;
    input: ExplorerAssistantInput;
    connectionId: string;
    connectionToken: string;
  }) {
    let now = new Date();

    await withTransaction(async tx => {
      let existing = await tx.subspaceMcpConnection.findUnique({
        where: {
          tenantOid_environmentOid_sessionId: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
            sessionId: d.input.sessionId
          }
        }
      });

      if (existing?.connectionId && existing.connectionId != d.connectionId) {
        await tx.subspaceMcpToolCache.deleteMany({
          where: {
            connectionId: existing.connectionId
          }
        });
      }

      await tx.subspaceMcpConnection.upsert({
        where: {
          tenantOid_environmentOid_sessionId: {
            tenantOid: d.tenant.oid,
            environmentOid: d.environment.oid,
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
          ...getId('subspaceMcpConnection'),
          tenantOid: d.tenant.oid,
          environmentOid: d.environment.oid,
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

  private getMcpUrl(input: ExplorerAssistantInput) {
    let baseUrl = env.subspace.SUBSPACE_CONNECTION_URL.replace(/\/+$/, '');
    let solutionId = encodeURIComponent(input.solutionId);
    let tenantId = encodeURIComponent(input.subspaceTenantId);
    let sessionId = encodeURIComponent(input.sessionId);

    return `${baseUrl}/${solutionId}/${tenantId}/sessions/${sessionId}/mcp`;
  }

  private getMcpHeaders(d: {
    tenant: Tenant;
    environment: Environment;
    input: ExplorerAssistantInput;
    url: string;
  }) {
    return {
      'Metorial-Proxy-URL': d.url,
      'Metorial-Agent-Client': JSON.stringify({
        name: 'Metorial Explorer',
        type: 'system_client',
        foreignId: `synthesis:${d.tenant.id}:${d.environment.id}:${d.input.sessionId}`
      }),
      'Metorial-Connection-Private-Metadata': JSON.stringify({
        source: 'synthesis',
        assistant: 'explorer'
      })
    };
  }
}

export let subspaceAssistant = new SubspaceAssistant(subspace);

export let createSubspaceAssistantForTest = (client: SubspaceControllerLike) =>
  new SubspaceAssistant(client);
