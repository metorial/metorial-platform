import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillMarketplaceService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillMarketplacePresenter } from '../../../presenters';
import {
  assertConsumerCanAccessSkillMarketplace,
  getReadSkillMarketplaceFilter
} from './_marketplaceAccess';

let readScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let writeScopes = ['instance.skill:write'] as const;

let skillMarketplaceInput = {
  name: v.optional(v.string()),
  description: v.optional(v.nullable(v.string())),
  image_file_id: v.optional(v.nullable(v.string())),
  skill_configuration_id: v.optional(v.nullable(v.string()))
};

export let getSkillMarketplaceAccess = (
  ctx: Parameters<typeof getInstanceCargoAccess>[0] & any
) => ({
  owner: {
    type: 'instance' as const,
    instance: ctx.instance,
    organization: ctx.organization
  },
  ...getInstanceCargoAccess(ctx)
});

export let skillMarketplaceGroup = instanceGroup.use(hasFlags(['skills-enabled'])).use(async ctx => {
  if (!ctx.params.skillMarketplaceId) {
    throw new ServiceError(
      badRequestError({
        message: 'skillMarketplaceId is required',
        description: 'The skillMarketplaceId path parameter is required.'
      })
    );
  }

  await assertConsumerCanAccessSkillMarketplace(ctx, ctx.params.skillMarketplaceId);

  let skillMarketplace = await skillMarketplaceService.getSkillMarketplaceById({
    ...getSkillMarketplaceAccess(ctx),
    skillMarketplaceId: ctx.params.skillMarketplaceId
  });

  return { skillMarketplace };
});

export let skillMarketplaceController = Controller.create(
  {
    name: 'Skill Marketplaces',
    description: 'Manage skill marketplaces for an instance.'
  },
  {
    list: instanceGroup
      .get(instancePath('skill-marketplaces', 'skills.marketplaces.list'), {
        name: 'List skill marketplaces',
        description: 'Returns a paginated list of skill marketplaces.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillMarketplacePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            ),
            skill_configuration_id: v.optional(v.union([v.string(), v.array(v.string())])),
            search: v.optional(v.string()),
            created_at: dateFilterValidator('skill marketplace creation time'),
            updated_at: dateFilterValidator('skill marketplace last update time')
          })
        )
      )
      .do(async ctx => {
        let marketplaceFilter = await getReadSkillMarketplaceFilter(ctx);
        let queryIds = normalizeArrayParam(ctx.query.id);
        let ids =
          marketplaceFilter == null
            ? queryIds
            : queryIds?.length
              ? queryIds.filter(id => marketplaceFilter.includes(id))
              : marketplaceFilter;

        let paginator = await skillMarketplaceService.listSkillMarketplaces({
          ...getSkillMarketplaceAccess(ctx),
          ids,
          statuses: normalizeArrayParam(ctx.query.status),
          skillConfigurationIds: normalizeArrayParam(ctx.query.skill_configuration_id),
          search: ctx.query.search,
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillMarketplace =>
          skillMarketplacePresenter.present({ skillMarketplace })
        );
      }),

    get: skillMarketplaceGroup
      .get(instancePath('skill-marketplaces/:skillMarketplaceId', 'skills.marketplaces.get'), {
        name: 'Get skill marketplace',
        description: 'Retrieves a skill marketplace.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillMarketplacePresenter)
      .do(async ctx =>
        skillMarketplacePresenter.present({ skillMarketplace: ctx.skillMarketplace })
      ),

    create: instanceGroup
      .post(instancePath('skill-marketplaces', 'skills.marketplaces.create'), {
        name: 'Create skill marketplace',
        description: 'Creates a skill marketplace.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body(
        'default',
        v.object({
          ...skillMarketplaceInput,
          name: v.string()
        })
      )
      .output(skillMarketplacePresenter)
      .do(async ctx => {
        let skillMarketplace = await skillMarketplaceService.createSkillMarketplace({
          ...getSkillMarketplaceAccess(ctx),
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            imageFileId: ctx.body.image_file_id,
            skillConfigurationId: ctx.body.skill_configuration_id
          }
        });

        return skillMarketplacePresenter.present({ skillMarketplace });
      }),

    update: skillMarketplaceGroup
      .patch(
        instancePath('skill-marketplaces/:skillMarketplaceId', 'skills.marketplaces.update'),
        {
          name: 'Update skill marketplace',
          description: 'Updates a skill marketplace.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body('default', v.object(skillMarketplaceInput))
      .output(skillMarketplacePresenter)
      .do(async ctx => {
        let skillMarketplace = await skillMarketplaceService.updateSkillMarketplace({
          ...getSkillMarketplaceAccess(ctx),
          skillMarketplace: ctx.skillMarketplace,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            imageFileId: ctx.body.image_file_id,
            skillConfigurationId: ctx.body.skill_configuration_id
          }
        });

        return skillMarketplacePresenter.present({ skillMarketplace });
      }),

    archive: skillMarketplaceGroup
      .delete(
        instancePath('skill-marketplaces/:skillMarketplaceId', 'skills.marketplaces.archive'),
        {
          name: 'Archive skill marketplace',
          description: 'Archives a skill marketplace.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .output(skillMarketplacePresenter)
      .do(async ctx => {
        let skillMarketplace = await skillMarketplaceService.archiveSkillMarketplace({
          ...getSkillMarketplaceAccess(ctx),
          skillMarketplace: ctx.skillMarketplace
        });

        return skillMarketplacePresenter.present({ skillMarketplace });
      }),

    sync: skillMarketplaceGroup
      .post(
        instancePath(
          'skill-marketplaces/:skillMarketplaceId/sync',
          'skills.marketplaces.sync'
        ),
        {
          name: 'Sync skill marketplace',
          description: 'Forces a skill marketplace sync.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body('default', v.object({}))
      .output(skillMarketplacePresenter)
      .do(async ctx => {
        let skillMarketplace = await skillMarketplaceService.forceSkillMarketplaceSync({
          ...getSkillMarketplaceAccess(ctx),
          skillMarketplace: ctx.skillMarketplace
        });

        return skillMarketplacePresenter.present({ skillMarketplace });
      })
  }
);
