import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import {
  addAfterTransactionHook,
  db,
  type EntityImage,
  type Environment,
  getId,
  type Prisma,
  type Skill,
  type SkillStatus,
  type SkillTemplate,
  type Solution,
  type Tenant,
  type TenantActor,
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
import { cargo, ensureCargoActor, ensureCargoScope } from '../cargo';
import { plainTemplate } from '../definitions';
import { inferClientName, normalizeSkillClientFields } from '../lib/clientMetadata';
import {
  skillArchivedQueue,
  skillCreatedQueue,
  skillUpdatedQueue
} from '../queues/lifecycle/skill';
import { skillTemplateService } from './skillTemplate';

export let skillInclude = {
  skillEntity: {
    include: {
      ownerSkill: true
    }
  },
  duplicatedFromSkill: true,
  fork: {
    include: {
      parentSkill: {
        include: {
          ownerTenantActor: true
        }
      }
    }
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
  },
  ownerTenantActor: true
};

let getSlug = (input: { name: string }) =>
  `${slugify(input.name)}-${generatePlainId(7).toLowerCase()}`.toLowerCase();

type SkillWriteInput = {
  name?: string;
  description?: string | null;
  image?: EntityImage | null;
  imageFileId?: string | null;
  clientName?: string;
  clientDescription?: string;
  license?: string | null;
  compatibility?: string | null;
  clientMetadata?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  privateMetadata?: Record<string, any> | null;
};

class skillServiceImpl {
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
      },
      include: { skillEntity: true }
    });
    if (!parentSkill) throw new ServiceError(notFoundError('skill', d.parentSkillId));

    checkDeletedRelation(parentSkill);

    return parentSkill;
  }

  private skillCreateData(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    parentSkill: {
      type: 'fork' | 'duplicate';
      skill: Skill;
    } | null;
    template: SkillTemplate | null;
    input: Required<Pick<SkillWriteInput, 'name'>> &
      Omit<SkillWriteInput, 'name' | 'skillEntityId' | 'parentSkillId'>;
  }) {
    let inferredClientName = inferClientName(d.input.name);

    let clientFields = normalizeSkillClientFields({
      current: {
        clientName: null,
        clientDescription: null,
        license: null,
        compatibility: null,
        clientMetadata: null
      },
      inferredClientName,
      input: {
        clientName: d.input.clientName,
        clientDescription: d.input.clientDescription,
        license: d.input.license,
        compatibility: d.input.compatibility,
        clientMetadata: d.input.clientMetadata
      }
    });

    let res = {
      ...getId('skill'),
      status: 'active' as const,
      slug: getSlug({ name: d.input.name }),
      name: d.input.name.trim(),
      description: d.input.description?.trim() || null,
      image: d.input.image,
      clientName: clientFields.clientName,
      clientDescription: clientFields.clientDescription,
      license: clientFields.license,
      compatibility: clientFields.compatibility,
      clientMetadata: clientFields.clientMetadata,
      metadata: d.input.metadata,
      privateMetadata: d.input.privateMetadata,
      tenantOid: d.tenant.oid,
      solutionOid: d.solution.oid,
      environmentOid: d.environment.oid,
      forkedFromSkillOid: null as bigint | null,
      duplicatedFromSkillOid: null as bigint | null
    } satisfies Partial<Skill>;

    if (d.parentSkill?.type === 'fork') {
      res.forkedFromSkillOid = d.parentSkill.skill.oid;
    } else if (d.parentSkill?.type === 'duplicate') {
      res.duplicatedFromSkillOid = d.parentSkill.skill.oid;
    }

    return res;
  }

  private skillUpdateData(d: { current: Skill; input: SkillWriteInput }) {
    let nextName = d.input.name?.trim() || d.current.name;
    let inferredCurrentClientName = inferClientName(d.current.name);
    let inferredNextClientName = inferClientName(nextName);
    let shouldAutoUpdateClientName =
      d.input.clientName === undefined && d.current.clientName === inferredCurrentClientName;

    let clientFields = normalizeSkillClientFields({
      current: {
        clientName: shouldAutoUpdateClientName ? inferredNextClientName : d.current.clientName,
        clientDescription: d.current.clientDescription,
        license: d.current.license,
        compatibility: d.current.compatibility,
        clientMetadata: d.current.clientMetadata
      },
      inferredClientName: inferredNextClientName,
      input: {
        clientName: d.input.clientName,
        clientDescription: d.input.clientDescription,
        license: d.input.license,
        compatibility: d.input.compatibility,
        clientMetadata: d.input.clientMetadata
      }
    });

    return {
      status: 'active' as const,
      name: d.input.name?.trim() || d.current.name,
      description:
        d.input.description === undefined
          ? d.current.description
          : d.input.description?.trim() || null,
      image: d.input.image === undefined ? d.current.image : d.input.image,
      clientName: clientFields.clientName,
      clientDescription: clientFields.clientDescription,
      license: clientFields.license,
      compatibility: clientFields.compatibility,
      clientMetadata: clientFields.clientMetadata,
      metadata: d.input.metadata === undefined ? d.current.metadata : d.input.metadata,
      privateMetadata:
        d.input.privateMetadata === undefined
          ? d.current.privateMetadata
          : d.input.privateMetadata
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
                d.skillGroupIds
                  ? {
                      skillGroupItems: {
                        some: {
                          status: 'active' as const,
                          skillGroup: {
                            id: { in: d.skillGroupIds },
                            status: 'active' as const
                          }
                        }
                      }
                    }
                  : undefined!,
                d.parentSkillIds
                  ? { parentSkill: { id: { in: d.parentSkillIds } } }
                  : undefined!,
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

  async getManySkills(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillIds: string[];
    allowDeleted?: boolean;
  }) {
    if (!d.skillIds.length) {
      return [];
    }

    let skills = await db.skill.findMany({
      where: {
        id: {
          in: d.skillIds
        },
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent
      },
      include: skillInclude
    });
    let byId = new Map(skills.map(skill => [skill.id, skill]));

    return d.skillIds
      .map(skillId => byId.get(skillId))
      .filter((skill): skill is NonNullable<typeof skill> => !!skill);
  }

  async createSkill(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: {
      name: string;
      description?: string | null;
      clientName?: string;
      clientDescription?: string;
      license?: string | null;
      compatibility?: string | null;
      clientMetadata?: Record<string, any> | null;
      metadata?: Record<string, any> | null;
      privateMetadata?: Record<string, any> | null;
      templateId?: string | null;
      image?: EntityImage | null;
      imageFileId?: string | null;
    };
    _operation:
      | {
          type: 'fork';
          parentSkillId: string;
          tenantActor: TenantActor;
        }
      | {
          type: 'duplicate';
          tenantActor?: TenantActor;
          parentSkillId: string;
        }
      | {
          type: 'create';
          tenantActor?: TenantActor;
          parentSkillId?: never;
        };
  }) {
    if (
      d.input.templateId &&
      (d._operation.type === 'fork' || d._operation.type === 'duplicate')
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot specify a template when forking or duplicating a skill.',
          code: 'template_not_allowed_for_fork_or_duplicate'
        })
      );
    }

    let parentSkill = d._operation?.parentSkillId
      ? await this.resolveParentSkill({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          parentSkillId: d._operation.parentSkillId
        })
      : null;

    let template = d.input.templateId
      ? await skillTemplateService.getSkillTemplateById({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          skillTemplateId: d.input.templateId,
          allowDeleted: false
        })
      : parentSkill
        ? null
        : await plainTemplate;

    let skillData = this.skillCreateData({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      template,
      parentSkill:
        parentSkill && d._operation
          ? {
              type: d._operation.type === 'fork' ? 'fork' : 'duplicate',
              skill: parentSkill
            }
          : null,
      input: {
        name: d.input.name.trim(),
        description: d.input.description?.trim() || null,
        clientName: d.input.clientName,
        clientDescription: d.input.clientDescription,
        license: d.input.license,
        compatibility: d.input.compatibility,
        clientMetadata: d.input.clientMetadata,
        metadata: d.input.metadata,
        privateMetadata: d.input.privateMetadata,
        image: d.input.image
      }
    });

    let cargoScope = await ensureCargoScope(d);
    let cargoActor = d._operation.tenantActor
      ? await ensureCargoActor(cargoScope, d._operation.tenantActor)
      : undefined;

    let cargoSkill = await cargo.skill.create({
      ...cargoScope,
      skillId: skillData.id,
      name: skillData.name,
      imageFileId: d.input.imageFileId,
      actorId: cargoActor?.id,
      parentSkill: parentSkill
        ? {
            skillId: parentSkill.id,
            type: d._operation?.type === 'fork' ? 'fork' : 'duplicate'
          }
        : undefined,
      parentSkillTemplateId: template?.id
    });

    return await withTransaction(async db => {
      // Forks share the parent skill entity. Root skills and duplicates get a new one.
      let skillEntity =
        d._operation?.type === 'fork' && parentSkill?.skillEntity
          ? parentSkill?.skillEntity
          : null;
      let isNewSkillEntity = !skillEntity;

      if (!skillEntity) {
        skillEntity = await db.skillEntity.create({
          data: {
            ...getId('skillEntity'),
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            name: skillData.name,
            description: skillData.description,
            image: (d.input.image ?? (cargoSkill.image as EntityImage | null) ?? undefined) as any,
            slug: skillData.slug
          }
        });
      }

      let skill = await db.skill.create({
        data: {
          ...skillData,
          image: (d.input.image ?? (cargoSkill.image as EntityImage | null) ?? undefined) as any,
          ownerTenantActorOid: d._operation.tenantActor?.oid,
          storeId: cargoSkill.storeId,
          skillEntityOid: skillEntity.oid
        },
        include: skillInclude
      });

      if (isNewSkillEntity) {
        skillEntity = await db.skillEntity.update({
          where: { oid: skillEntity.oid },
          data: { ownerSkillOid: skill.oid }
        });
      }

      if (d._operation?.type === 'fork') {
        await db.skillFork.create({
          data: {
            ...getId('skillFork'),
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            parentSkillOid: parentSkill!.oid,
            childSkillOid: skill.oid,
            tenantActorOid: d._operation.tenantActor.oid
          }
        });
      }

      await addAfterTransactionHook(async () => skillCreatedQueue.add({ skillId: skill.id }));

      return await db.skill.findUniqueOrThrow({
        where: { oid: skill.oid },
        include: skillInclude
      });
    });
  }

  async forkSkill(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skill: Skill;
    tenantActor: TenantActor;
    input: {
      name: string;
      description?: string | null;
      clientName?: string;
      clientDescription?: string;
      license?: string | null;
      compatibility?: string | null;
      clientMetadata?: Record<string, any> | null;
      metadata?: Record<string, any> | null;
      privateMetadata?: Record<string, any> | null;
      imageFileId?: string | null;
    };
  }) {
    checkTenant(d, d.skill);
    checkDeletedRelation(d.skill);

    return await this.createSkill({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      input: {
        name: d.input.name,
        description: d.input.description,
        clientName: d.input.clientName,
        clientDescription: d.input.clientDescription,
        license: d.input.license,
        compatibility: d.input.compatibility,
        clientMetadata: d.input.clientMetadata,
        metadata: d.input.metadata,
        privateMetadata: d.input.privateMetadata,
        imageFileId: d.input.imageFileId
      },
      _operation: {
        type: 'fork',
        parentSkillId: d.skill.id,
        tenantActor: d.tenantActor
      }
    });
  }

  async duplicateSkill(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skill: Skill;
    actor?: TenantActor;
    input: {
      name: string;
      description?: string | null;
      clientName?: string;
      clientDescription?: string;
      license?: string | null;
      compatibility?: string | null;
      clientMetadata?: Record<string, any> | null;
      metadata?: Record<string, any> | null;
      privateMetadata?: Record<string, any> | null;
      imageFileId?: string | null;
    };
  }) {
    checkTenant(d, d.skill);
    checkDeletedRelation(d.skill);

    return await this.createSkill({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      input: {
        name: d.input.name,
        description: d.input.description,
        clientName: d.input.clientName,
        clientDescription: d.input.clientDescription,
        license: d.input.license,
        compatibility: d.input.compatibility,
        clientMetadata: d.input.clientMetadata,
        metadata: d.input.metadata,
        privateMetadata: d.input.privateMetadata,
        imageFileId: d.input.imageFileId
      },
      _operation: {
        type: 'duplicate',
        parentSkillId: d.skill.id,
        tenantActor: d.actor
      }
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
    let input = d.input;

    if (d.input.imageFileId !== undefined) {
      let cargoScope = await ensureCargoScope(d);
      let cargoSkill = await cargo.skill.update({
        ...cargoScope,
        skillId: d.skill.id,
        imageFileId: d.input.imageFileId
      });

      input = {
        ...input,
        image: cargoSkill.image as EntityImage | null
      };
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
          input
        }) as Prisma.SkillUpdateInput,
        include: skillInclude
      });

      if (skill.skillEntity.ownerSkillOid === skill.oid) {
        await db.skillEntity.update({
          where: { oid: skill.skillEntity.oid },
          data: {
            name: skill.name,
            description: skill.description,
            image: (skill.image ?? undefined) as any,
            slug: skill.slug
          }
        });
      }

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

  async upsertSkillActor(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skill: Skill;
    tenantActor: TenantActor;
    permissions: Array<'content_read' | 'content_write'>;
  }) {
    checkTenant(d, d.skill);
    checkDeletedRelation(d.skill);

    let cargoScope = await ensureCargoScope(d);
    let cargoActor = await ensureCargoActor(cargoScope, d.tenantActor);

    return await cargo.skill.upsertActor({
      ...cargoScope,
      skillId: d.skill.id,
      actorId: cargoActor.id,
      permissions: d.permissions
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
