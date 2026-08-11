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
  type DateFilter,
  normalizeDateFilter,
  normalizeStatusForGet,
  normalizeStatusForList
} from '@metorial-subspace/list-utils';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
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

export type GetManySkillTemplatesParams = {
  tenant: Tenant;
  environment: Environment;
  skillTemplateIds: string[];
  allowDeleted?: boolean;
};

export type UpsertMetorialSkillTemplateParams = {
  tenant: Tenant;
  environment: Environment;
  input: {
    id: string;
    status: SkillTemplateStatus;
    owner: SkillTemplateOwner;
    slug: string;
    name: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
    storeId?: string | null;
    storeTemplateId: string;
    systemIdentifier?: string | null;
    sourceSkillId?: string | null;
  };
};

export type ListSkillTemplatesParams = {
  tenant: Tenant;
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
};

export type GetSkillTemplateByIdParams = {
  tenant: Tenant;
  environment: Environment;
  skillTemplateId: string;
  allowDeleted?: boolean;
};

export type CreateSkillTemplateParams = {
  tenant: Tenant;
  environment: Environment;
  input: {
    name: string;
    description?: string | null;
    metadata?: Record<string, any> | null;
    privateMetadata?: Record<string, any> | null;
    skillId?: string;
  };
};

export type UpdateSkillTemplateParams = {
  tenant: Tenant;
  environment: Environment;
  skillTemplate: SkillTemplate;
  input: SkillTemplateWriteInput;
};

export type ArchiveSkillTemplateParams = {
  tenant: Tenant;
  environment: Environment;
  skillTemplate: SkillTemplate;
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

    return d.skillTemplates;
  }

  async getManySkillTemplates(d: MetorialFacing<GetManySkillTemplatesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.getManySkillTemplatesInternal({ ...rest, tenant, environment });
  }

  async getManySkillTemplatesInternal(d: GetManySkillTemplatesParams) {
    if (!d.skillTemplateIds.length) return [];
    let solution = await getMetorialSolution();
    return await db.skillTemplate.findMany({
      where: {
        id: { in: d.skillTemplateIds },
        ...normalizeStatusForGet(d).noParent,
        OR: getAccessibleScope({ ...d, solution })
      },
      include: skillTemplateInclude
    });
  }

  async upsertMetorialSkillTemplate(d: MetorialFacing<UpsertMetorialSkillTemplateParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.upsertMetorialSkillTemplateInternal({ ...rest, tenant, environment });
  }

  async upsertMetorialSkillTemplateInternal(d: UpsertMetorialSkillTemplateParams) {
    let solution = await getMetorialSolution();

    let existing = await db.skillTemplate.findUnique({ where: { id: d.input.id } });
    let sourceSkill = d.input.sourceSkillId
      ? await skillService.getActiveSkillByIdInternal({
          tenant: d.tenant,
          environment: d.environment,
          skillId: d.input.sourceSkillId
        })
      : null;

    let template = await withTransaction(async db => {
      let template = await db.skillTemplate.upsert({
        where: { id: d.input.id },
        create: {
          ...getId('skillTemplate'),
          id: d.input.id,
          status: d.input.status,
          owner: d.input.owner,
          slug: d.input.slug,
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata as any,
          storeId: d.input.storeId,
          storeTemplateId: d.input.storeTemplateId,
          systemIdentifier: d.input.systemIdentifier,
          tenantOid: d.input.owner === 'tenant' ? d.tenant.oid : null,
          solutionOid: d.input.owner === 'tenant' ? solution.oid : null,
          environmentOid: d.input.owner === 'tenant' ? d.environment.oid : null
        },
        update: {
          status: d.input.status,
          owner: d.input.owner,
          slug: d.input.slug,
          name: d.input.name,
          description: d.input.description,
          metadata: d.input.metadata as any,
          storeId: d.input.storeId,
          storeTemplateId: d.input.storeTemplateId,
          systemIdentifier: d.input.systemIdentifier
        },
        include: skillTemplateInclude
      });

      if (sourceSkill && !existing) {
        let items = await skillTemplateItemService.buildSkillTemplateItemsFromSkill({
          skillOid: sourceSkill.oid,
          skillTemplateOid: template.oid
        });
        if (items.length) await db.skillTemplateItem.createMany({ data: items });
      }

      return await db.skillTemplate.findUniqueOrThrow({
        where: { id: template.id },
        include: skillTemplateInclude
      });
    });

    await (existing ? skillTemplateUpdatedQueue : skillTemplateCreatedQueue).add({
      skillTemplateId: template.id
    });
    return template;
  }

  async listSkillTemplates(d: MetorialFacing<ListSkillTemplatesParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.listSkillTemplatesInternal({ ...rest, tenant, environment });
  }

  async listSkillTemplatesInternal(d: ListSkillTemplatesParams) {
    let solution = await getMetorialSolution();

    d.search = d.search?.trim();
    if (!d.search?.length) d.search = undefined;

    let accessibleScope = getAccessibleScope({ ...d, solution });
    let search = null;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let skillTemplates = await db.skillTemplate.findMany({
          ...opts,
          where: {
            ...normalizeStatusForList(d).noParent,
            OR: accessibleScope.length ? accessibleScope : undefined,
            AND: [
              d.ids ? { id: { in: d.ids } } : undefined!,
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

  async getSkillTemplateById(d: MetorialFacing<GetSkillTemplateByIdParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.getSkillTemplateByIdInternal({ ...rest, tenant, environment });
  }

  async getSkillTemplateByIdInternal(d: GetSkillTemplateByIdParams) {
    let solution = await getMetorialSolution();

    let skillTemplate = await db.skillTemplate.findFirst({
      where: {
        id: d.skillTemplateId,
        ...normalizeStatusForGet(d).noParent,
        OR: getAccessibleScope({ ...d, solution })
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

  async createSkillTemplate(d: MetorialFacing<CreateSkillTemplateParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.createSkillTemplateInternal({ ...rest, tenant, environment });
  }

  async createSkillTemplateInternal(d: CreateSkillTemplateParams) {
    let id = getId('skillTemplate').id;
    return await this.upsertMetorialSkillTemplateInternal({
      tenant: d.tenant,
      environment: d.environment,
      input: {
        id,
        status: 'active',
        owner: 'tenant',
        slug: getSlug({ name: d.input.name }),
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata,
        storeId: `projection-${id}`,
        storeTemplateId: `projection-template-${id}`,
        sourceSkillId: d.input.skillId
      }
    });
    /*
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
      ? await removedLegacyClient.skillTemplate.create({
          ...cargoScope,
          name,
          skillId: sourceSkill.id,
          skillTemplateId: newId.id
        })
      : await (async () => {
          let cargoStore = await createStoreForPlainTemplate(cargoScope, name);

          return await removedLegacyClient.skillTemplate.create({
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
    */
  }

  async updateSkillTemplate(d: MetorialFacing<UpdateSkillTemplateParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.updateSkillTemplateInternal({ ...rest, tenant, environment });
  }

  async updateSkillTemplateInternal(d: UpdateSkillTemplateParams) {
    checkTenant(d, d.skillTemplate);
    this.assertTenantOwnedTemplate(d.skillTemplate);
    checkDeletedEdit(d.skillTemplate, 'update');

    let current = await db.skillTemplate.findUniqueOrThrow({
      where: { oid: d.skillTemplate.oid }
    });

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

  async archiveSkillTemplate(d: MetorialFacing<ArchiveSkillTemplateParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.archiveSkillTemplateInternal({ ...rest, tenant, environment });
  }

  async archiveSkillTemplateInternal(d: ArchiveSkillTemplateParams) {
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
