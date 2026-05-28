import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Registry, Slate, SlateVersion } from '../../prisma/generated/client';
import { db } from '../db';
import { getRegistrySlatePathParams } from '../lib/registrySlatePath';
import { getRegistryClient, getRegistryQuery } from '../registry';

let include = {
  slate: {
    include: {
      registry: true
    }
  },
  specification: true
};

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

  async listSlateVersions(d: { slate: Slate }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateVersion.findMany({
            ...opts,
            where: {
              slateOid: d.slate.oid
            },
            orderBy: { createdAt: 'desc' },
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
