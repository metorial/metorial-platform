import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  FunctionServer,
  FunctionServerInvocation,
  ServerConnection,
  Tenant
} from '../../prisma/generated/client';
import { db } from '../db';
import { snowflake } from '../id';
import { getFunctionCallLogs } from '../lib/function/call';

let include = {
  connection: true,
  functionServer: true
};

class functionServerInvocationServiceImpl {
  async ensureFunctionServerInvocation(d: {
    functionServer: FunctionServer;
    tenant: Tenant;
    functionInvocationId: string | null | undefined;
    isError: boolean;
    connection?: ServerConnection | null;
  }) {
    if (!d.functionInvocationId) return null;

    let existing = await db.functionServerInvocation.findFirst({
      where: {
        functionBayInvocationId: d.functionInvocationId
      },
      include
    });
    if (existing) return existing;

    return await db.functionServerInvocation.create({
      data: {
        oid: snowflake.nextId(),
        isError: d.isError,
        functionBayInvocationId: d.functionInvocationId,
        connectionOid: d.connection?.oid ?? null,
        functionServerOid: d.functionServer.oid,
        tenantOid: d.tenant.oid
      },
      include
    });
  }

  async listFunctionServerInvocations(d: {
    functionInvocationIds?: string[];
    serverConnectionIds?: string[];
    isError?: boolean;
  }) {
    return await db.functionServerInvocation.findMany({
      where: {
        functionBayInvocationId: d.functionInvocationIds
          ? { in: d.functionInvocationIds }
          : undefined,
        connection: d.serverConnectionIds ? { id: { in: d.serverConnectionIds } } : undefined,
        isError: d.isError
      },
      include,
      orderBy: { createdAt: 'asc' }
    });
  }

  async getFunctionServerInvocationById(d: { functionInvocationId: string }) {
    let invocation = await db.functionServerInvocation.findFirst({
      where: {
        functionBayInvocationId: d.functionInvocationId
      },
      include
    });
    if (!invocation) throw new ServiceError(notFoundError('function_server_invocation'));
    return invocation;
  }

  async getFunctionServerInvocationLogs(d: {
    functionServerInvocation: FunctionServerInvocation & {
      functionServer: FunctionServer;
    };
  }) {
    let logs = await getFunctionCallLogs({
      server: d.functionServerInvocation.functionServer,
      functionCallId: d.functionServerInvocation.functionBayInvocationId
    });

    return {
      object: 'shuttle#function_server.invocation.logs',
      functionInvocationId: d.functionServerInvocation.functionBayInvocationId,
      logs: logs.map(log => ({
        object: 'shuttle#function_server.invocation.log',
        outputType: 'stdout' as const,
        timestamp: log.timestamp,
        message: log.message
      }))
    };
  }
}

export let functionServerInvocationService = Service.create(
  'functionServerInvocationService',
  () => new functionServerInvocationServiceImpl()
).build();
