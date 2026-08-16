import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  skillExportService,
  skillMarketplaceService,
  skillPluginService,
  skillService
} from '@metorial/cargo-module-skill';
import { Controller } from '@metorial/rest';
import { hasInstanceConsumerAccess } from '../../../lib/cargoAccess';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillExportPresenter } from '@metorial/presenters';
import { getSkillMarketplaceAccessInput } from './_marketplaceAccess';
import { getSkillPluginAccess } from './skillPlugin';

let readScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;

let targetValidator = v.enumOf(['skill', 'plugin', 'marketplace']);
let statusValidator = v.enumOf(['pending', 'completed', 'failed']);

export let skillExportGroup = instanceGroup
  .use(hasFlags(['skills-enabled']))
  .use(async ctx => {
    if (!ctx.params.skillExportId) {
      throw new ServiceError(
        badRequestError({
          message: 'skillExportId is required',
          description: 'The skillExportId path parameter is required.'
        })
      );
    }

    let access = await getSkillPluginAccess(ctx);
    let skillExport = await skillExportService.getSkillExportById({
      ...access,
      skillExportId: ctx.params.skillExportId,
      actor: hasInstanceConsumerAccess(ctx) ? access.actor : undefined
    });

    return { skillExport };
  });

let getCreateInput = (body: {
  target: 'skill' | 'plugin' | 'marketplace';
  skill_id?: string;
  skill_plugin_id?: string;
  skill_marketplace_id?: string;
}) => {
  if (body.target === 'skill' && body.skill_id) {
    return {
      target: 'skill' as const,
      skillId: body.skill_id
    };
  }

  if (body.target === 'plugin' && body.skill_plugin_id) {
    return {
      target: 'plugin' as const,
      skillPluginId: body.skill_plugin_id
    };
  }

  if (body.target === 'marketplace' && body.skill_marketplace_id) {
    return {
      target: 'marketplace' as const,
      skillMarketplaceId: body.skill_marketplace_id
    };
  }

  throw new ServiceError(
    badRequestError({
      message: `Missing export target identifier for ${body.target}`
    })
  );
};

let assertConsumerCanCreateExport = async (
  ctx: Parameters<typeof hasInstanceConsumerAccess>[0] & any,
  input: ReturnType<typeof getCreateInput>
) => {
  if (!hasInstanceConsumerAccess(ctx)) return;

  if (input.target === 'skill') {
    let access = await getSkillPluginAccess(ctx);
    await skillService.getSkillById({
      project: access.project,
      instance: access.instance,
      skillId: input.skillId,
      accessTags: ctx.accessTags
    });
    return;
  }

  if (input.target === 'marketplace') {
    let access = await getSkillPluginAccess(ctx);
    await skillMarketplaceService.getSkillMarketplaceById({
      ...access,
      ...getSkillMarketplaceAccessInput(ctx),
      skillMarketplaceId: input.skillMarketplaceId
    });
    return;
  }

  let paginator = await skillPluginService.listSkillPlugins({
    ...(await getSkillPluginAccess(ctx)),
    ids: [input.skillPluginId],
    ...getSkillMarketplaceAccessInput(ctx)
  });
  let list = await paginator.run({ limit: 1 });
  if (!list.items[0]) {
    throw new ServiceError(notFoundError('skill.plugin', input.skillPluginId));
  }
};

export let skillExportController = Controller.create(
  {
    name: 'Skill Exports',
    description: 'Export skills, skill plugins, and skill marketplaces as zip files.'
  },
  {
    list: instanceGroup
      .get(instancePath('skill-exports', 'skills.exports.list'), {
        name: 'List skill exports',
        description: 'Returns a paginated list of skill exports.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillExportPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            target: v.optional(v.union([targetValidator, v.array(targetValidator)])),
            status: v.optional(v.union([statusValidator, v.array(statusValidator)]))
          })
        )
      )
      .do(async ctx => {
        let access = await getSkillPluginAccess(ctx);
        let paginator = await skillExportService.listSkillExports({
          ...access,
          ids: normalizeArrayParam(ctx.query.id),
          targets: normalizeArrayParam(ctx.query.target),
          statuses: normalizeArrayParam(ctx.query.status),
          actor: hasInstanceConsumerAccess(ctx) ? access.actor : undefined
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillExport =>
          skillExportPresenter.present({ skillExport })
        );
      }),

    get: skillExportGroup
      .get(instancePath('skill-exports/:skillExportId', 'skills.exports.get'), {
        name: 'Get skill export',
        description: 'Retrieves a skill export.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillExportPresenter)
      .do(async ctx => skillExportPresenter.present({ skillExport: ctx.skillExport })),

    create: instanceGroup
      .post(instancePath('skill-exports', 'skills.exports.create'), {
        name: 'Create skill export',
        description: 'Creates a skill, plugin, or marketplace export.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body(
        'default',
        v.object({
          target: targetValidator,
          skill_id: v.optional(v.string()),
          skill_plugin_id: v.optional(v.string()),
          skill_marketplace_id: v.optional(v.string())
        })
      )
      .output(skillExportPresenter)
      .do(async ctx => {
        let input = getCreateInput(ctx.body);
        await assertConsumerCanCreateExport(ctx, input);

        let skillExport = await skillExportService.createSkillExport({
          ...(await getSkillPluginAccess(ctx)),
          input
        });

        return skillExportPresenter.present({ skillExport });
      })
  }
);
