import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillGroupService, skillResourceService } from '@metorial/cargo-module-skill';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillGroupPresenter } from '@metorial/presenters';

export let skillGroupGroup = instanceGroup.use(hasFlags(['skills-enabled'])).use(async ctx => {
  if (!ctx.params.skillGroupId) {
    throw new ServiceError(
      badRequestError({
        message: 'skillGroupId is required',
        description: 'The skillGroupId path parameter is required.'
      })
    );
  }

  let access = await getInstanceCargoAccess(ctx);
  let localGroup = await skillGroupService.getSkillGroupById({
    resourceTenant: access.resourceTenant,
    resourceGroup: access.resourceGroup,
    skillGroupId: ctx.params.skillGroupId,
    allowDeleted: true,
    accessTags: ctx.consumerProfile ? ctx.accessTags : undefined
  });
  let skillGroup = await skillResourceService.hydrateSkillGroup(localGroup);

  return { skillGroup };
});

export let skillGroupController = Controller.create(
  {
    name: 'Skill Groups',
    description: 'Skill groups organize skills into reusable collections.'
  },
  {
    list: instanceGroup
      .get(instancePath('skill-groups', 'skills.groups.list'), {
        name: 'List skill groups',
        description: 'Returns a paginated list of skill groups.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(
        checkAccess({
          possibleScopes: ['instance.skill:read', 'consumer#instance.skill:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillGroupPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            skill_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('skill group creation time'),
            updated_at: dateFilterValidator('skill group last update time')
          })
        )
      )
      .do(async ctx => {
        let access = await getInstanceCargoAccess(ctx);
        let paginator = await skillGroupService.listSkillGroups({
          resourceTenant: access.resourceTenant,
          resourceGroup: access.resourceGroup,
          search: ctx.query.search,
          statuses: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          skillIds: normalizeArrayParam(ctx.query.skill_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at,
          accessTags: ctx.consumerProfile ? ctx.accessTags : undefined
        });

        let list = await paginator.run(ctx.query);
        let items = await skillResourceService.hydrateSkillGroups(list.items);

        return Paginator.present({ ...list, items }, skillGroup =>
          skillGroupPresenter.present({ skillGroup })
        );
      }),

    get: skillGroupGroup
      .get(instancePath('skill-groups/:skillGroupId', 'skills.groups.get'), {
        name: 'Get skill group',
        description: 'Retrieves a specific skill group.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(
        checkAccess({
          possibleScopes: ['instance.skill:read', 'consumer#instance.skill:read']
        })
      )
      .use(requireConsumerTokenForPublishableKey())
      .output(skillGroupPresenter)
      .do(async ctx => {
        return skillGroupPresenter.present({ skillGroup: ctx.skillGroup });
      }),

    create: instanceGroup
      .post(instancePath('skill-groups', 'skills.groups.create'), {
        name: 'Create skill group',
        description: 'Creates a skill group.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          skill_ids: v.optional(v.array(v.string())),
          allow_consumer_skill_assignment: v.optional(v.boolean())
        })
      )
      .output(skillGroupPresenter)
      .do(async ctx => {
        let access = await getInstanceCargoAccess(ctx);
        let localGroup = await skillGroupService.createSkillGroup({
          resourceTenant: access.resourceTenant,
          resourceGroup: access.resourceGroup,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata as any,
            skillIds: ctx.body.skill_ids,
            allowConsumerSkillAssignment: ctx.body.allow_consumer_skill_assignment
          }
        });
        let skillGroup = await skillResourceService.hydrateSkillGroup(localGroup);

        return skillGroupPresenter.present({ skillGroup });
      }),

    update: skillGroupGroup
      .patch(instancePath('skill-groups/:skillGroupId', 'skills.groups.update'), {
        name: 'Update skill group',
        description: 'Updates a skill group.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.nullable(v.string())),
          metadata: v.optional(v.nullable(v.record(v.any()))),
          skill_ids: v.optional(v.array(v.string())),
          allow_consumer_skill_assignment: v.optional(v.boolean())
        })
      )
      .output(skillGroupPresenter)
      .do(async ctx => {
        let access = await getInstanceCargoAccess(ctx);
        let localGroup = await skillGroupService.updateSkillGroup({
          resourceTenant: access.resourceTenant,
          resourceGroup: access.resourceGroup,
          skillGroupId: ctx.skillGroup.id,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata as any,
            skillIds: ctx.body.skill_ids,
            allowConsumerSkillAssignment: ctx.body.allow_consumer_skill_assignment
          }
        });
        let skillGroup = await skillResourceService.hydrateSkillGroup(localGroup);

        return skillGroupPresenter.present({ skillGroup });
      }),

    delete: skillGroupGroup
      .delete(instancePath('skill-groups/:skillGroupId', 'skills.groups.delete'), {
        name: 'Delete skill group',
        description: 'Archives a skill group.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: ['instance.skill:write'] }))
      .output(skillGroupPresenter)
      .do(async ctx => {
        let access = await getInstanceCargoAccess(ctx);
        let localGroup = await skillGroupService.archiveSkillGroup({
          resourceTenant: access.resourceTenant,
          resourceGroup: access.resourceGroup,
          skillGroupId: ctx.skillGroup.id
        });
        let skillGroup = await skillResourceService.hydrateSkillGroup(localGroup);

        return skillGroupPresenter.present({ skillGroup });
      })
  }
);
