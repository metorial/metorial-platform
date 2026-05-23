import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { generatePlainId } from '@mtsrc/id';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import { slugify } from '@mtsrc/slugify';
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
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList
} from '@metorial-subspace/list-utils';
import { voyager, voyagerIndex, voyagerSource } from '@metorial-subspace/module-search';
import { checkTenant } from '@metorial-subspace/module-tenant';
import { cargo, ensureCargoScope } from '../cargo';
import { createStoreForPlainTemplate } from '../definitions';
import {
  skillTemplateArchivedQueue,
  skillTemplateCreatedQueue,
  skillTemplateUpdatedQueue
} from '../queues/lifecycle/skillTemplate';
import { skillService } from './skill';
import { skillTemplateItemInclude, skillTemplateItemService } from './skillTemplateItem';

export let skillTemplateInclude = {
  skillTemplateItems: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: skillTemplateItemInclude
  }
} satisfies Prisma.SkillTemplateInclude;

export type SkillTemplateRecord = Prisma.SkillTemplateGetPayload<{
  include: typeof skillTemplateInclude;
}>;

export type SkillTemplateWithEnrichedStoreId<
  T extends {
    storeId: string | null;
  }
> = T & {
  storeId: string | null;
};

type CargoSkillTemplateSummary = {
  id: string;
  storeId?: string | null;
};

type SkillTemplateWriteInput = {
  name?: string;
  description?: string | null;
  metadata?: Record<string, any> | null;
  privateMetadata?: Record<string, any> | null;
};

let getSlug = (input: { name: string }) =>
  `${slugify(input.name)}-${generatePlainId(7).toLowerCase()}`.toLowerCase();

export let getAccessibleScope = (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  owner?: SkillTemplateOwner[];
}) => {
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
    scope.push({
      owner: 'system',
      solutionOid: null,
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
};

class skillTemplateServiceImpl {
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

  async enrichSkillTemplates<T extends SkillTemplateRecord>(d: {
    tenant: Tenant;
    environment: Environment;
    skillTemplates: T[];
  }): Promise<SkillTemplateWithEnrichedStoreId<T>[]> {
    if (d.skillTemplates.length === 0) return [];

    let cargoScope = await ensureCargoScope(d);
    let cargoTemplates = (await cargo.skillTemplate.getMany({
      ...cargoScope,
      skillTemplateIds: d.skillTemplates.map(template => template.id)
    })) as CargoSkillTemplateSummary[];
    let cargoTemplateById = new Map(cargoTemplates.map(template => [template.id, template]));

    return d.skillTemplates.map(template => ({
      ...template,
      storeId: cargoTemplateById.get(template.id)?.storeId ?? template.storeId
    }));
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

    let accessibleScope = getAccessibleScope(d);
    let search = d.search
      ? await voyager.record.search({
          tenantId: d.tenant.id,
          sourceId: (await voyagerSource).id,
          indexId: voyagerIndex.skillTemplate.id,
          query: d.search
        })
      : null;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let skillTemplates = await db.skillTemplate.findMany({
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
                            id: { in: d.providerIds }
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
                            id: { in: d.integrationIds }
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
        });

        return await this.enrichSkillTemplates({
          tenant: d.tenant,
          environment: d.environment,
          skillTemplates
        });
      })
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
        OR: getAccessibleScope(d)
      },
      include: skillTemplateInclude
    });
    if (!skillTemplate) {
      throw new ServiceError(notFoundError('skillTemplate', d.skillTemplateId));
    }

    let [enrichedSkillTemplate] = await this.enrichSkillTemplates({
      tenant: d.tenant,
      environment: d.environment,
      skillTemplates: [skillTemplate]
    });

    return enrichedSkillTemplate ?? skillTemplate;
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
      skillId?: string;
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
    let sourceSkill = d.input.skillId
      ? await skillService.getActiveSkillById({
          tenant: d.tenant,
          solution: d.solution,
          environment: d.environment,
          skillId: d.input.skillId
        })
      : null;
    let cargoTemplate = sourceSkill
      ? await cargo.skillTemplate.create({
          ...cargoScope,
          name,
          skillId: sourceSkill.id,
          skillTemplateId: newId.id
        })
      : await (async () => {
          let cargoStore = await createStoreForPlainTemplate(cargoScope, name);

          return await cargo.skillTemplate.create({
            ...cargoScope,
            name,
            storeId: cargoStore.id,
            skillTemplateId: newId.id
          });
        })();

    let cargoStoreId = cargoTemplate.storeTemplate.sourceStoreId;
    if (!cargoStoreId) {
      throw new ServiceError(
        badRequestError({
          message: 'Cargo skill template is missing a source store.',
          code: 'skill_template_store_missing'
        })
      );
    }

    let skillTemplate = await withTransaction(async db => {
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
          storeId: cargoStoreId
        }
      });

      if (sourceSkill) {
        let skillTemplateItems =
          await skillTemplateItemService.buildSkillTemplateItemsFromSkill({
            skillOid: sourceSkill.oid,
            skillTemplateOid: skillTemplate.oid
          });

        if (skillTemplateItems.length > 0) {
          await db.skillTemplateItem.createMany({
            data: skillTemplateItems
          });
        }
      }

      return await db.skillTemplate.findUniqueOrThrow({
        where: { oid: skillTemplate.oid },
        include: skillTemplateInclude
      });
    });

    await skillTemplateCreatedQueue.add({ skillTemplateId: skillTemplate.id });

    let [enrichedSkillTemplate] = await this.enrichSkillTemplates({
      tenant: d.tenant,
      environment: d.environment,
      skillTemplates: [skillTemplate]
    });

    return enrichedSkillTemplate ?? skillTemplate;
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

    let template = await withTransaction(async db => {
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

    let [enrichedTemplate] = await this.enrichSkillTemplates({
      tenant: d.tenant,
      environment: d.environment,
      skillTemplates: [template]
    });

    return enrichedTemplate ?? template;
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

    let [enrichedSkillTemplate] = await this.enrichSkillTemplates({
      tenant: d.tenant,
      environment: d.environment,
      skillTemplates: [skillTemplate]
    });

    return enrichedSkillTemplate ?? skillTemplate;
  }
}

export let skillTemplateService = Service.create(
  'skillTemplateService',
  () => new skillTemplateServiceImpl()
).build();
