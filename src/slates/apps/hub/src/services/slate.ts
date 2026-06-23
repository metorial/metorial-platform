import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Registry, Slate } from '../../prisma/generated/client';
import { db } from '../db';
import { getRegistrySlatePathParams } from '../lib/registrySlatePath';
import { getRegistryClient, getRegistryQuery } from '../registry';

let include = {
  registry: true,
  currentVersion: {
    include: {
      specification: true
    }
  },
  slateVersions: {
    orderBy: [{ createdAt: 'desc' as const }, { oid: 'desc' as const }],
    take: 1,
    include: {
      specification: true
    }
  }
};

class slateServiceImpl {
  async getSlateById(d: { id: string }) {
    let slate = await db.slate.findFirst({
      where: {
        id: d.id,
        status: 'active'
      },
      include
    });
    if (!slate) throw new ServiceError(notFoundError('slate'));
    return slate;
  }

  async getSlateRegistryRecord(d: { slate: Slate & { registry: Registry } }) {
    let reg = await getRegistryClient(d.slate.registry);
    let { scopeId, slateId } = getRegistrySlatePathParams(d.slate);

    let res = await reg.slates[':scopeId'][':slateId'].$get({
      param: {
        scopeId,
        slateId
      },
      query: getRegistryQuery()
    });
    if (res.status !== 200) {
      if (res.status === 404) {
        throw new ServiceError(
          notFoundError({
            message: `Slate not found on registry (${scopeId}/${slateId}). It may have been removed from the registry while still present in the hub.`,
            entity: 'slate'
          })
        );
      }
      throw new ServiceError(
        badRequestError({
          message: `Failed to fetch slate record from registry: ${res.statusText} (${scopeId}/${slateId})`
        })
      );
    }

    return await res.json();
  }

  async listSlates(d: { search?: string }) {
    let search = d.search?.trim();

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slate.findMany({
            ...opts,
            where: {
              status: 'active',
              ...(search
                ? {
                    name: {
                      contains: search,
                      mode: 'insensitive'
                    }
                  }
                : {})
            },
            orderBy: [{ createdAt: 'desc' }, { oid: 'desc' }],
            include
          })
      )
    );
  }

  async getManySlatesByIds(d: { ids: string[] }) {
    return db.slate.findMany({
      where: {
        status: 'active',
        id: { in: d.ids }
      },
      include
    });
  }

  async getSlateStats(d: { slate: Slate }) {
    let [versions, deployments, discoveries, events] = await Promise.all([
      db.slateVersion.count({ where: { slateOid: d.slate.oid } }),
      db.slateDeployment.count({ where: { slateOid: d.slate.oid } }),
      db.slateVersionDiscovery.count({
        where: { slateVersion: { slateOid: d.slate.oid } }
      }),
      db.slateEvent.count({ where: { slateOid: d.slate.oid } })
    ]);

    return { versions, deployments, discoveries, events };
  }
}

export let slateService = Service.create('slateService', () => new slateServiceImpl()).build();
