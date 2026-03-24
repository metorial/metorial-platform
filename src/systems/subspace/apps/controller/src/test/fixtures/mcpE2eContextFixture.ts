import type { PrismaClient, Session } from '@metorial-subspace/db';
import { fixtures } from './index';

type TransportCase = {
  name: string;
  providerProtocol: 'sse' | 'streamable_http';
  upstreamPath: string;
  clientTransport: 'sse' | 'streamable_http';
};

export type McpE2eContext = {
  session: Session;
  solutionId: string;
  tenantId: string;
  sessionId: string;
  proxyUrl: string;
};

export let createMcpE2eContext = async (
  db: PrismaClient,
  opts: {
    remoteServerBaseUrl: string;
    transportCase: TransportCase;
    providerDeploymentToolFilter?: PrismaJson.ToolFilter;
    sessionProviderToolFilter?: PrismaJson.ToolFilter;
  }
): Promise<McpE2eContext> => {
  let f = fixtures(db);

  let tenant = await f.tenant.default({
    identifier: 'mcp-e2e-tenant',
    name: 'MCP E2E Tenant',
    urlKey: 'mcp-e2e-tenant'
  });

  let solution = await f.solution.default({
    identifier: 'mcp-e2e-solution',
    name: 'MCP E2E Solution'
  });

  let environment = await f.environment.default({
    tenant,
    overrides: {
      identifier: 'mcp-e2e-dev',
      name: 'MCP E2E Dev'
    }
  });

  let upstreamUrl = `${opts.remoteServerBaseUrl}${opts.transportCase.upstreamPath}`;

  let providerSetup = await f.remoteMcpProvider.complete({
    remoteUrl: upstreamUrl,
    protocol: opts.transportCase.providerProtocol,
    requireAtLeastOneTool: true,
    tenant,
    solution,
    environment
  });

  let session = await f.session.withDeployment({
    tenant: providerSetup.tenant,
    solution: providerSetup.solution,
    environment: providerSetup.environment,
    deployment: providerSetup.providerDeployment,
    name: 'MCP Session'
  });

  if (opts.providerDeploymentToolFilter) {
    await db.providerDeployment.update({
      where: { oid: providerSetup.providerDeployment.oid },
      data: { toolFilter: opts.providerDeploymentToolFilter as any } as any
    });
  }

  if (opts.sessionProviderToolFilter) {
    await db.sessionProvider.updateMany({
      where: { sessionOid: session.oid },
      data: { toolFilter: opts.sessionProviderToolFilter as any }
    });
  }

  let proxyPath = `/${providerSetup.solution.id}/${providerSetup.tenant.id}/sessions/${session.id}/mcp`;
  let proxyUrl = `http://subspace-controller.test${proxyPath}`;

  return {
    session,
    solutionId: providerSetup.solution.id,
    tenantId: providerSetup.tenant.id,
    sessionId: session.id,
    proxyUrl
  };
};
