import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { db } from '../db';

let include = {
  slate: true,
  fromVersion: true,
  toVersion: true,
  fromSpecification: {
    include: {
      slateAuthMethods: { include: { authMethod: true } },
      slateActions: { include: { action: true } }
    }
  },
  toSpecification: {
    include: {
      slateAuthMethods: { include: { authMethod: true } },
      slateActions: { include: { action: true } }
    }
  }
};

class slateSpecificationChangeServiceImpl {
  async getSlateSpecificationChangeById(d: { id: string }) {
    let slateSpecificationChange = await db.slateSpecificationChange.findFirst({
      where: {
        id: d.id
      },
      include
    });
    if (!slateSpecificationChange)
      throw new ServiceError(notFoundError('slate.specification_change'));
    return slateSpecificationChange;
  }

  async listSlateSpecificationChanges(d: { slateIds?: string[]; versionIds?: string[] }) {
    let versions = d.versionIds
      ? await db.slateVersion.findMany({
          where: {
            status: 'active',
            OR: [{ id: { in: d.versionIds } }, { version: { in: d.versionIds } }]
          },
          select: { oid: true }
        })
      : undefined;
    let slates = d.slateIds
      ? await db.slate.findMany({
          where: { id: { in: d.slateIds } },
          select: { oid: true }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateSpecificationChange.findMany({
            ...opts,
            where: {
              slateOid: slates ? { in: slates.map(s => s.oid) } : undefined,

              OR: versions
                ? [
                    { fromVersionOid: { in: versions.map(v => v.oid) } },
                    { toVersionOid: { in: versions.map(v => v.oid) } }
                  ]
                : undefined
            },
            include
          })
      )
    );
  }

  async getManySlateSpecificationChangesByIds(d: { ids: string[] }) {
    return db.slateSpecificationChange.findMany({
      where: {
        id: { in: d.ids }
      },
      include
    });
  }
}

export let slateSpecificationChangeService = Service.create(
  'slateSpecificationChangeService',
  () => new slateSpecificationChangeServiceImpl()
).build();
