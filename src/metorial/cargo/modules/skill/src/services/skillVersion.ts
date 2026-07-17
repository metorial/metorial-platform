import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveSkillVersions,
  resolveStoreVersions
} from '@metorial/cargo-list-utils';
import type { ResourceScope } from '@metorial/module-resource-tenant';
import type { Prisma } from '@metorial/db';
import { db } from '@metorial/db';

let skillVersionInclude = {
  skill: {
    select: {
      id: true,
      store: {
        select: {
          id: true
        }
      }
    }
  },
  storeVersion: {
    select: {
      id: true
    }
  }
} satisfies Prisma.SkillVersionInclude;

let skillVersionSnapshotInclude = {
  skill: {
    select: {
      id: true,
      store: {
        select: {
          id: true
        }
      }
    }
  },
  storeVersion: {
    include: {
      items: {
        include: {
          file: {
            select: {
              id: true
            }
          },
          document: {
            select: {
              id: true
            }
          },
          documentVersion: {
            select: {
              id: true,
              content: {
                select: {
                  content: true
                }
              }
            }
          }
        },
        orderBy: [
          {
            path: 'asc'
          },
          {
            id: 'asc'
          }
        ]
      }
    }
  }
} satisfies Prisma.SkillVersionInclude;

export type SkillVersionRecord = Prisma.SkillVersionGetPayload<{
  include: typeof skillVersionInclude;
}>;

type SkillVersionSnapshotRecord = Prisma.SkillVersionGetPayload<{
  include: typeof skillVersionSnapshotInclude;
}>;

export type SkillVersionSnapshotItem = {
  id: string;
  kind: 'file' | 'document' | 'directory';
  path: string;
  fileId?: string;
  documentId?: string;
  documentVersionId?: string;
  content?: string;
  createdAt: Date;
};

export type SkillVersionSnapshot = {
  id: string;
  skillId: string;
  storeId: string;
  storeVersionId: string;
  versionNumber: number;
  createdAt: Date;
  items: SkillVersionSnapshotItem[];
};

let toSkillVersionSnapshot = (version: SkillVersionSnapshotRecord): SkillVersionSnapshot => ({
  id: version.id,
  skillId: version.skill.id,
  storeId: version.skill.store!.id,
  storeVersionId: version.storeVersion.id,
  versionNumber: version.versionNumber,
  createdAt: version.createdAt,
  items: version.storeVersion.items.map(item => ({
    id: item.id,
    kind: item.kind,
    path: item.path,
    fileId: item.file?.id ?? undefined,
    documentId: item.document?.id ?? undefined,
    documentVersionId: item.documentVersion?.id ?? undefined,
    content: item.documentVersion?.content.content ?? undefined,
    createdAt: item.createdAt
  }))
});

class SkillVersionServiceImpl {
  private async getSkill(d: ResourceScope & { skillId: string }) {
    let skill = await db.skill.findFirst({
      where: {
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid,
        id: d.skillId
      },
      select: {
        oid: true,
        id: true
      }
    });

    if (!skill) throw new ServiceError(notFoundError('skill', d.skillId));

    return skill;
  }

  async listSkillVersions(
    d: ResourceScope & {
      skillId: string;
      ids?: string[];
      storeVersionIds?: string[];
      createdAt?: DateFilter;
    }
  ) {
    let skill = await this.getSkill(d);
    let skillVersions = await resolveSkillVersions(d, d.ids);
    let storeVersions = await resolveStoreVersions(d, d.storeVersionIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillVersion.findMany({
            ...opts,
            where: {
              skillOid: skill.oid,
              oid: skillVersions ? skillVersions.in : undefined,
              storeVersionOid: storeVersions ? storeVersions.in : undefined,
              createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined
            },
            include: skillVersionInclude,
            orderBy: {
              versionNumber: 'desc'
            }
          })
      )
    );
  }

  async getSkillVersionById(
    d: ResourceScope & {
      skillVersionId: string;
    }
  ) {
    let version = await db.skillVersion.findFirst({
      where: {
        id: d.skillVersionId,
        skill: {
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid
        }
      },
      include: skillVersionInclude
    });

    if (!version) throw new ServiceError(notFoundError('skill.version', d.skillVersionId));

    return version;
  }

  async getSkillVersionSnapshot(
    d: ResourceScope & {
      skillId: string;
      skillVersionId: string;
    }
  ) {
    let version = await db.skillVersion.findFirst({
      where: {
        id: d.skillVersionId,
        skill: {
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid,
          id: d.skillId
        }
      },
      include: skillVersionSnapshotInclude
    });

    if (!version) throw new ServiceError(notFoundError('skill.version', d.skillVersionId));

    return toSkillVersionSnapshot(version);
  }
}

export let skillVersionService = Service.create(
  'cargoSkillVersionService',
  () => new SkillVersionServiceImpl()
).build();
