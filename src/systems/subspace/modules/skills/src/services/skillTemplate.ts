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
  type Prisma,
  type SkillTemplate,
  type SkillTemplateOwner,
  type SkillTemplateStatus,
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
import { providerService } from '@metorial-subspace/module-catalog';
import { integrationService } from '@metorial-subspace/module-integration';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { cargo, ensureCargoScope } from '../cargo';
import {
  skillTemplateArchivedQueue,
  skillTemplateCreatedQueue,
  skillTemplateUpdatedQueue
} from '../queues/lifecycle/skillTemplate';
import { skillItemService } from './skillItem';

export let skillTemplateItemInclude = {
  integration: {
    include: {
      item: true,
      integration: true
    }
  },
  provider: {
    include: {
      item: true,
      provider: {
        include: {
          listing: true
        }
      }
    }
  }
};

export let skillTemplateInclude = {
  skillTemplateItems: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: skillTemplateItemInclude
  }
} satisfies Prisma.SkillTemplateInclude;

export type SkillTemplateRecord = Prisma.SkillTemplateGetPayload<{
  include: typeof skillTemplateInclude;
}>;

export type SkillTemplateItemRecord = Prisma.SkillTemplateItemGetPayload<{
  include: typeof skillTemplateItemInclude;
}>;

type SkillTemplateWriteInput = {
  name?: string;
  description?: string | null;
  metadata?: Record<string, any> | null;
  privateMetadata?: Record<string, any> | null;
};

type SkillTemplateItemInput = {
  skillItemId: string;
};

type SkillTemplateItemCreateInput =
  | {
      type: 'provider';
      providerId: string;
    }
  | {
      type: 'integration';
      integrationId: string;
    };

let getSlug = (input: { name: string }) =>
  `${slugify(input.name)}-${generatePlainId(7).toLowerCase()}`.toLowerCase();

class skillTemplateServiceImpl {
  private getAccessibleScope(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    owner?: SkillTemplateOwner[];
  }) {
    let scope: Prisma.SkillTemplateWhereInput[] = [];
    let includeSystem = !d.owner?.length || d.owner.includes('system');
    let includeTenant = !d.owner?.length || d.owner.includes('tenant');

    if (includeSystem) {
      scope.push({
        owner: 'system',
        solutionOid: d.solution.oid,
        tenantOid: null,
        environmentOid: null
      });
    }

    if (includeTenant) {
      scope.push({
        owner: 'tenant',
        solutionOid: d.solution.oid,
        tenantOid: d.tenant.oid,
        environmentOid: d.environment.oid
      });
    }

    return scope;
  }

  private getTemplateUpdateData(d: {
    current: SkillTemplate;
    input: SkillTemplateWriteInput;
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
          : d.input.privateMetadata
    };
  }

  private assertTenantOwnedTemplate(template: SkillTemplate) {
    if (template.owner === 'tenant') return;

    throw new ServiceError(
      badRequestError({
        message: 'System-owned skill templates are read-only.',
        code: 'skill_template_readonly'
      })
    );
  }

  private async getWritableSkillTemplateById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillTemplateId: string;
  }) {
    let skillTemplate = await this.getSkillTemplateById({
      ...d,
      allowDeleted: false
    });

    checkTenant(d, skillTemplate);
    this.assertTenantOwnedTemplate(skillTemplate);
    checkDeletedEdit(skillTemplate, 'update');

    return skillTemplate;
  }

  private async getSkillTemplateItemById(d: {
    skillTemplate: SkillTemplate;
    skillTemplateItemId: string;
  }) {
    let item = await db.skillTemplateItem.findFirst({
      where: {
        id: d.skillTemplateItemId,
        skillTemplateOid: d.skillTemplate.oid
      },
      include: skillTemplateItemInclude
    });
    if (!item) {
      throw new ServiceError(notFoundError('skillTemplateItem', d.skillTemplateItemId));
    }

    return item;
  }

  async listSkillTemplates(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    search?: string;
    status?: SkillTemplateStatus[];
    allowDeleted?: boolean;
    owner?: SkillTemplateOwner[];
    ids?: string[];
    providerIds?: string[];
    integrationIds?: string[];
    createdAt?: DateFilter;
    updatedAt?: DateFilter;
  }) {
    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let accessibleScope = this.getAccessibleScope(d);
    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.skillTemplate.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillTemplate.findMany({
            ...opts,
            where: {
              ...normalizeStatusForList(d).noParent,
              OR: accessibleScope.length ? accessibleScope : undefined,
              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                search ? { id: { in: search.map(r => r.documentId) } } : undefined!,
                d.providerIds
                  ? {
                      skillTemplateItems: {
                        some: {
                          provider: {
                            is: {
                              provider: {
                                id: { in: d.providerIds }
                              }
                            }
                          }
                        }
                      }
                    }
                  : undefined!,
                d.integrationIds
                  ? {
                      skillTemplateItems: {
                        some: {
                          integration: {
                            is: {
                              integration: {
                                id: { in: d.integrationIds }
                              }
                            }
                          }
                        }
                      }
                    }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.updatedAt ? { updatedAt: normalizeDateFilter(d.updatedAt) } : undefined!
              ].filter(Boolean)
            },
            include: skillTemplateInclude
          })
      )
    );
  }

  async getSkillTemplateById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillTemplateId: string;
    allowDeleted?: boolean;
  }) {
    let skillTemplate = await db.skillTemplate.findFirst({
      where: {
        id: d.skillTemplateId,
        ...normalizeStatusForGet(d).noParent,
        OR: this.getAccessibleScope(d)
      },
      include: skillTemplateInclude
    });
    if (!skillTemplate) {
      throw new ServiceError(notFoundError('skillTemplate', d.skillTemplateId));
    }

    return skillTemplate;
  }

  async createSkillTemplate(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: {
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
          message: 'Skill template name is required.',
          code: 'skill_template_name_required'
        })
      );
    }

    let newId = getId('skillTemplate');

    let cargoScope = await ensureCargoScope(d);
    let cargoStore = await cargo.store.create({
      ...cargoScope,
      name: `Skill Template Store - ${name}`,
      access: 'public_read'
    });
    let cargoTemplate = await cargo.skillTemplate.create({
      ...cargoScope,
      name,
      storeId: cargoStore.id,
      skillTemplateId: newId.id
    });

    let skillTemplate = await db.skillTemplate.create({
      data: {
        ...newId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,

        status: 'active',
        owner: 'tenant',

        name,
        slug: getSlug({ name }),
        description: d.input.description?.trim() || null,
        metadata: d.input.metadata,
        privateMetadata: d.input.privateMetadata,

        storeTemplateId: cargoTemplate.storeTemplate.id,
        storeId: cargoStore.id
      },
      include: skillTemplateInclude
    });

    await skillTemplateCreatedQueue.add({ skillTemplateId: skillTemplate.id });

    return skillTemplate;
  }

  async updateSkillTemplate(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillTemplate: SkillTemplate;
    input: SkillTemplateWriteInput;
  }) {
    checkTenant(d, d.skillTemplate);
    this.assertTenantOwnedTemplate(d.skillTemplate);
    checkDeletedEdit(d.skillTemplate, 'update');

    let current = await db.skillTemplate.findUniqueOrThrow({
      where: { oid: d.skillTemplate.oid }
    });

    let cargoScope = await ensureCargoScope(d);

    return await withTransaction(async db => {
      let template = await db.skillTemplate.update({
        where: {
          oid: d.skillTemplate.oid
        },
        data: this.getTemplateUpdateData({
          current,
          input: d.input
        }),
        include: skillTemplateInclude
      });

      await cargo.skillTemplate.update({
        ...cargoScope,
        skillTemplateId: template.id,
        name: template.name
      });

      await addAfterTransactionHook(async () =>
        skillTemplateUpdatedQueue.add({ skillTemplateId: template.id })
      );

      return template;
    });
  }

  async archiveSkillTemplate(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillTemplate: SkillTemplate;
  }) {
    checkTenant(d, d.skillTemplate);
    this.assertTenantOwnedTemplate(d.skillTemplate);
    checkDeletedEdit(d.skillTemplate, 'archive');

    let skillTemplate = await db.skillTemplate.update({
      where: {
        oid: d.skillTemplate.oid
      },
      data: {
        status: 'archived'
      },
      include: skillTemplateInclude
    });

    await skillTemplateArchivedQueue.add({ skillTemplateId: skillTemplate.id });

    return skillTemplate;
  }

  async addSkillTemplateItem(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillTemplateId: string;
    input: SkillTemplateItemInput;
  }) {
    let skillTemplate = await this.getWritableSkillTemplateById(d);
    let skillItem = await skillItemService.getSkillItemById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      skillItemId: d.input.skillItemId,
      allowDeleted: false
    });

    checkDeletedRelation(skillItem);

    if (skillItem.integration) {
      let existing = await db.skillTemplateItem.findFirst({
        where: {
          skillTemplateOid: skillTemplate.oid,
          integrationOid: skillItem.integration.oid
        }
      });
      if (existing) {
        throw new ServiceError(
          badRequestError({
            message: 'Skill item already exists on skill template.',
            code: 'skill_template_item_exists'
          })
        );
      }

      return await withTransaction(async db => {
        await db.skillTemplateItem.create({
          data: {
            ...getId('skillTemplateItem'),
            skillTemplateOid: skillTemplate.oid,
            integrationOid: skillItem.integration!.oid
          }
        });

        await addAfterTransactionHook(async () =>
          skillTemplateUpdatedQueue.add({ skillTemplateId: skillTemplate.id })
        );

        return await db.skillTemplate.findUniqueOrThrow({
          where: { oid: skillTemplate.oid },
          include: skillTemplateInclude
        });
      });
    }

    if (skillItem.provider) {
      let existing = await db.skillTemplateItem.findFirst({
        where: {
          skillTemplateOid: skillTemplate.oid,
          providerOid: skillItem.provider.oid
        }
      });
      if (existing) {
        throw new ServiceError(
          badRequestError({
            message: 'Skill item already exists on skill template.',
            code: 'skill_template_item_exists'
          })
        );
      }

      return await withTransaction(async db => {
        await db.skillTemplateItem.create({
          data: {
            ...getId('skillTemplateItem'),
            skillTemplateOid: skillTemplate.oid,
            providerOid: skillItem.provider!.oid
          }
        });

        await addAfterTransactionHook(async () =>
          skillTemplateUpdatedQueue.add({ skillTemplateId: skillTemplate.id })
        );

        return await db.skillTemplate.findUniqueOrThrow({
          where: { oid: skillTemplate.oid },
          include: skillTemplateInclude
        });
      });
    }

    throw new ServiceError(
      badRequestError({
        message: 'Skill template items must reference a provider or integration skill item.',
        code: 'skill_template_item_invalid'
      })
    );
  }

  async listSkillTemplateItems(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillTemplateId: string;
  }) {
    let skillTemplate = await this.getSkillTemplateById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      skillTemplateId: d.skillTemplateId,
      allowDeleted: false
    });

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillTemplateItem.findMany({
            ...opts,
            where: {
              skillTemplateOid: skillTemplate.oid
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            include: skillTemplateItemInclude
          })
      )
    );
  }

  async getSkillTemplateItem(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillTemplateId: string;
    skillTemplateItemId: string;
  }) {
    let skillTemplate = await this.getSkillTemplateById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      skillTemplateId: d.skillTemplateId,
      allowDeleted: false
    });

    return await this.getSkillTemplateItemById({
      skillTemplate,
      skillTemplateItemId: d.skillTemplateItemId
    });
  }

  async createSkillTemplateItem(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillTemplateId: string;
    input: SkillTemplateItemCreateInput;
  }) {
    let skillTemplate = await this.getWritableSkillTemplateById(d);

    if (d.input.type === 'integration') {
      let integration = await integrationService.getIntegrationById({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        integrationId: d.input.integrationId,
        allowDeleted: false
      });

      checkDeletedRelation(integration);

      let backingIntegration = await db.skillIntegration.findFirst({
        where: {
          integrationOid: integration.oid,
          status: 'active',
          skill: {
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid,
            status: 'active'
          },
          item: {
            status: 'active'
          }
        }
      });
      if (!backingIntegration) {
        throw new ServiceError(
          badRequestError({
            message: 'Integration must exist on an active skill before it can be added to a template.',
            code: 'skill_template_item_missing_skill_item'
          })
        );
      }

      let existing = await db.skillTemplateItem.findFirst({
        where: {
          skillTemplateOid: skillTemplate.oid,
          integrationOid: backingIntegration.oid
        }
      });
      if (existing) {
        throw new ServiceError(
          badRequestError({
            message: 'Skill item already exists on skill template.',
            code: 'skill_template_item_exists'
          })
        );
      }

      return await withTransaction(async db => {
        let item = await db.skillTemplateItem.create({
          data: {
            ...getId('skillTemplateItem'),
            skillTemplateOid: skillTemplate.oid,
            integrationOid: backingIntegration.oid
          },
          include: skillTemplateItemInclude
        });

        await addAfterTransactionHook(async () =>
          skillTemplateUpdatedQueue.add({ skillTemplateId: skillTemplate.id })
        );

        return item;
      });
    }

    let provider = await providerService.getProviderById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      providerId: d.input.providerId,
      includeDeprecated: true
    });

    checkDeletedRelation(provider);

    let backingProvider = await db.skillProvider.findFirst({
      where: {
        providerOid: provider.oid,
        status: 'active',
        skill: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          status: 'active'
        },
        item: {
          status: 'active'
        }
      }
    });
    if (!backingProvider) {
      throw new ServiceError(
        badRequestError({
          message: 'Provider must exist on an active skill before it can be added to a template.',
          code: 'skill_template_item_missing_skill_item'
        })
      );
    }

    let existing = await db.skillTemplateItem.findFirst({
      where: {
        skillTemplateOid: skillTemplate.oid,
        providerOid: backingProvider.oid
      }
    });
    if (existing) {
      throw new ServiceError(
        badRequestError({
          message: 'Skill item already exists on skill template.',
          code: 'skill_template_item_exists'
        })
      );
    }

    return await withTransaction(async db => {
      let item = await db.skillTemplateItem.create({
        data: {
          ...getId('skillTemplateItem'),
          skillTemplateOid: skillTemplate.oid,
          providerOid: backingProvider.oid
        },
        include: skillTemplateItemInclude
      });

      await addAfterTransactionHook(async () =>
        skillTemplateUpdatedQueue.add({ skillTemplateId: skillTemplate.id })
      );

      return item;
    });
  }

  async removeSkillTemplateItem(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillTemplateId: string;
    skillTemplateItemId: string;
  }) {
    let skillTemplate = await this.getWritableSkillTemplateById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      skillTemplateId: d.skillTemplateId
    });

    let item = await db.skillTemplateItem.findFirst({
      where: {
        id: d.skillTemplateItemId,
        skillTemplateOid: skillTemplate.oid
      }
    });
    if (!item) {
      throw new ServiceError(notFoundError('skillTemplateItem', d.skillTemplateItemId));
    }

    return await withTransaction(async db => {
      await db.skillTemplateItem.delete({
        where: {
          oid: item.oid
        }
      });

      await addAfterTransactionHook(async () =>
        skillTemplateUpdatedQueue.add({ skillTemplateId: skillTemplate.id })
      );

      return await db.skillTemplate.findUniqueOrThrow({
        where: { oid: skillTemplate.oid },
        include: skillTemplateInclude
      });
    });
  }

  async deleteSkillTemplateItem(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillTemplateId: string;
    skillTemplateItemId: string;
  }) {
    let skillTemplate = await this.getWritableSkillTemplateById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      skillTemplateId: d.skillTemplateId
    });
    let item = await this.getSkillTemplateItemById({
      skillTemplate,
      skillTemplateItemId: d.skillTemplateItemId
    });

    await withTransaction(async db => {
      await db.skillTemplateItem.delete({
        where: {
          oid: item.oid
        }
      });

      await addAfterTransactionHook(async () =>
        skillTemplateUpdatedQueue.add({ skillTemplateId: skillTemplate.id })
      );
    });

    return item;
  }
}

export let skillTemplateService = Service.create(
  'skillTemplateService',
  () => new skillTemplateServiceImpl()
).build();
