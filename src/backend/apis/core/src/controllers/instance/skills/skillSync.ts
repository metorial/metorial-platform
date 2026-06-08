import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillSyncService } from '@metorial/module-file';
import { Controller, Path } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup } from '../../../middleware/instanceGroup';
import { isDashboardGroup } from '../../../middleware/isDashboard';
import { skillSyncPresenter } from '../../../presenters';
import { getSkillPluginAccess } from './skillPlugin';

let readScopes = ['instance.skill:read'] as const;

let statusValidator = v.enumOf([
  'pending',
  'completed',
  'failed',
  'processing',
  'canceled'
]);

export let skillSyncGroup = instanceGroup
  .use(hasFlags(['skills-enabled']))
  .use(isDashboardGroup())
  .use(async ctx => {
    if (!ctx.params.skillSyncId) {
      throw new ServiceError(
        badRequestError({
          message: 'skillSyncId is required',
          description: 'The skillSyncId path parameter is required.'
        })
      );
    }

    let skillSync = await skillSyncService.getSkillSyncById({
      ...getSkillPluginAccess(ctx),
      skillSyncId: ctx.params.skillSyncId
    });

    return { skillSync };
  });

export let skillSyncController = Controller.create(
  {
    name: 'Skill Syncs',
    description: 'View skill plugin and marketplace syncs for an instance.'
  },
  {
    list: instanceGroup
      .get(Path('/dashboard/instances/:instanceId/skill-syncs', 'dashboard.instance.skills.syncs.list'), {
        name: 'List skill syncs',
        description: 'Returns a paginated list of skill syncs.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(isDashboardGroup())
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .outputList(skillSyncPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            skill_marketplace_id: v.optional(v.union([v.string(), v.array(v.string())])),
            skill_plugin_id: v.optional(v.union([v.string(), v.array(v.string())])),
            status: v.optional(v.union([statusValidator, v.array(statusValidator)])),
            created_at: dateFilterValidator('skill sync creation time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await skillSyncService.listSkillSyncs({
          ...getSkillPluginAccess(ctx),
          ids: normalizeArrayParam(ctx.query.id),
          skillMarketplaceIds: normalizeArrayParam(ctx.query.skill_marketplace_id),
          skillPluginIds: normalizeArrayParam(ctx.query.skill_plugin_id),
          statuses: normalizeArrayParam(ctx.query.status),
          createdAt: ctx.query.created_at
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillSync =>
          skillSyncPresenter.present({ skillSync })
        );
      }),

    get: skillSyncGroup
      .get(
        Path(
          '/dashboard/instances/:instanceId/skill-syncs/:skillSyncId',
          'dashboard.instance.skills.syncs.get'
        ),
        {
          name: 'Get skill sync',
          description: 'Retrieves a skill sync.'
        }
      )
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .output(skillSyncPresenter)
      .do(async ctx => skillSyncPresenter.present({ skillSync: ctx.skillSync }))
  }
);
