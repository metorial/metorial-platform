import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { type DateFilter, normalizeDateFilter } from '@metorial/cargo-list-utils';
import type { ResourceScope } from '@metorial/module-resource-tenant';
import {
  accessTagService,
  type AnyAccessTagSelector,
  consumerSkillReadRoles
} from '@metorial/module-access';
import { db, ID, type Prisma, withTransaction } from '@metorial/db';
import { enqueueSkillGroupLifecycle } from '../queues/lifecycle/skillGroup';
import { skillGroupService } from './skillGroup';
import { skillService } from './skill';

let include = {
  skillGroup: true,
  skill: true
} satisfies Prisma.SkillGroupItemInclude;

export type SkillGroupItemRecord = Prisma.SkillGroupItemGetPayload<{
  include: typeof include;
}>;

class SkillGroupItemServiceImpl {
  async listSkillGroupItems(
    d: ResourceScope & {
      statuses?: Array<'active' | 'archived' | 'deleted'>;
      allowDeleted?: boolean;
      ids?: string[];
      skillGroupIds?: string[];
      skillIds?: string[];
      createdAt?: DateFilter;
      accessTags?: AnyAccessTagSelector;
    }
  ) {
    let accessTagFilter = await accessTagService.getAccessTagFilter({
      tags: d.accessTags,
      roles: [...consumerSkillReadRoles]
    });
    return Paginator.create(({ prisma }) =>
      prisma(opts =>
        db.skillGroupItem.findMany({
          ...opts,
          where: {
            status: d.accessTags
              ? 'active'
              : d.statuses?.length
                ? { in: d.statuses }
                : d.allowDeleted
                  ? undefined
                  : 'active',
            id: d.ids?.length ? { in: d.ids } : undefined,
            createdAt: d.createdAt ? normalizeDateFilter(d.createdAt) : undefined,
            skillGroup: {
              instance: {
                resourceTenantOid: d.resourceTenant.oid,
                resourceGroupOid: d.resourceGroup.oid
              },
              id: d.skillGroupIds?.length ? { in: d.skillGroupIds } : undefined,
              status: d.accessTags ? 'active' : d.allowDeleted ? undefined : 'active',
              accessTagEntities: accessTagFilter
            },
            skill: {
              id: d.skillIds?.length ? { in: d.skillIds } : undefined,
              status: d.accessTags ? 'active' : undefined
            }
          },
          include
        })
      )
    );
  }

  async getSkillGroupItemById(
    d: ResourceScope & {
      skillGroupItemId: string;
      skillGroupId?: string;
      allowDeleted?: boolean;
      accessTags?: AnyAccessTagSelector;
    }
  ) {
    let accessTagFilter = await accessTagService.getAccessTagFilter({
      tags: d.accessTags,
      roles: [...consumerSkillReadRoles]
    });
    let item = await db.skillGroupItem.findFirst({
      where: {
        id: d.skillGroupItemId,
        status: d.accessTags ? 'active' : d.allowDeleted ? undefined : 'active',
        skillGroup: {
          id: d.skillGroupId,
          instance: {
            resourceTenantOid: d.resourceTenant.oid,
            resourceGroupOid: d.resourceGroup.oid
          },
          status: d.accessTags ? 'active' : d.allowDeleted ? undefined : 'active',
          accessTagEntities: accessTagFilter
        },
        skill: d.accessTags
          ? {
              status: 'active'
            }
          : undefined
      },
      include
    });
    if (!item) {
      throw new ServiceError(notFoundError('skill.group.item', d.skillGroupItemId));
    }
    return item;
  }

  async createSkillGroupItem(
    d: ResourceScope & { input: { skillGroupId: string; skillId: string } }
  ) {
    let [group, skill] = await Promise.all([
      skillGroupService.getSkillGroupById({
        ...d,
        skillGroupId: d.input.skillGroupId
      }),
      skillService.getSkillById({ ...d, skillId: d.input.skillId })
    ]);
    let existing = await db.skillGroupItem.findUnique({
      where: {
        skillGroupOid_skillOid: {
          skillGroupOid: group.oid,
          skillOid: skill.oid
        }
      },
      include
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
      let item = existing
        ? await db.skillGroupItem.update({
            where: { oid: existing.oid },
            data: { status: 'active' },
            include
          })
        : await db.skillGroupItem.create({
            data: {
              id: await ID.generateId('skillGroupItem'),
              status: 'active',
              skillGroupOid: group.oid,
              skillOid: skill.oid
            },
            include
          });
      await enqueueSkillGroupLifecycle({ skillGroupId: group.id, event: 'updated' });
      return item;
    });
  }

  async archiveSkillGroupItem(d: ResourceScope & { skillGroupItem: SkillGroupItemRecord }) {
    let current = await this.getSkillGroupItemById({
      ...d,
      skillGroupItemId: d.skillGroupItem.id,
      allowDeleted: true
    });
    let item = await db.skillGroupItem.update({
      where: { oid: current.oid },
      data: { status: 'archived' },
      include
    });
    await enqueueSkillGroupLifecycle({
      skillGroupId: item.skillGroup.id,
      event: 'updated'
    });
    return item;
  }
}

export let skillGroupItemService = Service.create(
  'cargoSkillGroupItemService',
  () => new SkillGroupItemServiceImpl()
).build();
