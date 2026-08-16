import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  getId,
  type Prisma,
  type SkillTemplate,
  withTransaction
} from '@metorial-subspace/db';
import {
  checkDeletedEdit,
  checkDeletedRelation,
  normalizeStatusForGet
} from '@metorial-subspace/list-utils';
import { checkTenant, subspaceScopeService } from '@metorial-subspace/module-tenant';
import { skillItemService } from './skillItem';
import { skillResourceService } from './resource';

type InstanceScopeInput = Parameters<typeof subspaceScopeService.ensureForInstance>[0];
type SubspaceScope = Awaited<ReturnType<typeof subspaceScopeService.ensureForInstance>>;
type TransactionDb = Parameters<Parameters<typeof withTransaction>[0]>[0];

export let skillTemplateItemInclude = {
  integration: true,
  provider: {
    include: {
      listing: true
    }
  }
} satisfies Prisma.SkillTemplateItemInclude;

type SkillTemplateItemRecord = Prisma.SkillTemplateItemGetPayload<{
  include: typeof skillTemplateItemInclude;
}>;

export type CargoSkillTemplateItemRecord = Omit<
  SkillTemplateItemRecord,
  'integration' | 'provider'
> & {
  type: 'integration' | 'provider';
  integration: SkillTemplateItemRecord['integration'];
  provider: SkillTemplateItemRecord['provider'];
};

let presentSkillTemplateItem = (
  record: SkillTemplateItemRecord
): CargoSkillTemplateItemRecord => {
  let { integration, provider, ...item } = record;

  return {
    ...item,
    type: integration ? 'integration' : 'provider',
    integration,
    provider
  };
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
  instance: InstanceScopeInput;
  skillTemplateId: string;
};

export type GetSkillTemplateItemParams = {
  instance: InstanceScopeInput;
  skillTemplateId: string;
  skillTemplateItemId: string;
};

export type CreateSkillTemplateItemParams = {
  instance: InstanceScopeInput;
  skillTemplateId: string;
  input: SkillTemplateItemCreateInput;
};

export type DeleteSkillTemplateItemParams = {
  instance: InstanceScopeInput;
  skillTemplateId: string;
  skillTemplateItemId: string;
};

export type AddSkillTemplateItemParams = {
  instance: InstanceScopeInput;
  skillTemplateId: string;
  input: {
    skillItemId: string;
  };
};

class SkillTemplateItemServiceImpl {
  private async resolveScope(instance: InstanceScopeInput) {
    return await subspaceScopeService.ensureForInstance(instance);
  }

  private getAccessibleScope(scope: SubspaceScope): Prisma.SkillTemplateWhereInput[] {
    return [
      {
        owner: 'system',
        solutionOid: scope.solution.oid,
        tenantOid: null,
        environmentOid: null
      },
      {
        owner: 'system',
        solutionOid: null,
        tenantOid: null,
        environmentOid: null
      },
      {
        owner: 'tenant',
        solutionOid: scope.solution.oid,
        tenantOid: scope.tenant.oid,
        environmentOid: scope.environment.oid
      }
    ];
  }

  private async getSkillTemplateById(d: {
    scope: SubspaceScope;
    skillTemplateId: string;
    allowDeleted?: boolean;
  }) {
    let skillTemplate = await db.skillTemplate.findFirst({
      where: {
        id: d.skillTemplateId,
        ...normalizeStatusForGet(d).noParent,
        OR: this.getAccessibleScope(d.scope)
      }
    });
    if (!skillTemplate) {
      throw new ServiceError(notFoundError('skillTemplate', d.skillTemplateId));
    }

    return skillTemplate;
  }

  private async getWritableSkillTemplateById(d: {
    scope: SubspaceScope;
    skillTemplateId: string;
  }) {
    let skillTemplate = await this.getSkillTemplateById({
      ...d,
      allowDeleted: false
    });

    checkTenant(
      {
        tenant: d.scope.tenant,
        environment: d.scope.environment,
        solution: d.scope.solution
      },
      skillTemplate
    );
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

  private async getIntegration(d: { scope: SubspaceScope; integrationId: string }) {
    let integration = await db.integration.findFirst({
      where: {
        id: d.integrationId,
        tenantOid: d.scope.tenant.oid,
        solutionOid: d.scope.solution.oid,
        environmentOid: d.scope.environment.oid,
        status: 'active'
      }
    });
    if (!integration) {
      throw new ServiceError(notFoundError('integration', d.integrationId));
    }

    checkDeletedRelation(integration);
    return integration;
  }

  private async getProvider(d: { scope: SubspaceScope; providerId: string }) {
    let provider = await db.provider.findFirst({
      where: {
        AND: [
          {
            OR: [
              { hasEnvironments: false },
              {
                providerEnvironments: {
                  some: {
                    environmentOid: d.scope.environment.oid,
                    currentVersionOid: { not: null }
                  }
                }
              }
            ]
          },
          {
            OR: [
              { access: 'public' },
              {
                access: 'tenant',
                ownerTenantOid: d.scope.tenant.oid,
                OR: [{ ownerSolutionOid: d.scope.solution.oid }, { ownerSolutionOid: null }]
              }
            ]
          },
          d.scope.tenant.onlyAllowTrustedProviders
            ? {
                OR: [
                  { access: 'tenant' },
                  { listing: { isVerified: true } },
                  { listing: { isOfficial: true } },
                  { listing: { isMetorial: true } }
                ]
              }
            : {},
          {
            OR: [
              { id: d.providerId },
              { slug: d.providerId },
              { globalIdentifier: d.providerId },
              { listing: { id: d.providerId } },
              { listing: { slug: d.providerId } },
              { listing: { prettySlug: d.providerId } },
              { listing: { aliases: { has: d.providerId } } }
            ]
          }
        ]
      }
    });
    if (!provider) throw new ServiceError(notFoundError('provider', d.providerId));

    checkDeletedRelation(provider);
    return provider;
  }

  private async createItem(d: {
    db: TransactionDb;
    skillTemplate: SkillTemplate;
    integrationOid?: bigint;
    providerOid?: bigint;
  }) {
    return await d.db.skillTemplateItem.create({
      data: {
        ...getId('skillTemplateItem'),
        skillTemplateOid: d.skillTemplate.oid,
        integrationOid: d.integrationOid,
        providerOid: d.providerOid
      },
      include: skillTemplateItemInclude
    });
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

  async listSkillTemplateItems(d: ListSkillTemplateItemsParams) {
    await skillResourceService.ensureDelegatedSkillTemplate({
      id: d.skillTemplateId
    });
    let scope = await this.resolveScope(d.instance);
    let skillTemplate = await this.getSkillTemplateById({
      scope,
      skillTemplateId: d.skillTemplateId,
      allowDeleted: false
    });

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        (
          await db.skillTemplateItem.findMany({
            ...opts,
            where: {
              skillTemplateOid: skillTemplate.oid
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            include: skillTemplateItemInclude
          })
        ).map(presentSkillTemplateItem)
      )
    );
  }

  async getSkillTemplateItem(d: GetSkillTemplateItemParams) {
    await skillResourceService.ensureDelegatedSkillTemplate({
      id: d.skillTemplateId
    });
    let scope = await this.resolveScope(d.instance);
    let skillTemplate = await this.getSkillTemplateById({
      scope,
      skillTemplateId: d.skillTemplateId,
      allowDeleted: false
    });
    let item = await this.getSkillTemplateItemById({
      skillTemplate,
      skillTemplateItemId: d.skillTemplateItemId
    });

    return presentSkillTemplateItem(item);
  }

  async createSkillTemplateItem(d: CreateSkillTemplateItemParams) {
    await skillResourceService.ensureDelegatedSkillTemplate({
      id: d.skillTemplateId
    });
    let scope = await this.resolveScope(d.instance);
    let skillTemplate = await this.getWritableSkillTemplateById({
      scope,
      skillTemplateId: d.skillTemplateId
    });

    if (d.input.type === 'integration') {
      let integration = await this.getIntegration({
        scope,
        integrationId: d.input.integrationId
      });
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

      return await withTransaction(async db =>
        presentSkillTemplateItem(
          await this.createItem({
            db,
            skillTemplate,
            integrationOid: integration.oid
          })
        )
      );
    }

    let provider = await this.getProvider({
      scope,
      providerId: d.input.providerId
    });
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

    return await withTransaction(async db =>
      presentSkillTemplateItem(
        await this.createItem({
          db,
          skillTemplate,
          providerOid: provider.oid
        })
      )
    );
  }

  async deleteSkillTemplateItem(d: DeleteSkillTemplateItemParams) {
    await skillResourceService.ensureDelegatedSkillTemplate({
      id: d.skillTemplateId
    });
    let scope = await this.resolveScope(d.instance);
    let skillTemplate = await this.getWritableSkillTemplateById({
      scope,
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
    });

    return presentSkillTemplateItem(item);
  }

  async addSkillTemplateItem(d: AddSkillTemplateItemParams) {
    await skillResourceService.ensureDelegatedSkillTemplate({
      id: d.skillTemplateId
    });
    let scope = await this.resolveScope(d.instance);
    let skillTemplate = await this.getWritableSkillTemplateById({
      scope,
      skillTemplateId: d.skillTemplateId
    });
    let skillItem = await skillItemService.getSkillItemById({
      instance: d.instance,
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

      return await withTransaction(async db =>
        presentSkillTemplateItem(
          await this.createItem({
            db,
            skillTemplate,
            integrationOid: skillItem.integration!.oid
          })
        )
      );
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

      return await withTransaction(async db =>
        presentSkillTemplateItem(
          await this.createItem({
            db,
            skillTemplate,
            providerOid: skillItem.provider!.oid
          })
        )
      );
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
  'cargoSkillTemplateItemService',
  () => new SkillTemplateItemServiceImpl()
).build();
