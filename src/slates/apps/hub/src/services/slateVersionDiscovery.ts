import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Slate } from '../../prisma/generated/client';
import { db } from '../db';

let include = {
  slateVersion: {
    include: {
      slate: true
    }
  },
  specification: true,
  invocation: true
};

class slateVersionDiscoveryServiceImpl {
  async getSlateVersionDiscoveryById(d: { slate: Slate; id: string }) {
    let slateVersionDiscovery = await db.slateVersionDiscovery.findFirst({
      where: {
        slateVersion: { slateOid: d.slate.oid },
        id: d.id
      },
      include
    });
    if (!slateVersionDiscovery)
      throw new ServiceError(notFoundError('slate.version_discovery'));
    return slateVersionDiscovery;
  }

  async listSlateVersionDiscoveries(d: { slate: Slate; versionIds?: string[] }) {
    let versions = d.versionIds
      ? await db.slateVersion.findMany({
          where: {
            status: 'active',
            OR: [{ id: { in: d.versionIds } }, { version: { in: d.versionIds } }]
          },
          select: { oid: true }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateVersionDiscovery.findMany({
            ...opts,
            where: {
              slateVersion: {
                slateOid: d.slate.oid,
                oid: versions ? { in: versions.map(v => v.oid) } : undefined
              }
            },
            include
          })
      )
    );
  }
}

export let slateVersionDiscoveryService = Service.create(
  'slateVersionDiscoveryService',
  () => new slateVersionDiscoveryServiceImpl()
).build();
