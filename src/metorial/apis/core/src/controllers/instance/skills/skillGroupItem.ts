import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillGroupItemService, skillResourceService } from '@metorial/cargo-module-skill';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillGroupItemPresenter } from '../../../presenters';
import { skillGroupGroup } from './skillGroup';
import { assertConsumerCanWriteSkillGroupItem } from './skillGroupItemAccess';

let skillWriteScopes = ['instance.skill:write', 'consumer#instance.skill:write'] as const;

export let skillGroupItemGroup = skillGroupGroup.use(async ctx => {
  if (!ctx.params.skillGroupItemId) {
    throw new ServiceError(
      badRequestError({
        message: 'skillGroupItemId is required',
        description: 'The skillGroupItemId path parameter is required.'
      })
    );
  }

  let access = await getInstanceCargoAccess(ctx);
  let localSkillGroupItem = await skillGroupItemService.getSkillGroupItemById({
    resourceTenant: access.resourceTenant,
    resourceGroup: access.resourceGroup,
    skillGroupItemId: ctx.params.skillGroupItemId,
    skillGroupId: ctx.skillGroup.id,
    allowDeleted: true,
    accessTags: ctx.consumerProfile ? ctx.accessTags : undefined,
    consumerProfileOid: ctx.consumerProfile?.oid
  });
  let skillGroupItem = await skillResourceService.hydrateSkillGroupItem(localSkillGroupItem);

  return { skillGroupItem };
});

export let skillGroupItemController = Controller.create(
  {
    name: 'Skill Group Items',
    description: 'Skill group items link groups to skills.'
  },
  {
    list: skillGroupGroup
      .get(instancePath('skill-groups/:skillGroupId/items', 'skills.groups.items.list'), {
        name: 'List skill group items',
        description: 'Returns a paginated list of items for a skill group.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(
        checkAccess({
          possibleScopes: ['instance.skill:read', 'consumer#instance.skill:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillGroupItemPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            skill_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('skill group item creation time')
          })
        )
      )
      .do(async ctx => {
        let access = await getInstanceCargoAccess(ctx);
        let paginator = await skillGroupItemService.listSkillGroupItems({
          resourceTenant: access.resourceTenant,
          resourceGroup: access.resourceGroup,
          allowDeleted: true,
          skillGroupIds: [ctx.skillGroup.id],
          statuses: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          skillIds: normalizeArrayParam(ctx.query.skill_id),
          createdAt: ctx.query.created_at,
          accessTags: ctx.consumerProfile ? ctx.accessTags : undefined,
          consumerProfileOid: ctx.consumerProfile?.oid
        });

        let list = await paginator.run(ctx.query);
        let items = await skillResourceService.hydrateSkillGroupItems(list.items);

        return Paginator.present({ ...list, items }, skillGroupItem =>
          skillGroupItemPresenter.present({ skillGroupItem })
        );
      }),

    get: skillGroupItemGroup
      .get(
        instancePath(
          'skill-groups/:skillGroupId/items/:skillGroupItemId',
          'skills.groups.items.get'
        ),
        {
          name: 'Get skill group item',
          description: 'Retrieves a specific skill group item.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(
        checkAccess({
          possibleScopes: ['instance.skill:read', 'consumer#instance.skill:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .output(skillGroupItemPresenter)
      .do(async ctx =>
        skillGroupItemPresenter.present({ skillGroupItem: ctx.skillGroupItem })
      ),

    create: skillGroupGroup
      .post(instancePath('skill-groups/:skillGroupId/items', 'skills.groups.items.create'), {
        name: 'Create skill group item',
        description: 'Adds a skill to a skill group.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body(
        'default',
        v.object({
          skill_id: v.string()
        })
      )
      .output(skillGroupItemPresenter)
      .do(async ctx => {
        await assertConsumerCanWriteSkillGroupItem({
          instance: ctx.instance,
          resourceTenant: ctx.resourceTenant,
          resourceGroup: ctx.resourceGroup,
          skillGroupId: ctx.skillGroup.id,
          skillId: ctx.body.skill_id,
          consumerProfile: ctx.consumerProfile,
          accessTags: ctx.accessTags,
          authorization: (await getInstanceCargoAccess(ctx)).authorization
        });

        let access = await getInstanceCargoAccess(ctx);
        let localSkillGroupItem = await skillGroupItemService.createSkillGroupItem({
          resourceTenant: access.resourceTenant,
          resourceGroup: access.resourceGroup,
          input: {
            skillGroupId: ctx.skillGroup.id,
            skillId: ctx.body.skill_id
          }
        });
        let skillGroupItem =
          await skillResourceService.hydrateSkillGroupItem(localSkillGroupItem);

        return skillGroupItemPresenter.present({ skillGroupItem });
      }),

    delete: skillGroupItemGroup
      .delete(
        instancePath(
          'skill-groups/:skillGroupId/items/:skillGroupItemId',
          'skills.groups.items.delete'
        ),
        {
          name: 'Delete skill group item',
          description: 'Archives a skill group item.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillGroupItemPresenter)
      .do(async ctx => {
        await assertConsumerCanWriteSkillGroupItem({
          instance: ctx.instance,
          resourceTenant: ctx.resourceTenant,
          resourceGroup: ctx.resourceGroup,
          skillGroupId: ctx.skillGroup.id,
          skillId: ctx.skillGroupItem.skill.id,
          consumerProfile: ctx.consumerProfile,
          accessTags: ctx.accessTags,
          authorization: (await getInstanceCargoAccess(ctx)).authorization
        });

        let access = await getInstanceCargoAccess(ctx);
        let localSkillGroupItem = await skillGroupItemService.getSkillGroupItemById({
          resourceTenant: access.resourceTenant,
          resourceGroup: access.resourceGroup,
          skillGroupItemId: ctx.skillGroupItem.id,
          allowDeleted: true
        });
        localSkillGroupItem = await skillGroupItemService.archiveSkillGroupItem({
          resourceTenant: access.resourceTenant,
          resourceGroup: access.resourceGroup,
          skillGroupItem: localSkillGroupItem
        });
        let skillGroupItem =
          await skillResourceService.hydrateSkillGroupItem(localSkillGroupItem);

        return skillGroupItemPresenter.present({ skillGroupItem });
      })
  }
);
