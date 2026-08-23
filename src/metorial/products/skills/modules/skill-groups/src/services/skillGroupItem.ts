import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Instance, Project } from '@metorial/db';
import { db, ID, type Prisma, withTransaction } from '@metorial/db';
import { type DateFilter, normalizeDateFilter } from '@metorial/list-utils';
import {
  accessTagService,
  type AnyAccessTagSelector,
  consumerSkillReadRoles
} from '@metorial/module-access';
import { getConsumerSkillAccessWhere, skillService } from '@metorial/module-skill';
import { enqueueSkillGroupLifecycle } from '../queues/lifecycle';
import { skillGroupService } from './skillGroup';

let include = {
  skillGroup: true,
  skill: true
} satisfies Prisma.SkillGroupItemInclude;

export type SkillGroupItemRecord = Prisma.SkillGroupItemGetPayload<{
  include: typeof include;
}>;

class SkillGroupItemServiceImpl {
  async listSkillGroupItems(d: {
    project: Project;
    instance: Instance;
    statuses?: Array<'active' | 'archived' | 'deleted'>;
    allowDeleted?: boolean;
    ids?: string[];
    skillGroupIds?: string[];
    skillIds?: string[];
    createdAt?: DateFilter;
    accessTags?: AnyAccessTagSelector;
  }) {
    let accessTagFilter = await accessTagService.getAccessTagFilter({
      tags: d.accessTags,
      roles: [...consumerSkillReadRoles]
    });
    let skillAccessWhere = await getConsumerSkillAccessWhere(d);
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
              instanceOid: d.instance.oid,
              id: d.skillGroupIds?.length ? { in: d.skillGroupIds } : undefined,
              status: d.accessTags ? 'active' : d.allowDeleted ? undefined : 'active',
              accessTagEntities: accessTagFilter
            },
            skill: {
              id: d.skillIds?.length ? { in: d.skillIds } : undefined,
              status: d.accessTags ? 'active' : undefined,
              AND: skillAccessWhere ? [skillAccessWhere] : undefined
            }
          },
          include
        })
      )
    );
  }

  async getSkillGroupItemById(d: {
    project: Project;
    instance: Instance;
    skillGroupItemId: string;
    skillGroupId?: string;
    allowDeleted?: boolean;
    accessTags?: AnyAccessTagSelector;
  }) {
    let accessTagFilter = await accessTagService.getAccessTagFilter({
      tags: d.accessTags,
      roles: [...consumerSkillReadRoles]
    });
    let skillAccessWhere = await getConsumerSkillAccessWhere(d);
    let item = await db.skillGroupItem.findFirst({
      where: {
        id: d.skillGroupItemId,
        status: d.accessTags ? 'active' : d.allowDeleted ? undefined : 'active',
        skillGroup: {
          id: d.skillGroupId,
          instanceOid: d.instance.oid,
          status: d.accessTags ? 'active' : d.allowDeleted ? undefined : 'active',
          accessTagEntities: accessTagFilter
        },
        skill: d.accessTags
          ? {
              status: 'active',
              AND: skillAccessWhere ? [skillAccessWhere] : undefined
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

  async createSkillGroupItem(d: {
    project: Project;
    instance: Instance;
    input: { skillGroupId: string; skillId: string };
  }) {
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

  async archiveSkillGroupItem(d: {
    project: Project;
    instance: Instance;
    skillGroupItem: SkillGroupItemRecord;
  }) {
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
