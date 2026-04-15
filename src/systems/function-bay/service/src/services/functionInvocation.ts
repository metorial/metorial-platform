import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { getSentry } from '@lowerdeck/sentry';
import { Service } from '@lowerdeck/service';
import type { Function } from '../../prisma/generated/client';
import { db } from '../db';
import { ID, snowflake } from '../id';
import { getProvider } from '../providers';

let Sentry = getSentry();

let include = { functionVersion: true };

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
  }) {
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
      payload: d.payload
    });

    (async () => {
      await db.functionInvocation.create({
        data: {
          oid: snowflake.nextId(),
          id,

          status: res.type === 'success' ? 'succeeded' : 'failed',
          logs: res.logs.map(l => JSON.stringify(l)).join('\n'),

          error: res.type == 'error' ? res.error : null,

          billedTimeMs: res.billedTimeMs,
          computeTimeMs: res.computeTimeMs,

          functionVersionOid: version.oid
        }
      });
    })().catch(e => Sentry.captureException(e));

    if (res.type === 'error') {
      return {
        id,
        type: 'error' as const,
        error: res.error
      };
    }

    return {
      id,
      type: 'success' as const,
      result: res.result
    };
  }

  async getFunctionInvocationById(d: { id: string; function: Function }) {
    let functionInvocation = await db.functionInvocation.findFirst({
      where: {
        id: d.id,
        functionVersion: {
          functionOid: d.function.oid
        }
      },
      include
    });
    if (!functionInvocation) throw new ServiceError(notFoundError('function.invocation'));
    return functionInvocation;
  }

  async listFunctionInvocations(d: { function: Function; functionVersionIds?: string[] }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.functionInvocation.findMany({
            ...opts,
            where: {
              AND: [
                { functionVersion: { functionOid: d.function.oid } },
                ...(d.functionVersionIds
                  ? [{ functionVersion: { id: { in: d.functionVersionIds } } }]
                  : [])
              ]
            },
            include
          })
      )
    );
  }
}

export let functionInvocationService = Service.create(
  'functionInvocationService',
  () => new functionInvocationServiceImpl()
).build();
