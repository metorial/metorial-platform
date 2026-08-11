import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Prisma,
  type SkillTemplate,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  checkDeletedRelation,
  normalizeStatusForGet
} from '@metorial-subspace/list-utils';
import { providerService } from '@metorial-subspace/module-catalog';
import { integrationService } from '@metorial-subspace/module-integration';
import {
  checkTenant,
  getMetorialSolution,
  type MetorialFacing,
  resolveMetorialFacing
} from '@metorial-subspace/module-tenant';
import { skillTemplateUpdatedQueue } from '../queues/lifecycle/skillTemplate';
import { skillItemService } from './skillItem';
import { getAccessibleScope } from './skillTemplate';

export let skillTemplateItemInclude = {
  integration: true,
  provider: {
    include: {
      listing: true
    }
  }
};

export type SkillTemplateItemRecord = Prisma.SkillTemplateItemGetPayload<{
  include: typeof skillTemplateItemInclude;
}>;

type SkillTemplateItemCreateInput =
  | {
      type: 'provider';
      providerId: string;
    }
  | {
      type: 'integration';
      integrationId: string;
    };

let assertTenantOwnedTemplate = (template: SkillTemplate) => {
  if (template.owner === 'tenant') return;

  throw new ServiceError(
    badRequestError({
      message: 'System-owned skill templates are read-only.',
      code: 'skill_template_readonly'
    })
  );
};

export type ListSkillTemplateItemsParams = {
  tenant: Tenant;
  environment: Environment;
  skillTemplateId: string;
};

export type GetSkillTemplateItemParams = {
  tenant: Tenant;
  environment: Environment;
  skillTemplateId: string;
  skillTemplateItemId: string;
};

export type CreateSkillTemplateItemParams = {
  tenant: Tenant;
  environment: Environment;
  skillTemplateId: string;
  input: SkillTemplateItemCreateInput;
};

export type DeleteSkillTemplateItemParams = {
  tenant: Tenant;
  environment: Environment;
  skillTemplateId: string;
  skillTemplateItemId: string;
};

export type AddSkillTemplateItemParams = {
  tenant: Tenant;
  environment: Environment;
  skillTemplateId: string;
  input: {
    skillItemId: string;
  };
};

class skillTemplateItemServiceImpl {
  private async getSkillTemplateById(d: {
    tenant: Tenant;
    environment: Environment;
    skillTemplateId: string;
    allowDeleted?: boolean;
  }) {
    let solution = await getMetorialSolution();

    let skillTemplate = await db.skillTemplate.findFirst({
      where: {
        id: d.skillTemplateId,
        ...normalizeStatusForGet(d).noParent,
        OR: getAccessibleScope({ ...d, solution })
      }
    });
    if (!skillTemplate) {
      throw new ServiceError(notFoundError('skillTemplate', d.skillTemplateId));
    }

    return skillTemplate;
  }

  private async getWritableSkillTemplateById(d: {
    tenant: Tenant;
    environment: Environment;
    skillTemplateId: string;
  }) {
    let skillTemplate = await this.getSkillTemplateById({
      ...d,
      allowDeleted: false
    });

    checkTenant(d, skillTemplate);
    assertTenantOwnedTemplate(skillTemplate);
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

  async buildSkillTemplateItemsFromSkill(d: { skillOid: bigint; skillTemplateOid: bigint }) {
    let [integrations, providers] = await Promise.all([
      db.skillIntegration.findMany({
        where: {
          skillOid: d.skillOid,
          status: 'active',
          item: {
            status: 'active'
          }
        },
        select: {
          integrationOid: true
        }
      }),
      db.skillProviderLink.findMany({
        where: {
          skillOid: d.skillOid
        },
        select: {
          providerOid: true
        }
      })
    ]);

    return [
      ...integrations.map(integration => ({
        ...getId('skillTemplateItem'),
        skillTemplateOid: d.skillTemplateOid,
        integrationOid: integration.integrationOid,
        providerOid: null
      })),
      ...providers.map(provider => ({
        ...getId('skillTemplateItem'),
        skillTemplateOid: d.skillTemplateOid,
        integrationOid: null,
        providerOid: provider.providerOid
      }))
    ];
  }

  async listSkillTemplateItems(d: MetorialFacing<ListSkillTemplateItemsParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.listSkillTemplateItemsInternal({ ...rest, tenant, environment });
  }

  async listSkillTemplateItemsInternal(d: ListSkillTemplateItemsParams) {
    let skillTemplate = await this.getSkillTemplateById({
      tenant: d.tenant,
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

  async getSkillTemplateItem(d: MetorialFacing<GetSkillTemplateItemParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.getSkillTemplateItemInternal({ ...rest, tenant, environment });
  }

  async getSkillTemplateItemInternal(d: GetSkillTemplateItemParams) {
    let skillTemplate = await this.getSkillTemplateById({
      tenant: d.tenant,
      environment: d.environment,
      skillTemplateId: d.skillTemplateId,
      allowDeleted: false
    });

    return await this.getSkillTemplateItemById({
      skillTemplate,
      skillTemplateItemId: d.skillTemplateItemId
    });
  }

  async createSkillTemplateItem(d: MetorialFacing<CreateSkillTemplateItemParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.createSkillTemplateItemInternal({ ...rest, tenant, environment });
  }

  async createSkillTemplateItemInternal(d: CreateSkillTemplateItemParams) {
    let skillTemplate = await this.getWritableSkillTemplateById(d);

    if (d.input.type === 'integration') {
      let integration = await integrationService.getIntegrationByIdInternal({
        tenant: d.tenant,
        environment: d.environment,
        integrationId: d.input.integrationId,
        allowDeleted: false
      });

      checkDeletedRelation(integration);

      let existing = await db.skillTemplateItem.findFirst({
        where: {
          skillTemplateOid: skillTemplate.oid,
          integrationOid: integration.oid
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
            integrationOid: integration.oid
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
      environment: d.environment,
      providerId: d.input.providerId,
      includeDeprecated: true
    });

    checkDeletedRelation(provider);

    let existing = await db.skillTemplateItem.findFirst({
      where: {
        skillTemplateOid: skillTemplate.oid,
        providerOid: provider.oid
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
          providerOid: provider.oid
        },
        include: skillTemplateItemInclude
      });

      await addAfterTransactionHook(async () =>
        skillTemplateUpdatedQueue.add({ skillTemplateId: skillTemplate.id })
      );

      return item;
    });
  }

  async deleteSkillTemplateItem(d: MetorialFacing<DeleteSkillTemplateItemParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.deleteSkillTemplateItemInternal({ ...rest, tenant, environment });
  }

  async deleteSkillTemplateItemInternal(d: DeleteSkillTemplateItemParams) {
    let skillTemplate = await this.getWritableSkillTemplateById({
      tenant: d.tenant,
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

  async addSkillTemplateItem(d: MetorialFacing<AddSkillTemplateItemParams>) {
    let { instance, organizationActor, ...rest } = d;
    let { tenant, environment } = await resolveMetorialFacing({ instance, organizationActor });
    return this.addSkillTemplateItemInternal({ ...rest, tenant, environment });
  }

  async addSkillTemplateItemInternal(d: AddSkillTemplateItemParams) {
    let skillTemplate = await this.getWritableSkillTemplateById(d);
    let skillItem = await skillItemService.getSkillItemByIdInternal({
      tenant: d.tenant,
      environment: d.environment,
      skillItemId: d.input.skillItemId,
      allowDeleted: false
    });

    checkDeletedRelation(skillItem);

    if (skillItem.integration) {
      let existing = await db.skillTemplateItem.findFirst({
        where: {
          skillTemplateOid: skillTemplate.oid,
          integrationOid: skillItem.integration.integrationOid
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
            integrationOid: skillItem.integration!.integrationOid
          },
          include: skillTemplateItemInclude
        });

        await addAfterTransactionHook(async () =>
          skillTemplateUpdatedQueue.add({ skillTemplateId: skillTemplate.id })
        );

        return item;
      });
    }

    if (skillItem.provider) {
      let existing = await db.skillTemplateItem.findFirst({
        where: {
          skillTemplateOid: skillTemplate.oid,
          providerOid: skillItem.provider.providerOid
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
            providerOid: skillItem.provider!.providerOid
          },
          include: skillTemplateItemInclude
        });

        await addAfterTransactionHook(async () =>
          skillTemplateUpdatedQueue.add({ skillTemplateId: skillTemplate.id })
        );

        return item;
      });
    }

    throw new ServiceError(
      badRequestError({
        message: 'Skill template items must reference a provider or integration skill item.',
        code: 'skill_template_item_invalid'
      })
    );
  }
}

export let skillTemplateItemService = Service.create(
  'skillTemplateItemService',
  () => new skillTemplateItemServiceImpl()
).build();
