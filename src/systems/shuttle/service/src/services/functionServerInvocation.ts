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
import type { FunctionCallLog } from '../lib/function/call';
import { serverConnectionService } from './serverConnection';

let include = {
  connection: true,
  functionServer: true
};

let parseStoredLogs = (logs: unknown): FunctionCallLog[] => {
  if (!Array.isArray(logs)) return [];

  return logs.flatMap(entry => {
    if (!entry || typeof entry !== 'object') return [];
    if (!('timestamp' in entry) || !('message' in entry)) return [];

    let timestamp = (entry as { timestamp: unknown }).timestamp;
    let message = (entry as { message: unknown }).message;
    if (typeof timestamp !== 'number' || typeof message !== 'string') return [];

    return [{ timestamp, message }];
  });
};

let presentInvocationLogs = (logs: FunctionCallLog[], functionInvocationId: string) => ({
  object: 'shuttle#function_server.invocation.logs' as const,
  functionInvocationId,
  logs: logs.map(log => ({
    object: 'shuttle#function_server.invocation.log' as const,
    outputType: 'stdout' as const,
    timestamp: log.timestamp,
    message: log.message
  }))
});

class functionServerInvocationServiceImpl {
  async ensureFunctionServerInvocation(d: {
    functionServer: FunctionServer;
    tenant: Tenant;
    functionInvocationId: string | null | undefined;
    isError: boolean;
    connection?: ServerConnection | null;
    logs?: FunctionCallLog[];
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
        tenantOid: d.tenant.oid,
        logs: d.logs?.length ? d.logs : undefined
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
      connection: ServerConnection | null;
    };
  }) {
    let storedLogs = parseStoredLogs(d.functionServerInvocation.logs);
    if (storedLogs.length > 0) {
      return presentInvocationLogs(
        storedLogs,
        d.functionServerInvocation.functionBayInvocationId
      );
    }

    if (!d.functionServerInvocation.connection) {
      return presentInvocationLogs([], d.functionServerInvocation.functionBayInvocationId);
    }

    let nextInvocation = d.functionServerInvocation.connectionOid
      ? await db.functionServerInvocation.findFirst({
          where: {
            connectionOid: d.functionServerInvocation.connectionOid,
            createdAt: { gt: d.functionServerInvocation.createdAt }
          },
          orderBy: { createdAt: 'asc' }
        })
      : null;

    let invocationCreatedAt = d.functionServerInvocation.createdAt.getTime();
    let upperBoundMs = nextInvocation?.createdAt.getTime() ?? Number.POSITIVE_INFINITY;

    let connectionLogs = await serverConnectionService.getLogs({
      serverConnection: d.functionServerInvocation.connection
    });

    let logs = connectionLogs
      .filter(log => {
        let ts = log.timestamp.getTime();
        return (
          log.outputType === 'stdout' &&
          ts >= invocationCreatedAt - 1000 &&
          ts < upperBoundMs
        );
      })
      .map(log => ({
        timestamp: log.timestamp.getTime(),
        message: log.message
      }));

    return presentInvocationLogs(logs, d.functionServerInvocation.functionBayInvocationId);
  }
}

export let functionServerInvocationService = Service.create(
  'functionServerInvocationService',
  () => new functionServerInvocationServiceImpl()
).build();
