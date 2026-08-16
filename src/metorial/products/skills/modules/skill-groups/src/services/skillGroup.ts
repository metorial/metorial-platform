import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { type DateFilter, normalizeDateFilter } from '@metorial/cargo-list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial/skills-search';
import type { Instance, Project } from '@metorial/db';
import { db, ID, type Prisma, withTransaction } from '@metorial/db';
import {
  accessTagService,
  type AnyAccessTagSelector,
  consumerSkillReadRoles
} from '@metorial/module-access';
import { getProjectTenantIdentifier } from '@metorial/skills-common';
import { enqueueSkillGroupLifecycle } from '../queues/lifecycle';

let include = {
  items: {
    where: {
      status: 'active' as const,
      skill: {
        status: 'active' as const
      }
    },
    include: { skill: true },
    orderBy: { createdAt: 'asc' as const }
  }
} satisfies Prisma.SkillGroupInclude;

export type SkillGroupRecord = Prisma.SkillGroupGetPayload<{ include: typeof include }>;

class SkillGroupServiceImpl {
  async getSkillGroupById(d: {
    project: Project;
    instance: Instance;
    skillGroupId: string;
    allowDeleted?: boolean;
    accessTags?: AnyAccessTagSelector;
  }) {
    let accessTagFilter = await accessTagService.getAccessTagFilter({
      tags: d.accessTags,
      roles: [...consumerSkillReadRoles]
    });
    let group = await db.skillGroup.findFirst({
      where: {
        id: d.skillGroupId,
        instanceOid: d.instance.oid,
        status: d.accessTags ? 'active' : d.allowDeleted ? undefined : 'active',
        accessTagEntities: accessTagFilter
      },
      include
    });
    if (!group) throw new ServiceError(notFoundError('skillGroup', d.skillGroupId));
    return group;
  }

  async listSkillGroups(d: {
    project: Project;
    instance: Instance;
    ids?: string[];
    skillIds?: string[];
    statuses?: Array<'active' | 'archived' | 'deleted'>;
    search?: string;
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
    accessTags?: AnyAccessTagSelector;
  }) {
    let accessTagFilter = await accessTagService.getAccessTagFilter({
      tags: d.accessTags,
      roles: [...consumerSkillReadRoles]
    });
    let normalizedSearch = d.search?.trim() || undefined;
    let search = normalizedSearch
      ? await voyager.record.search({
          tenantId: getProjectTenantIdentifier(d.project),
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.skillGroup.id,
          query: normalizedSearch
        })
      : null;
    return Paginator.create(({ prisma }) =>
      prisma(opts =>
        db.skillGroup.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            id: d.ids?.length ? { in: d.ids } : undefined,
            status: d.accessTags
              ? 'active'
              : d.statuses?.length
                ? { in: d.statuses }
                : undefined,
            accessTagEntities: accessTagFilter,
            items: d.skillIds?.length
              ? {
                  some: {
                    status: 'active',
                    skill: {
                      id: { in: d.skillIds },
                      status: 'active'
                    }
                  }
                }
              : undefined,
            createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined,
            updatedAt: d.updatedAt ? normalizeDateFilter(d.updatedAt) : undefined,
            AND: search ? [{ id: { in: search.map(result => result.documentId) } }] : undefined
          },
          include
        })
      )
    );
  }

  async createSkillGroup(d: {
    project: Project;
    instance: Instance;
    input: {
      name: string;
      description?: string | null;
      metadata?: Prisma.InputJsonValue | null;
      skillIds?: string[];
      allowConsumerSkillAssignment?: boolean;
    };
  }) {
    let skills = await db.skill.findMany({
      where: {
        id: { in: d.input.skillIds ?? [] },
        projectOid: d.project.oid,
        instanceOid: d.instance.oid,
        status: 'active'
      }
    });
    return await withTransaction(async db => {
      let group = await db.skillGroup.create({
        data: {
          id: await ID.generateId('skillGroup'),
          name: d.input.name.trim(),
          description: d.input.description,
          metadata: d.input.metadata as any,
          allowConsumerSkillAssignment: d.input.allowConsumerSkillAssignment,
          organizationOid: d.project.organizationOid,
          instanceOid: d.instance.oid
        }
      });
      if (skills.length) {
        await db.skillGroupItem.createMany({
          data: await Promise.all(
            skills.map(async skill => ({
              id: await ID.generateId('skillGroupItem'),
              skillGroupOid: group.oid,
              skillOid: skill.oid
            }))
          )
        });
      }
      let result = await db.skillGroup.findUniqueOrThrow({
        where: { id: group.id },
        include
      });
      await enqueueSkillGroupLifecycle({ skillGroupId: result.id, event: 'created' });
      return result;
    });
  }

  async updateSkillGroup(d: {
    project: Project;
    instance: Instance;
    skillGroupId: string;
    input: {
      name?: string;
      description?: string | null;
      metadata?: Prisma.InputJsonValue | null;
      skillIds?: string[];
      allowConsumerSkillAssignment?: boolean;
    };
  }) {
    let group = await this.getSkillGroupById({ ...d, allowDeleted: true });
    let skills = d.input.skillIds
      ? await db.skill.findMany({
          where: {
            id: { in: d.input.skillIds },
            projectOid: d.project.oid,
            instanceOid: d.instance.oid,
            status: 'active'
          }
        })
      : null;
    return await withTransaction(async db => {
      await db.skillGroup.update({
        where: { id: group.id },
        data: {
          name: d.input.name?.trim(),
          description: d.input.description,
          metadata: d.input.metadata as any,
          allowConsumerSkillAssignment: d.input.allowConsumerSkillAssignment
        }
      });
      if (skills) {
        await db.skillGroupItem.updateMany({
          where: {
            skillGroupOid: group.oid,
            status: 'active',
            skillOid: skills.length ? { notIn: skills.map(skill => skill.oid) } : undefined
          },
          data: { status: 'archived' }
        });
        for (let skill of skills) {
          await db.skillGroupItem.upsert({
            where: {
              skillGroupOid_skillOid: {
                skillGroupOid: group.oid,
                skillOid: skill.oid
              }
            },
            create: {
              id: await ID.generateId('skillGroupItem'),
              skillGroupOid: group.oid,
              skillOid: skill.oid
            },
            update: { status: 'active' }
          });
        }
      }
      let result = await db.skillGroup.findUniqueOrThrow({
        where: { id: group.id },
        include
      });
      await enqueueSkillGroupLifecycle({ skillGroupId: result.id, event: 'updated' });
      return result;
    });
  }

  async archiveSkillGroup(d: { project: Project; instance: Instance; skillGroupId: string }) {
    let group = await this.getSkillGroupById({ ...d, allowDeleted: true });
    return await withTransaction(async db => {
      await db.skillGroupItem.updateMany({
        where: { skillGroupOid: group.oid, status: 'active' },
        data: { status: 'archived' }
      });
      let result = await db.skillGroup.update({
        where: { id: group.id },
        data: { status: 'archived' },
        include
      });
      await enqueueSkillGroupLifecycle({ skillGroupId: result.id, event: 'archived' });
      return result;
    });
  }
}

export let skillGroupService = Service.create(
  'cargoSkillGroupService',
  () => new SkillGroupServiceImpl()
).build();
