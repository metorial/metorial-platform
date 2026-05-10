import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Skill,
  type SkillGroup,
  type SkillStatus,
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
  skillArchivedQueue,
  skillCreatedQueue,
  skillUpdatedQueue
} from '../queues/lifecycle/skill';

export let skillInclude = {
  skillGroup: true,
  parentSkill: true,
  forkedFrom: {
    include: {
      parentSkill: true
    }
  },
  childSkills: {
    where: { status: 'active' as const }
  },
  skillIntegrations: {
    where: { status: 'active' as const },
    include: { integration: true }
  },
  skillProviderLinks: {
    include: {
      provider: {
        include: { listing: true }
      }
    }
  }
};

let getSlug = (input: { name: string }) =>
  `${slugify(input.name)}-${generatePlainId(7).toLowerCase()}`.toLowerCase();

type SkillWriteInput = {
  skillGroupId?: string;
  parentSkillId?: string | null;
  name?: string;
  description?: string | null;
  metadata?: Record<string, any> | null;
  privateMetadata?: Record<string, any> | null;
};

class skillServiceImpl {
  private async resolveSkillGroup(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillGroupId: string;
  }) {
    let skillGroup = await db.skillGroup.findFirst({
      where: {
        id: d.skillGroupId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      }
    });
    if (!skillGroup) throw new ServiceError(notFoundError('skillGroup', d.skillGroupId));

    return skillGroup;
  }

  private async resolveParentSkill(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    parentSkillId: string;
  }) {
    let parentSkill = await db.skill.findFirst({
      where: {
        id: d.parentSkillId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet({ allowDeleted: false }).noParent
      }
    });
    if (!parentSkill) throw new ServiceError(notFoundError('skill', d.parentSkillId));

    checkDeletedRelation(parentSkill);

    return parentSkill;
  }

  private skillCreateData(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillGroup: SkillGroup;
    parentSkill: Skill | null;
    input: Required<Pick<SkillWriteInput, 'name'>> &
      Omit<SkillWriteInput, 'name' | 'skillGroupId' | 'parentSkillId'>;
  }) {
    return {
      ...getId('skill'),
      status: 'active' as const,
      slug: getSlug({ name: d.input.name }),
      name: d.input.name.trim(),
      description: d.input.description?.trim() || null,
      metadata: d.input.metadata,
      privateMetadata: d.input.privateMetadata,
      skillGroupOid: d.skillGroup.oid,
      parentSkillOid: d.parentSkill?.oid ?? null,
      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid,
      environmentOid: d.environment.oid
    };
  }

  private skillUpdateData(d: {
    current: Skill;
    skillGroup: SkillGroup;
    parentSkill: Skill | null;
    input: SkillWriteInput;
  }) {
    return {
      status: 'active' as const,
      name: d.input.name?.trim() || d.current.name,
      description:
        d.input.description === undefined
          ? d.current.description
          : d.input.description?.trim() || null,
      metadata: d.input.metadata === undefined ? d.current.metadata : d.input.metadata,
      privateMetadata:
        d.input.privateMetadata === undefined
          ? d.current.privateMetadata
          : d.input.privateMetadata,
      skillGroupOid: d.skillGroup.oid,
      parentSkillOid:
        d.input.parentSkillId === undefined ? d.current.parentSkillOid : d.parentSkill?.oid ?? null
    };
  }

  async listSkills(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    search?: string;
    status?: SkillStatus[];
    allowDeleted?: boolean;
    ids?: string[];
    skillGroupIds?: string[];
    parentSkillIds?: string[];
    integrationIds?: string[];
    providerIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.skill.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skill.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,
              ...normalizeStatusForList(d).noParent,
              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.skillGroupIds ? { skillGroup: { id: { in: d.skillGroupIds } } } : undefined!,
                d.parentSkillIds ? { parentSkill: { id: { in: d.parentSkillIds } } } : undefined!,
                d.integrationIds
                  ? {
                      skillIntegrations: {
                        some: {
                          status: 'active' as const,
                          integration: { id: { in: d.integrationIds } }
                        }
                      }
                    }
                  : undefined!,
                d.providerIds
                  ? {
                      skillProviderLinks: {
                        some: { provider: { id: { in: d.providerIds } } }
                      }
                    }
                  : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: skillInclude
          })
      )
    );
  }

  async getSkillById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillId: string;
    allowDeleted?: boolean;
  }) {
    let skill = await db.skill.findFirst({
      where: {
        id: d.skillId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: skillInclude
    });
    if (!skill) throw new ServiceError(notFoundError('skill', d.skillId));

    return skill;
  }

  async createSkill(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: {
      skillGroupId: string;
      parentSkillId?: string | null;
      name: string;
      description?: string | null;
      metadata?: Record<string, any> | null;
      privateMetadata?: Record<string, any> | null;
    };
  }) {
    let name = d.input.name.trim();
    if (!name.length) {
      throw new ServiceError(
        badRequestError({
          message: 'Skill name is required.',
          code: 'skill_name_required'
        })
      );
    }

    let [skillGroup, parentSkill] = await Promise.all([
      this.resolveSkillGroup({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        skillGroupId: d.input.skillGroupId
      }),
      d.input.parentSkillId
        ? this.resolveParentSkill({
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            parentSkillId: d.input.parentSkillId
          })
        : null
    ]);

    return await withTransaction(async db => {
      let skill = await db.skill.create({
        data: this.skillCreateData({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          skillGroup,
          parentSkill,
          input: {
            name,
            description: d.input.description,
            metadata: d.input.metadata,
            privateMetadata: d.input.privateMetadata
          }
        }),
        include: skillInclude
      });

      await addAfterTransactionHook(async () => skillCreatedQueue.add({ skillId: skill.id }));

      return skill;
    });
  }

  async forkSkill(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skill: Skill;
    input: {
      skillGroupId?: string;
      name: string;
      description?: string | null;
      metadata?: Record<string, any> | null;
      privateMetadata?: Record<string, any> | null;
    };
  }) {
    checkTenant(d, d.skill);
    checkDeletedRelation(d.skill);

    let skillGroup = d.input.skillGroupId
      ? await this.resolveSkillGroup({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          skillGroupId: d.input.skillGroupId
        })
      : await db.skillGroup.findUniqueOrThrow({
          where: { oid: d.skill.skillGroupOid }
        });

    let createdSkill = await this.createSkill({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      input: {
        skillGroupId: skillGroup.id,
        parentSkillId: d.skill.id,
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,
        privateMetadata: d.input.privateMetadata
      }
    });

    await withTransaction(async db => {
      let existingFork = await db.skillFork.findFirst({
        where: {
          parentSkillOid: d.skill.oid,
          childSkillOid: createdSkill.oid
        }
      });
      if (existingFork) return;

      await db.skillFork.create({
        data: {
          ...getId('skillFork'),
          parentSkillOid: d.skill.oid,
          childSkillOid: createdSkill.oid
        }
      });
    });

    return await db.skill.findUniqueOrThrow({
      where: { oid: createdSkill.oid },
      include: skillInclude
    });
  }

  async updateSkill(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skill: Skill;
    input: SkillWriteInput;
  }) {
    checkTenant(d, d.skill);
    checkDeletedEdit(d.skill, 'update');

    let current = await db.skill.findUniqueOrThrow({
      where: { oid: d.skill.oid }
    });

    let [skillGroup, parentSkill] = await Promise.all([
      d.input.skillGroupId
        ? this.resolveSkillGroup({
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            skillGroupId: d.input.skillGroupId
          })
        : db.skillGroup.findUniqueOrThrow({
            where: { oid: current.skillGroupOid }
          }),
      d.input.parentSkillId
        ? this.resolveParentSkill({
            tenant: d.tenant,
            solution: d.solution,
            environment: d.environment,
            parentSkillId: d.input.parentSkillId
          })
        : d.input.parentSkillId === null
          ? null
          : current.parentSkillOid
            ? await db.skill.findUnique({ where: { oid: current.parentSkillOid } })
            : null
    ]);

    if (parentSkill?.oid === current.oid) {
      throw new ServiceError(
        badRequestError({
          message: 'Skill cannot be its own parent.',
          code: 'skill_parent_self'
        })
      );
    }

    return await withTransaction(async db => {
      let skill = await db.skill.update({
        where: {
          oid: d.skill.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: this.skillUpdateData({
          current,
          skillGroup,
          parentSkill,
          input: d.input
        }),
        include: skillInclude
      });

      await addAfterTransactionHook(async () => skillUpdatedQueue.add({ skillId: skill.id }));

      return skill;
    });
  }

  async archiveSkill(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skill: Skill;
  }) {
    checkTenant(d, d.skill);
    checkDeletedEdit(d.skill, 'archive');

    return await withTransaction(async db => {
      let skill = await db.skill.update({
        where: {
          oid: d.skill.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
        },
        data: { status: 'archived' },
        include: skillInclude
      });

      await Promise.all([
        db.skillItem.updateMany({
          where: { skillOid: skill.oid, status: 'active' },
          data: { status: 'archived' }
        }),
        db.skillIntegration.updateMany({
          where: { skillOid: skill.oid, status: 'active' },
          data: { status: 'archived' }
        }),
        db.skillProvider.updateMany({
          where: { skillOid: skill.oid, status: 'active' },
          data: { status: 'archived' }
        }),
        db.skillProviderLink.deleteMany({
          where: { skillOid: skill.oid }
        })
      ]);

      await addAfterTransactionHook(async () => skillArchivedQueue.add({ skillId: skill.id }));

      return skill;
    });
  }

  async getActiveSkillById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillId: string;
  }) {
    let skill = await this.getSkillById({ ...d, allowDeleted: false });
    checkDeletedRelation(skill);

    return skill;
  }
}

export let skillService = Service.create('skillService', () => new skillServiceImpl()).build();
