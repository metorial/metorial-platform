import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillMarketplaceService } from '@metorial/module-skill-marketplace';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillMarketplacePresenter } from '@metorial/presenters';
import { getSkillMarketplaceAccessInput } from './_marketplaceAccess';

let readScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let writeScopes = ['instance.skill:write'] as const;

let skillMarketplaceInput = {
  name: v.optional(v.string(), { description: 'Display name.' }),
  description: v.optional(v.nullable(v.string()), {
    description: 'Free-text description. `null` clears it.'
  }),
  image_file_id: v.optional(v.nullable(v.string()), {
    description: 'Image file for the marketplace, by ID. `null` resets to the default image.'
  }),
  skill_configuration_id: v.optional(v.nullable(v.string()), {
    description:
      'Skill configuration for the marketplace, by ID. `null` uses the default configuration.'
  }),
  repository_access_mode: v.optional(
    v.enumOf(['pull_request', 'default_branch'], {
      description:
        'How syncs reach linked repositories. `pull_request` opens a pull request, `default_branch` pushes directly.'
    })
  ),
  force_merge_or_push: v.optional(
    v.boolean({
      description: 'Merge or push even when the repository changed unexpectedly.'
    })
  ),
  merge_before_checks_pass: v.optional(
    v.boolean({
      description:
        'Merge pull requests before checks pass. Only applies to `pull_request` mode.'
    })
  )
};

export let getSkillMarketplaceAccess = (
  ctx: Parameters<typeof getInstanceCargoAccess>[0] & any
) => getInstanceCargoAccess(ctx);

export let skillMarketplaceGroup = instanceGroup
  .use(hasFlags(['skills-enabled']))
  .use(async ctx => {
    if (!ctx.params.skillMarketplaceId) {
      throw new ServiceError(
        badRequestError({
          message: 'skillMarketplaceId is required',
          description: 'The skillMarketplaceId path parameter is required.'
        })
      );
    }

    let skillMarketplace = await skillMarketplaceService.getSkillMarketplaceById({
      ...(await getSkillMarketplaceAccess(ctx)),
      skillMarketplaceId: ctx.params.skillMarketplaceId,
      ...getSkillMarketplaceAccessInput(ctx)
    });

    return { skillMarketplace };
  });

export let skillMarketplaceController = Controller.create(
  {
    name: 'Skill Marketplaces',
    description: 'A skill marketplace is a curated collection of skill plugins.'
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
            id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description: 'Only return skill marketplaces with these IDs.'
              })
            ),
            status: v.optional(
              v.union(
                [
                  v.enumOf(['active', 'archived', 'deleted']),
                  v.array(v.enumOf(['active', 'archived', 'deleted']))
                ],
                {
                  description: 'Only return skill marketplaces with one of these statuses.'
                }
              )
            ),
            skill_configuration_id: v.optional(
              v.union([v.string(), v.array(v.string())], {
                description:
                  'Only return skill marketplaces using one of these skill configurations.'
              })
            ),
            skill_group_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return marketplaces that contain an active plugin synced from these skill groups.'
            }),
            search: v.optional(
              v.string({
                description: 'Only return skill marketplaces matching this search text.'
              })
            ),
            created_at: dateFilterValidator('skill marketplace creation time'),
            updated_at: dateFilterValidator('skill marketplace last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await skillMarketplaceService.listSkillMarketplaces({
          ...(await getSkillMarketplaceAccess(ctx)),
          ...getSkillMarketplaceAccessInput(ctx),
          ids: normalizeArrayParam(ctx.query.id),
          statuses: normalizeArrayParam(ctx.query.status),
          skillConfigurationIds: normalizeArrayParam(ctx.query.skill_configuration_id),
          skillGroupIds: normalizeArrayParam(ctx.query.skill_group_id),
          search: ctx.query.search,
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillMarketplace =>
          skillMarketplacePresenter.present({
            skillMarketplace,
            ...getSkillMarketplaceAccessInput(ctx)
          })
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
        skillMarketplacePresenter.present({
          skillMarketplace: ctx.skillMarketplace,
          ...getSkillMarketplaceAccessInput(ctx)
        })
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
          name: v.string({ description: 'Display name.' })
        })
      )
      .output(skillMarketplacePresenter)
      .do(async ctx => {
        let skillMarketplace = await skillMarketplaceService.createSkillMarketplace({
          ...(await getSkillMarketplaceAccess(ctx)),
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            imageFileId: ctx.body.image_file_id,
            skillConfigurationId: ctx.body.skill_configuration_id,
            repositoryAccessMode: ctx.body.repository_access_mode,
            forceMergeOrPush: ctx.body.force_merge_or_push,
            mergeBeforeChecksPass: ctx.body.merge_before_checks_pass
          }
        });

        return skillMarketplacePresenter.present({
          skillMarketplace,
          ...getSkillMarketplaceAccessInput(ctx)
        });
      }),

    update: skillMarketplaceGroup
      .patch(
        instancePath('skill-marketplaces/:skillMarketplaceId', 'skills.marketplaces.update'),
        {
          name: 'Update skill marketplace',
          description: 'Updates a skill marketplace. Omitted fields keep their current value.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body('default', v.object(skillMarketplaceInput))
      .output(skillMarketplacePresenter)
      .do(async ctx => {
        let skillMarketplace = await skillMarketplaceService.updateSkillMarketplace({
          ...(await getSkillMarketplaceAccess(ctx)),
          skillMarketplace: ctx.skillMarketplace,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            imageFileId: ctx.body.image_file_id,
            skillConfigurationId: ctx.body.skill_configuration_id,
            repositoryAccessMode: ctx.body.repository_access_mode,
            forceMergeOrPush: ctx.body.force_merge_or_push,
            mergeBeforeChecksPass: ctx.body.merge_before_checks_pass
          }
        });

        return skillMarketplacePresenter.present({
          skillMarketplace,
          ...getSkillMarketplaceAccessInput(ctx)
        });
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
          ...(await getSkillMarketplaceAccess(ctx)),
          skillMarketplace: ctx.skillMarketplace
        });

        return skillMarketplacePresenter.present({
          skillMarketplace,
          ...getSkillMarketplaceAccessInput(ctx)
        });
      }),

    sync: skillMarketplaceGroup
      .post(
        instancePath(
          'skill-marketplaces/:skillMarketplaceId/sync',
          'skills.marketplaces.sync'
        ),
        {
          name: 'Sync skill marketplace',
          description:
            'Starts a sync of the skill marketplace to its linked repositories, even if nothing changed.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body('default', v.object({}))
      .output(skillMarketplacePresenter)
      .do(async ctx => {
        let skillMarketplace = await skillMarketplaceService.forceSkillMarketplaceSync({
          ...(await getSkillMarketplaceAccess(ctx)),
          skillMarketplace: ctx.skillMarketplace
        });

        return skillMarketplacePresenter.present({
          skillMarketplace,
          ...getSkillMarketplaceAccessInput(ctx)
        });
      })
  }
);
