import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { FunctionVersion, Runtime } from '../../prisma/generated/client';
import { db } from '../db';
import { ID } from '../id';
import { ensureRehomed } from '../lib/ensureRehomed';
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
    functionTenantId?: string;
    functionId: string;
    versionId?: string;
    payload: Record<string, any>;
    egressPolicy?: PrismaJson.CompiledEgressNetworkAllowList;
    enclave?: {
      identifier: string;
    };
  }): Promise<FunctionInvokeResponse> {
    let func = await getFunctionData({
      tenantId: d.functionTenantId ?? d.tenantId,
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
          tenantId: d.tenantId,
          enclave: d.enclave,
          function: func,
          sourceVersion: version
        })
      : {
          function: func,
          version,
          enclave: undefined
        };

    let targetVersion = await ensureRehomed(
      invocationTarget.version as FunctionVersion & { runtime: Runtime }
    );
    let provider = getProvider(targetVersion.runtime.providerOid);
    let id = await ID.generateId('functionInvocation');

    let res = await provider.invokeFunction({
      invocationId: id,
      tenantId: d.tenantId,
      function: invocationTarget.function,
      sourceFunction: func,
      functionVersion: targetVersion,
      enclave: invocationTarget.enclave
        ? {
            id: invocationTarget.enclave.id,
            identifier: invocationTarget.enclave.identifier
          }
        : undefined,
      providerData: targetVersion.providerData,
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
