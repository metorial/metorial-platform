import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { subMinutes } from 'date-fns';
import type {
  Registry,
  Slate,
  SlateVersion,
  SlateVersionStatus
} from '../../prisma/generated/client';
import { db } from '../db';
import { getRegistrySlatePathParams } from '../lib/registrySlatePath';
import { getRegistryClient, getRegistryQuery } from '../registry';

let include = {
  slate: {
    include: {
      registry: true
    }
  },
  specification: true,
  slateVersionAdapters: {
    include: {
      slateAdapter: { include: { adapter: true } },
      slateVersionAdapterCapabilities: { include: { adapterCapability: true } }
    }
  },
  slateDeployments: {
    orderBy: [{ createdAt: 'desc' as const }, { oid: 'desc' as const }],
    take: 1
  }
};

let STALLED_VERSION_STATUSES: SlateVersionStatus[] = ['pending', 'deploying', 'discovering'];
let FAILED_VERSION_STATUSES: SlateVersionStatus[] = ['deployment_failed', 'discovery_failed'];

class slateVersionServiceImpl {
  async getSlateVersionById(d: { slate: Slate; id: string }) {
    let slateVersion = await db.slateVersion.findFirst({
      where: {
        slateOid: d.slate.oid,
        OR: [{ id: d.id }, { version: d.id }]
      },
      include
    });
    if (!slateVersion) throw new ServiceError(notFoundError('slate.version'));
    return slateVersion;
  }

  async getSlateVersionRegistryRecord(d: {
    slateVersion: SlateVersion & { slate: Slate & { registry: Registry } };
  }) {
    let reg = await getRegistryClient(d.slateVersion.slate.registry);
    let { scopeId, slateId } = getRegistrySlatePathParams(d.slateVersion.slate);

    let res = await reg.slates[':scopeId'][':slateId'].versions[':versionId'].$get({
      param: {
        scopeId,
        slateId,
        versionId: d.slateVersion.versionIdentifierOnRegistry
      },
      query: getRegistryQuery()
    });
    if (res.status !== 200)
      throw new ServiceError(
        badRequestError({
          message: `Failed to fetch slate version record from registry: ${res.statusText} (${scopeId}/${slateId}/${d.slateVersion.versionIdentifierOnRegistry})`
        })
      );

    return await res.json();
  }

  async listSlateVersions(d: {
    slate: Slate;
    registryVersionIds?: string[];
    status?: SlateVersionStatus[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateVersion.findMany({
            ...opts,
            where: {
              slateOid: d.slate.oid,
              versionIdOnRegistry: d.registryVersionIds
                ? { in: d.registryVersionIds }
                : undefined,
              status: d.status ? { in: d.status } : undefined
            },
            orderBy: [{ createdAt: 'desc' }, { oid: 'desc' }],
            include
          })
      )
    );
  }

  async listSlateVersionIssues(d: { slate?: Slate; stalledAfterMinutes: number }) {
    let stalledBefore = subMinutes(new Date(), d.stalledAfterMinutes);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateVersion.findMany({
            ...opts,
            where: {
              slateOid: d.slate?.oid,
              slate: { status: 'active' },
              AND: [
                { OR: [{ isCurrent: true }, { willBeCurrent: true }] },
                {
                  OR: [
                    { status: { in: FAILED_VERSION_STATUSES } },
                    {
                      status: { in: STALLED_VERSION_STATUSES },
                      updatedAt: { lt: stalledBefore }
                    }
                  ]
                }
              ]
            },
            orderBy: [{ createdAt: 'desc' }, { oid: 'desc' }],
            include
          })
      )
    );
  }

  async getManySlateVersionsByIds(d: { ids: string[] }) {
    return db.slateVersion.findMany({
      where: {
        id: { in: d.ids }
      },
      include
    });
  }
}

export let slateVersionService = Service.create(
  'slateVersionService',
  () => new slateVersionServiceImpl()
).build();
