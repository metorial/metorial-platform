import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '../db';
import { ID } from '../id';
import {
  presentInvokeResponse,
  type FunctionInvokeResponse
} from '../lib/presentInvokeResponse';
import { getProvider } from '../providers';
import { enclaveService } from './enclave';

export type { FunctionInvokeResponse };

let getFunctionData = createLocallyCachedFunction({
  getHash: (i: { tenantId: string; functionId: string; versionId?: string }) =>
    `${i.tenantId}:${i.functionId}:${i.versionId ?? 'current'}`,
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
    enclave?: {
      tenantId: string;
      identifier: string;
    };
  }): Promise<FunctionInvokeResponse> {
    let func = await getFunctionData({
      tenantId: d.tenantId,
      functionId: d.functionId,
      versionId: d.versionId
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

    let invocationTarget = d.enclave
      ? await enclaveService.resolveInvocationOverride({
          enclave: d.enclave,
          function: func,
          sourceVersion: version
        })
      : {
          function: func,
          version
        };

    let provider = getProvider((invocationTarget.version as any).runtime.providerOid);
    let id = await ID.generateId('functionInvocation');

    let res = await provider.invokeFunction({
      function: invocationTarget.function,
      functionVersion: invocationTarget.version as any,
      providerData: (invocationTarget.version as any).providerData,
      payload: d.payload,
      egressPolicy: d.egressPolicy
    });

    return presentInvokeResponse({
      id,
      functionVersionId: invocationTarget.version.id,
      res
    });
  }
}

export let functionInvocationService = Service.create(
  'functionInvocationService',
  () => new functionInvocationServiceImpl()
).build();
