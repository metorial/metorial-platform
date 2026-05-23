import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { db } from '../db';

let include = {
  slate: true,
  slateAuthMethods: {
    include: { authMethod: true }
  },
  slateActions: {
    include: { action: true }
  },
  slateConfigSchemas: {
    include: { configSchema: true }
  }
};

let omit = { authMethods: true, actions: true };

class slateSpecificationServiceImpl {
  async getSlateSpecificationById(d: { id: string }) {
    let slateSpecification = await db.slateSpecification.findFirst({
      where: {
        id: d.id
      },
      include,
      omit
    });
    if (!slateSpecification) throw new ServiceError(notFoundError('slate.specification'));
    return slateSpecification;
  }

  async listSlateSpecifications(d: { slateIds?: string[]; versionIds?: string[] }) {
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
          await db.slateSpecification.findMany({
            ...opts,
            where: {
              slateOid: slates ? { in: slates.map(s => s.oid) } : undefined,

              slateVersions: versions
                ? { some: { oid: { in: versions.map(v => v.oid) } } }
                : undefined
            },
            include,
            omit
          })
      )
    );
  }

  async getManySlateSpecificationsByIds(d: { ids: string[] }) {
    return db.slateSpecification.findMany({
      where: {
        id: { in: d.ids }
      },
      include,
      omit
    });
  }
}

export let slateSpecificationService = Service.create(
  'slateSpecificationService',
  () => new slateSpecificationServiceImpl()
).build();
