import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type SkillItem,
  type SkillItemStatus,
  type SkillItemType,
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
import { skillItemArchivedQueue, skillItemCreatedQueue } from '../queues/lifecycle/skillItem';
import { skillService } from './skill';

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
};

let getParentSkillStatusFilter = (allowDeleted?: boolean) =>
  allowDeleted ? undefined : { notIn: ['deleted' as const, 'archived' as const] };

class skillItemServiceImpl {
  async listSkillItems(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    status?: SkillItemStatus[];
    allowDeleted?: boolean;
    ids?: string[];
    skillIds?: string[];
    type?: SkillItemType[];
    integrationIds?: string[];
    providerIds?: string[];
    createdAt?: DateFilter;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillItem.findMany({
            ...opts,
            where: {
              ...normalizeStatusForList(d).noParent,
              skill: {
                tenantOid: d.tenant.oid,
                solutionOid: d.solution.oid,
                environmentOid: d.environment.oid,
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
      )
    );
  }

  async getSkillItemById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillItemId: string;
    allowDeleted?: boolean;
  }) {
    let skillItem = await db.skillItem.findFirst({
      where: {
        id: d.skillItemId,
        ...normalizeStatusForGet(d).noParent,
        skill: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid,
          status: getParentSkillStatusFilter(d.allowDeleted)
        }
      },
      include: skillItemInclude
    });
    if (!skillItem) throw new ServiceError(notFoundError('skillItem', d.skillItemId));

    return skillItem;
  }

  async createSkillItem(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
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
  }) {
    let skill = await skillService.getActiveSkillById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      skillId: d.input.skillId
    });

    if (d.input.type === 'integration') {
      let integration = await integrationService.getIntegrationById({
        tenant: d.tenant,
        solution: d.solution,
        environment: d.environment,
        integrationId: d.input.integrationId,
        allowDeleted: false
      });

      checkDeletedRelation(integration);

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
              ...getId('skillItem'),
              status: 'active',
              type: 'integration',
              skillOid: skill.oid
            }
          });

          itemId = item.id;

          await db.skillIntegration.create({
            data: {
              ...getId('skillIntegration'),
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

        await addAfterTransactionHook(async () =>
          skillItemCreatedQueue.add({ skillItemId: skillItem.id })
        );

        return skillItem;
      });
    }

    let provider = await providerService.getProviderById({
      solution: d.solution,
      tenant: d.tenant,
      environment: d.environment,
      providerId: d.input.providerId,
      includeDeprecated: true
    });

    checkDeletedRelation(provider);

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
            ...getId('skillItem'),
            status: 'active',
            type: 'provider',
            skillOid: skill.oid
          }
        });

        itemId = item.id;

        await db.skillProvider.create({
          data: {
            ...getId('skillProvider'),
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

      await addAfterTransactionHook(async () =>
        skillItemCreatedQueue.add({ skillItemId: skillItem.id })
      );

      return skillItem;
    });
  }

  async archiveSkillItem(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillItem: SkillItem;
  }) {
    checkDeletedEdit(d.skillItem, 'archive');

    let current = await db.skillItem.findFirst({
      where: {
        oid: d.skillItem.oid,
        skill: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          environmentOid: d.environment.oid
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

      await addAfterTransactionHook(async () =>
        skillItemArchivedQueue.add({ skillItemId: skillItem.id })
      );

      return skillItem;
    });
  }
}

export let skillItemService = Service.create(
  'skillItemService',
  () => new skillItemServiceImpl()
).build();
