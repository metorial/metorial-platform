import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  ID,
  type Prisma,
  type SkillItem,
  type SkillItemStatus,
  type SkillItemType,
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
import { subspaceScopeService } from '@metorial-subspace/module-tenant';
import { reconcileSkillProviderLinksQueue } from '../queues/reconcileSkillProviderLinks';
import { skillResourceService } from './resource';

type InstanceScopeInput = Parameters<typeof subspaceScopeService.ensureForInstance>[0];
type SubspaceScope = Awaited<ReturnType<typeof subspaceScopeService.ensureForInstance>>;

export let skillItemInclude = {
  skill: true,
  integration: {
    include: {
      integration: true
    }
  },
  provider: {
    include: {
      provider: {
        include: { listing: true }
      }
    }
  }
} satisfies Prisma.SkillItemInclude;

type SkillItemRecord = Prisma.SkillItemGetPayload<{
  include: typeof skillItemInclude;
}>;

export type CargoSkillItemRecord = Omit<
  SkillItemRecord,
  'skill' | 'integration' | 'provider'
> & {
  skillId: string;
  integration: NonNullable<SkillItemRecord['integration']>['integration'] | null;
  provider: NonNullable<SkillItemRecord['provider']>['provider'] | null;
};

let presentSkillItem = (record: SkillItemRecord): CargoSkillItemRecord => {
  let { skill, integration, provider, ...item } = record;

  return {
    ...item,
    skillId: skill.id,
    integration: integration?.integration ?? null,
    provider: provider?.provider ?? null
  };
};

let getParentSkillStatusFilter = (allowDeleted?: boolean) =>
  allowDeleted ? undefined : { notIn: ['deleted' as const, 'archived' as const] };

export type ListSkillItemsParams = {
  instance: InstanceScopeInput;
  status?: SkillItemStatus[];
  allowDeleted?: boolean;
  ids?: string[];
  skillIds?: string[];
  type?: SkillItemType[];
  integrationIds?: string[];
  providerIds?: string[];
  createdAt?: DateFilter;
};

export type GetSkillItemByIdParams = {
  instance: InstanceScopeInput;
  skillItemId: string;
  allowDeleted?: boolean;
};

export type CreateSkillItemParams = {
  instance: InstanceScopeInput;
  input:
    | {
        skillId: string;
        type: 'integration';
        integrationId: string;
      }
    | {
        skillId: string;
        type: 'provider';
        providerId: string;
      };
};

export type ArchiveSkillItemParams = {
  instance: InstanceScopeInput;
  skillItem: Pick<SkillItem, 'oid' | 'id' | 'status' | 'createdAt'>;
};

class SkillItemServiceImpl {
  private async resolveScope(instance: InstanceScopeInput) {
    return await subspaceScopeService.ensureForInstance(instance);
  }

  private async getActiveSkill(d: { scope: SubspaceScope; skillId: string }) {
    let skill = await db.skill.findFirst({
      where: {
        id: d.skillId,
        tenantOid: d.scope.tenant.oid,
        solutionOid: d.scope.solution.oid,
        environmentOid: d.scope.environment.oid,
        status: 'active'
      }
    });
    if (!skill) throw new ServiceError(notFoundError('skill', d.skillId));

    checkDeletedRelation(skill);
    return skill;
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

  async listSkillItems(d: ListSkillItemsParams) {
    await Promise.all(
      (d.skillIds ?? []).map(skillId =>
        skillResourceService.ensureDelegatedSkill({ id: skillId })
      )
    );
    let scope = await this.resolveScope(d.instance);

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        (
          await db.skillItem.findMany({
            ...opts,
            where: {
              ...normalizeStatusForList(d).noParent,
              skill: {
                tenantOid: scope.tenant.oid,
                solutionOid: scope.solution.oid,
                environmentOid: scope.environment.oid,
                status: getParentSkillStatusFilter(d.allowDeleted)
              },
              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.skillIds ? { skill: { id: { in: d.skillIds } } } : undefined!,
                d.type?.length ? { type: { in: d.type } } : undefined!,
                d.integrationIds
                  ? {
                      integration: {
                        is: {
                          integration: { id: { in: d.integrationIds } }
                        }
                      }
                    }
                  : undefined!,
                d.providerIds
                  ? {
                      provider: {
                        is: {
                          provider: { id: { in: d.providerIds } }
                        }
                      }
                    }
                  : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!
              ].filter(Boolean)
            },
            include: skillItemInclude
          })
        ).map(presentSkillItem)
      )
    );
  }

  async getSkillItemById(d: GetSkillItemByIdParams) {
    let scope = await this.resolveScope(d.instance);
    let skillItem = await db.skillItem.findFirst({
      where: {
        id: d.skillItemId,
        ...normalizeStatusForGet(d).noParent,
        skill: {
          tenantOid: scope.tenant.oid,
          solutionOid: scope.solution.oid,
          environmentOid: scope.environment.oid,
          status: getParentSkillStatusFilter(d.allowDeleted)
        }
      },
      include: skillItemInclude
    });
    if (!skillItem) throw new ServiceError(notFoundError('skillItem', d.skillItemId));

    return presentSkillItem(skillItem);
  }

  async createSkillItem(d: CreateSkillItemParams) {
    await skillResourceService.ensureDelegatedSkill({ id: d.input.skillId });
    let scope = await this.resolveScope(d.instance);
    let skill = await this.getActiveSkill({
      scope,
      skillId: d.input.skillId
    });

    if (d.input.type === 'integration') {
      let integration = await this.getIntegration({
        scope,
        integrationId: d.input.integrationId
      });
      let existing = await db.skillIntegration.findFirst({
        where: {
          skillOid: skill.oid,
          integrationOid: integration.oid
        },
        include: {
          item: {
            include: skillItemInclude
          }
        }
      });

      if (existing?.status === 'active' && existing.item.status === 'active') {
        throw new ServiceError(
          badRequestError({
            message: 'Integration already exists on skill.',
            code: 'skill_item_exists'
          })
        );
      }

      return await withTransaction(async db => {
        let itemId = existing?.item.id;

        if (existing) {
          await db.skillItem.update({
            where: { oid: existing.itemOid },
            data: { status: 'active' }
          });
          await db.skillIntegration.update({
            where: { oid: existing.oid },
            data: { status: 'active' }
          });
        } else {
          let item = await db.skillItem.create({
            data: {
              id: await ID.generateId('skillItem'),
              status: 'active',
              type: 'integration',
              skillOid: skill.oid
            }
          });
          itemId = item.id;
          await db.skillIntegration.create({
            data: {
              id: await ID.generateId('skillIntegration'),
              status: 'active',
              skillOid: skill.oid,
              integrationOid: integration.oid,
              itemOid: item.oid
            }
          });
        }

        let skillItem = await db.skillItem.findFirstOrThrow({
          where: { id: itemId! },
          include: skillItemInclude
        });
        await addAfterTransactionHook(async () => {
          await reconcileSkillProviderLinksQueue.add({ skillId: skill.id });
        });

        return presentSkillItem(skillItem);
      });
    }

    let provider = await this.getProvider({
      scope,
      providerId: d.input.providerId
    });
    let existing = await db.skillProvider.findFirst({
      where: {
        skillOid: skill.oid,
        providerOid: provider.oid
      },
      include: {
        item: {
          include: skillItemInclude
        }
      }
    });

    if (existing?.status === 'active' && existing.item.status === 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Provider already exists on skill.',
          code: 'skill_item_exists'
        })
      );
    }

    return await withTransaction(async db => {
      let itemId = existing?.item.id;

      if (existing) {
        await db.skillItem.update({
          where: { oid: existing.itemOid },
          data: { status: 'active' }
        });
        await db.skillProvider.update({
          where: { oid: existing.oid },
          data: { status: 'active' }
        });
      } else {
        let item = await db.skillItem.create({
          data: {
            id: await ID.generateId('skillItem'),
            status: 'active',
            type: 'provider',
            skillOid: skill.oid
          }
        });
        itemId = item.id;
        await db.skillProvider.create({
          data: {
            id: await ID.generateId('skillProvider'),
            status: 'active',
            skillOid: skill.oid,
            providerOid: provider.oid,
            itemOid: item.oid
          }
        });
      }

      let skillItem = await db.skillItem.findFirstOrThrow({
        where: { id: itemId! },
        include: skillItemInclude
      });
      await addAfterTransactionHook(async () => {
        await reconcileSkillProviderLinksQueue.add({ skillId: skill.id });
      });

      return presentSkillItem(skillItem);
    });
  }

  async archiveSkillItem(d: ArchiveSkillItemParams) {
    checkDeletedEdit(d.skillItem, 'archive');
    let scope = await this.resolveScope(d.instance);
    let current = await db.skillItem.findFirst({
      where: {
        oid: d.skillItem.oid,
        skill: {
          tenantOid: scope.tenant.oid,
          solutionOid: scope.solution.oid,
          environmentOid: scope.environment.oid
        }
      },
      include: skillItemInclude
    });
    if (!current) throw new ServiceError(notFoundError('skillItem', d.skillItem.id));

    return await withTransaction(async db => {
      let skillItem = await db.skillItem.update({
        where: { oid: current.oid },
        data: { status: 'archived' },
        include: skillItemInclude
      });

      if (current.integration) {
        await db.skillIntegration.update({
          where: { oid: current.integration.oid },
          data: { status: 'archived' }
        });
      }
      if (current.provider) {
        await db.skillProvider.update({
          where: { oid: current.provider.oid },
          data: { status: 'archived' }
        });
      }
      await addAfterTransactionHook(async () => {
        await reconcileSkillProviderLinksQueue.add({ skillId: current.skill.id });
      });

      return presentSkillItem(skillItem);
    });
  }
}

export let skillItemService = Service.create(
  'cargoSkillItemService',
  () => new SkillItemServiceImpl()
).build();
