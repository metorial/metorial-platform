import { badRequestError, notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { Service } from '@mtsrc/service';
import {
  addAfterTransactionHook,
  db,
  type Environment,
  getId,
  type Prisma,
  type SkillGroupItem,
  type SkillGroupItemStatus,
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
import { skillGroupUpdatedQueue } from '../queues/lifecycle/skillGroup';
import { skillService } from './skill';
import { skillGroupService } from './skillGroup';

export let skillGroupItemInclude = {
  skillGroup: true,
  skill: true
} satisfies Prisma.SkillGroupItemInclude;

export type SkillGroupItemRecord = Prisma.SkillGroupItemGetPayload<{
  include: typeof skillGroupItemInclude;
}>;

let getParentSkillGroupStatusFilter = (allowDeleted?: boolean) =>
  allowDeleted ? undefined : { notIn: ['deleted' as const, 'archived' as const] };

class skillGroupItemServiceImpl {
  async listSkillGroupItems(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    status?: SkillGroupItemStatus[];
    allowDeleted?: boolean;
    ids?: string[];
    skillGroupIds?: string[];
    skillIds?: string[];
    createdAt?: DateFilter;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.skillGroupItem.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              solutionOid: d.solution.oid,
              environmentOid: d.environment.oid,
              ...normalizeStatusForList(d).noParent,
              skillGroup: {
                status: getParentSkillGroupStatusFilter(d.allowDeleted)
              },
              AND: [
                d.ids ? { id: { in: d.ids } } : undefined!,
                d.skillGroupIds ? { skillGroup: { id: { in: d.skillGroupIds } } } : undefined!,
                d.skillIds ? { skill: { id: { in: d.skillIds } } } : undefined!,
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!
              ].filter(Boolean)
            },
            include: skillGroupItemInclude
          })
      )
    );
  }

  async getSkillGroupItemById(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillGroupItemId: string;
    allowDeleted?: boolean;
  }) {
    let skillGroupItem = await db.skillGroupItem.findFirst({
      where: {
        id: d.skillGroupItemId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        ...normalizeStatusForGet(d).noParent,
        skillGroup: {
          status: getParentSkillGroupStatusFilter(d.allowDeleted)
        }
      },
      include: skillGroupItemInclude
    });
    if (!skillGroupItem) {
      throw new ServiceError(notFoundError('skillGroupItem', d.skillGroupItemId));
    }

    return skillGroupItem;
  }

  async createSkillGroupItem(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    input: {
      skillGroupId: string;
      skillId: string;
    };
  }) {
    let skillGroup = await skillGroupService.getActiveSkillGroupById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      skillGroupId: d.input.skillGroupId
    });

    let skill = await skillService.getActiveSkillById({
      tenant: d.tenant,
      solution: d.solution,
      environment: d.environment,
      skillId: d.input.skillId
    });

    let existing = await db.skillGroupItem.findFirst({
      where: {
        skillGroupOid: skillGroup.oid,
        skillOid: skill.oid
      },
      include: skillGroupItemInclude
    });

    if (existing?.status === 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Skill already exists in skill group.',
          code: 'skill_group_item_exists'
        })
      );
    }

    return await withTransaction(async db => {
      let skillGroupItemId = existing?.id;

      if (existing) {
        await db.skillGroupItem.update({
          where: { oid: existing.oid },
          data: { status: 'active' }
        });
      } else {
        let item = await db.skillGroupItem.create({
          data: {
            ...getId('skillGroupItem'),
            status: 'active',
            skillGroupOid: skillGroup.oid,
            skillOid: skill.oid,
            tenantOid: d.tenant.oid,
            solutionOid: d.solution.oid,
            environmentOid: d.environment.oid
          }
        });

        skillGroupItemId = item.id;
      }

      let skillGroupItem = await db.skillGroupItem.findFirstOrThrow({
        where: { id: skillGroupItemId! },
        include: skillGroupItemInclude
      });

      await addAfterTransactionHook(async () =>
        skillGroupUpdatedQueue.add({ skillGroupId: skillGroupItem.skillGroup.id })
      );

      return skillGroupItem;
    });
  }

  async archiveSkillGroupItem(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    skillGroupItem: SkillGroupItem;
  }) {
    checkDeletedEdit(d.skillGroupItem, 'archive');

    let current = await db.skillGroupItem.findFirst({
      where: {
        oid: d.skillGroupItem.oid,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid
      },
      include: skillGroupItemInclude
    });
    if (!current) {
      throw new ServiceError(notFoundError('skillGroupItem', d.skillGroupItem.id));
    }

    return await withTransaction(async db => {
      let skillGroupItem = await db.skillGroupItem.update({
        where: { oid: current.oid },
        data: { status: 'archived' },
        include: skillGroupItemInclude
      });

      await addAfterTransactionHook(async () =>
        skillGroupUpdatedQueue.add({ skillGroupId: skillGroupItem.skillGroup.id })
      );

      return skillGroupItem;
    });
  }
}

export let skillGroupItemService = Service.create(
  'skillGroupItemService',
  () => new skillGroupItemServiceImpl()
).build();
