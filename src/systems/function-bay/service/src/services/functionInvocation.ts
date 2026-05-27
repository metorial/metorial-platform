import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { ID } from '../id';
import {
  presentInvokeResponse,
  type FunctionInvokeResponse
} from '../lib/presentInvokeResponse';

export type { FunctionInvokeResponse };
import { getProvider } from '../providers';

let getFunctionData = createLocallyCachedFunction({
  getHash: (i: { tenantId: string; functionId: string; versionId?: string }) =>
    `${i.tenantId}:${i.functionId}`,
  provider: async i =>
    await db.function.findFirst({
      where: {
        OR: [{ id: i.functionId }, { identifier: i.functionId }],
        tenant: { OR: [{ id: i.tenantId }, { identifier: i.tenantId }] }
      },
      include: {
        currentVersion: {
          include: { runtime: true }
        },
        functionVersions: i.versionId
          ? {
              where: { OR: [{ id: i.versionId }, { identifier: i.versionId }] },
              include: { runtime: true }
            }
          : undefined
      }
    }),
  ttlSeconds: 60
});

class functionInvocationServiceImpl {
  async invokeFunction(d: {
    tenantId: string;
    functionId: string;
    versionId?: string;
    payload: Record<string, any>;
    egressPolicy?: {
      allowedIps?: string[];
      allowedHosts?: string[];
    };
  }): Promise<FunctionInvokeResponse> {
    let func = await getFunctionData({
      tenantId: d.tenantId,
      functionId: d.functionId
    });
    if (!func) throw new ServiceError(notFoundError('function'));

    let version = func.functionVersions?.length
      ? func.functionVersions[0]
      : func.currentVersion;
    if (!version) {
      if (d.versionId) {
        throw new ServiceError(notFoundError('function.version'));
      }

      throw new ServiceError(
        preconditionFailedError({
          message: 'Function has no versions deployed'
        })
      );
    }

    let provider = getProvider((version as any).runtime.providerOid);

    let id = await ID.generateId('functionInvocation');

    let res = await provider.invokeFunction({
      function: func,
      functionVersion: version,
      providerData: version.providerData,
      payload: d.payload,
      egressPolicy: d.egressPolicy
    });

    return presentInvokeResponse({
      id,
      functionVersionId: version.id,
      res
    });
  }
}

export let functionInvocationService = Service.create(
  'functionInvocationService',
  () => new functionInvocationServiceImpl()
).build();
