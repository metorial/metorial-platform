import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import type { Registry, Slate, SlateVersion } from '../../prisma/generated/client';
import { db } from '../db';
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

    let res = await reg.slates[':scopeId'][':slateId'].versions[':versionId'].$get({
      param: {
        scopeId: d.slateVersion.slate.slateScopeIdentifierOnRegistry,
        slateId: d.slateVersion.slate.slateIdentifierOnRegistry,
        versionId: d.slateVersion.versionIdentifierOnRegistry
      },
      query: getRegistryQuery()
    });
    if (res.status !== 200)
      throw new ServiceError(
        badRequestError({
          message: `Failed to fetch slate record from registry: ${res.statusText}`
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
