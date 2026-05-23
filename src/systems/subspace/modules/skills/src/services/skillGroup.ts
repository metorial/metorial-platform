import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Prisma,
  type Skill,
  type SkillGroup,
  type SkillGroupStatus,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  checkDeletedRelation,
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { checkTenant } from '@metorial-subspace/module-tenant';
import {
  skillGroupArchivedQueue,
  skillGroupCreatedQueue,
  skillGroupUpdatedQueue
} from '../queues/lifecycle/skillGroup';
import { skillService } from './skill';

export let skillGroupInclude = {
  skillGroupItems: {
    where: { status: 'active' as const },
    orderBy: { id: 'asc' as const },
    include: {
      skill: true
    }
  }
} satisfies Prisma.SkillGroupInclude;

export type SkillGroupRecord = Prisma.SkillGroupGetPayload<{
  include: typeof skillGroupInclude;
}>;

type SkillGroupWriteInput = {
  name?: string;
  description?: string | null;
  metadata?: Record<string, any> | null;
  skillIds?: string[];
};

class skillGroupServiceImpl {
  private async resolveActiveSkills(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillIds: string[];
  }) {
    let uniqueSkillIds = [...new Set(d.skillIds)];
    let skills: Skill[] = [];

    for (let skillId of uniqueSkillIds) {
      skills.push(
        await skillService.getActiveSkillById({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          skillId
        })
      );
    }

    return skills;
  }

  private getSkillGroupUpdateData(d: { current: SkillGroup; input: SkillGroupWriteInput }) {
    return {
      status: 'active' as const,
      name: d.input.name?.trim() || d.current.name,
      description:
        d.input.description === undefined
          ? d.current.description
          : d.input.description?.trim() || null,
      metadata: d.input.metadata === undefined ? d.current.metadata : d.input.metadata
    };
  }

  private async replaceSkillGroupItems(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillGroup: SkillGroup;
    skills: Skill[];
  }) {
    let desiredSkillOids = d.skills.map(skill => skill.oid);

    await db.skillGroupItem.updateMany({
      where: {
        skillGroupOid: d.skillGroup.oid,
        status: 'active',
        skillOid: desiredSkillOids.length ? { notIn: desiredSkillOids } : undefined
      },
      data: { status: 'archived' }
    });

    if (!d.skills.length) return;

    let existing = await db.skillGroupItem.findMany({
      where: {
        skillGroupOid: d.skillGroup.oid,
        skillOid: { in: desiredSkillOids }
      }
    });
    let existingSkillOids = new Set(existing.map(item => item.skillOid));

    await db.skillGroupItem.updateMany({
      where: {
        skillGroupOid: d.skillGroup.oid,
        skillOid: { in: desiredSkillOids }
      },
      data: { status: 'active' }
    });

    let itemsToCreate = d.skills.filter(skill => !existingSkillOids.has(skill.oid));
    if (!itemsToCreate.length) return;

    await db.skillGroupItem.createMany({
      data: itemsToCreate.map(skill => ({
        ...getId('skillGroupItem'),
        status: 'active' as const,
        skillGroupOid: d.skillGroup.oid,
        skillOid: skill.oid,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      }))
    });
  }

  async listSkillGroups(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    search?: string;
    status?: SkillGroupStatus[];
    allowDeleted?: boolean;
    ids?: string[];
    skillIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.skillGroup.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillGroup.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,
              ...normalizeStatusForList(d).noParent,
              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                d.skillIds
                  ? {
                      skillGroupItems: {
                        some: {
                          status: 'active' as const,
                          skill: { id: { in: d.skillIds } }
                        }
                      }
                    }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: skillGroupInclude
          })
      )
    );
  }

  async getSkillGroupById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillGroupId: string;
    allowDeleted?: boolean;
  }) {
    let skillGroup = await db.skillGroup.findFirst({
      where: {
        id: d.skillGroupId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: skillGroupInclude
    });
    if (!skillGroup) throw new ServiceError(notFoundError('skillGroup', d.skillGroupId));

    return skillGroup;
  }

  async createSkillGroup(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: {
      name: string;
      description?: string | null;
      metadata?: Record<string, any> | null;
      skillIds?: string[];
    };
  }) {
    let name = d.input.name.trim();
    if (!name.length) {
      throw new ServiceError(
        badRequestError({
          message: 'Skill group name is required.',
          code: 'skill_group_name_required'
        })
      );
    }

    let skills = await this.resolveActiveSkills({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      skillIds: d.input.skillIds ?? []
    });

    return await withTransaction(async db => {
      let skillGroup = await db.skillGroup.create({
        data: {
          ...getId('skillGroup'),
          status: 'active',
          name,
          description: d.input.description?.trim() || null,
          metadata: d.input.metadata,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        }
      });

      await this.replaceSkillGroupItems({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        skillGroup,
        skills
      });

      await addAfterTransactionHook(async () =>
        skillGroupCreatedQueue.add({ skillGroupId: skillGroup.id })
      );

      return await db.skillGroup.findUniqueOrThrow({
        where: { oid: skillGroup.oid },
        include: skillGroupInclude
      });
    });
  }

  async updateSkillGroup(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillGroup: SkillGroup;
    input: SkillGroupWriteInput;
  }) {
    checkTenant(d, d.skillGroup);
    checkDeletedEdit(d.skillGroup, 'update');

    let current = await db.skillGroup.findUniqueOrThrow({
      where: { oid: d.skillGroup.oid }
    });

    let skills = d.input.skillIds
      ? await this.resolveActiveSkills({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          skillIds: d.input.skillIds
        })
      : null;

    return await withTransaction(async db => {
      let skillGroup = await db.skillGroup.update({
        where: {
          oid: d.skillGroup.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: this.getSkillGroupUpdateData({ current, input: d.input })
      });

      if (skills) {
        await this.replaceSkillGroupItems({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          skillGroup,
          skills
        });
      }

      await addAfterTransactionHook(async () =>
        skillGroupUpdatedQueue.add({ skillGroupId: skillGroup.id })
      );

      return await db.skillGroup.findUniqueOrThrow({
        where: { oid: skillGroup.oid },
        include: skillGroupInclude
      });
    });
  }

  async archiveSkillGroup(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillGroup: SkillGroup;
  }) {
    checkTenant(d, d.skillGroup);
    checkDeletedEdit(d.skillGroup, 'archive');

    return await withTransaction(async db => {
      let skillGroup = await db.skillGroup.update({
        where: {
          oid: d.skillGroup.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: { status: 'archived' },
        include: skillGroupInclude
      });

      await db.skillGroupItem.updateMany({
        where: {
          skillGroupOid: skillGroup.oid,
          status: 'active'
        },
        data: { status: 'archived' }
      });

      await addAfterTransactionHook(async () =>
        skillGroupArchivedQueue.add({ skillGroupId: skillGroup.id })
      );

      return skillGroup;
    });
  }

  async getActiveSkillGroupById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillGroupId: string;
  }) {
    let skillGroup = await this.getSkillGroupById({ ...d, allowDeleted: false });
    checkDeletedRelation(skillGroup);

    return skillGroup;
  }
}

export let skillGroupService = Service.create(
  'skillGroupService',
  () => new skillGroupServiceImpl()
).build();
