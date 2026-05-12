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
  type Solution,
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
import { checkTenant } from '@metorial-subspace/module-tenant';
import { skillTemplateUpdatedQueue } from '../queues/lifecycle/skillTemplate';
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

let getAccessibleScope = (d: {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
}) => [
  {
    owner: 'system' as const,
    solutionOid: d.solution.oid,
    tenantOid: null,
    environmentOid: null
  },
  {
    owner: 'tenant' as const,
    solutionOid: d.solution.oid,
    tenantOid: d.tenant.oid,
    environmentOid: d.environment.oid
  }
];

let assertTenantOwnedTemplate = (template: SkillTemplate) => {
  if (template.owner === 'tenant') return;

  throw new ServiceError(
    badRequestError({
      message: 'System-owned skill templates are read-only.',
      code: 'skill_template_readonly'
    })
  );
};

class skillTemplateItemServiceImpl {
  private async getSkillTemplateById(d: {
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
      }
    });
    if (!skillTemplate) {
      throw new ServiceError(notFoundError('skillTemplate', d.skillTemplateId));
    }

    return skillTemplate;
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
          oid: true
        }
      }),
      db.skillProvider.findMany({
        where: {
          skillOid: d.skillOid,
          status: 'active',
          item: {
            status: 'active'
          }
        },
        select: {
          oid: true
        }
      })
    ]);

    return [
      ...integrations.map(integration => ({
        ...getId('skillTemplateItem'),
        skillTemplateOid: d.skillTemplateOid,
        integrationOid: integration.oid,
        providerOid: null
      })),
      ...providers.map(provider => ({
        ...getId('skillTemplateItem'),
        skillTemplateOid: d.skillTemplateOid,
        integrationOid: null,
        providerOid: provider.oid
      }))
    ];
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
            message:
              'Integration must exist on an active skill before it can be added to a template.',
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
          message:
            'Provider must exist on an active skill before it can be added to a template.',
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

  async addSkillTemplateItem(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillTemplateId: string;
    input: {
      skillItemId: string;
    };
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
        let item = await db.skillTemplateItem.create({
          data: {
            ...getId('skillTemplateItem'),
            skillTemplateOid: skillTemplate.oid,
            integrationOid: skillItem.integration!.oid
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
        let item = await db.skillTemplateItem.create({
          data: {
            ...getId('skillTemplateItem'),
            skillTemplateOid: skillTemplate.oid,
            providerOid: skillItem.provider!.oid
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
