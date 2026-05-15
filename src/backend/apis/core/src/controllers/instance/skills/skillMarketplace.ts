import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillMarketplaceService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { isDashboardGroup } from '../../../middleware/isDashboard';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { bucketEditorTokenPresenter, skillMarketplacePresenter } from '../../../presenters';
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

let getSkillMarketplaceAccess = (ctx: Parameters<typeof getInstanceCargoAccess>[0] & any) => ({
  owner: {
    type: 'instance' as const,
    instance: ctx.instance,
    organization: ctx.organization
  },
  ...getInstanceCargoAccess(ctx)
});

export let skillMarketplaceGroup = instanceGroup.use(async ctx => {
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
      .get(instancePath('skills/marketplaces', 'skills.marketplaces.list'), {
        name: 'List skill marketplaces',
        description: 'Returns a paginated list of skill marketplaces.'
      })
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
            slug: v.optional(v.string()),
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
          slug: ctx.query.slug,
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillMarketplace =>
          skillMarketplacePresenter.present({ skillMarketplace })
        );
      }),

    get: skillMarketplaceGroup
      .get(
        instancePath('skills/marketplaces/:skillMarketplaceId', 'skills.marketplaces.get'),
        {
          name: 'Get skill marketplace',
          description: 'Retrieves a skill marketplace.'
        }
      )
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillMarketplacePresenter)
      .do(async ctx =>
        skillMarketplacePresenter.present({ skillMarketplace: ctx.skillMarketplace })
      ),

    create: instanceGroup
      .post(instancePath('skills/marketplaces', 'skills.marketplaces.create'), {
        name: 'Create skill marketplace',
        description: 'Creates a skill marketplace.'
      })
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
        instancePath('skills/marketplaces/:skillMarketplaceId', 'skills.marketplaces.update'),
        {
          name: 'Update skill marketplace',
          description: 'Updates a skill marketplace.'
        }
      )
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
        instancePath('skills/marketplaces/:skillMarketplaceId', 'skills.marketplaces.archive'),
        {
          name: 'Archive skill marketplace',
          description: 'Archives a skill marketplace.'
        }
      )
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .output(skillMarketplacePresenter)
      .do(async ctx => {
        let skillMarketplace = await skillMarketplaceService.archiveSkillMarketplace({
          ...getSkillMarketplaceAccess(ctx),
          skillMarketplace: ctx.skillMarketplace
        });

        return skillMarketplacePresenter.present({ skillMarketplace });
      }),

    getEditorUrl: skillMarketplaceGroup
      .post(
        instancePath(
          'skills/marketplaces/:skillMarketplaceId/editor-url',
          'skills.marketplaces.getEditorUrl'
        ),
        {
          name: 'Get skill marketplace editor URL',
          description: 'Creates an embeddable editor URL for a skill marketplace.',
          hideInDocs: true
        }
      )
      .use(isDashboardGroup())
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body('default', v.object({ is_read_only: v.optional(v.boolean()) }))
      .output(bucketEditorTokenPresenter)
      .do(async ctx => {
        let token = await skillMarketplaceService.getSkillMarketplaceEditorUrl({
          ...getSkillMarketplaceAccess(ctx),
          skillMarketplace: ctx.skillMarketplace,
          isReadOnly: ctx.body.is_read_only
        });

        return bucketEditorTokenPresenter.present({
          token: {
            id: ctx.skillMarketplace.backing.id,
            url: token.url,
            expiresAt: token.expiresAt
          }
        });
      })
  }
);
