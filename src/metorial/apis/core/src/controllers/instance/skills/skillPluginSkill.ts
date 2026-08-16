import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillPluginSkillService } from '@metorial/module-skill-marketplace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillPluginSkillPresenter } from '@metorial/presenters';
import { getSkillPluginAccess, skillPluginGroup } from './skillPlugin';

let readScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let writeScopes = ['instance.skill:write'] as const;

let skillPluginSkillInput = {
  client_name: v.optional(v.nullable(v.string())),
  client_description: v.optional(v.nullable(v.string())),
  client_metadata: v.optional(v.nullable(v.record(v.any()))),
  license: v.optional(v.nullable(v.string())),
  compatibility: v.optional(v.nullable(v.string())),
  skill_configuration_id: v.optional(v.nullable(v.string()))
};

export let skillPluginSkillGroup = skillPluginGroup.use(async ctx => {
  if (!ctx.params.skillPluginSkillId) {
    throw new ServiceError(
      badRequestError({
        message: 'skillPluginSkillId is required',
        description: 'The skillPluginSkillId path parameter is required.'
      })
    );
  }

  let skillPluginSkill = await skillPluginSkillService.getSkillPluginSkillById({
    ...(await getSkillPluginAccess(ctx)),
    skillPlugin: ctx.skillPlugin,
    skillPluginSkillId: ctx.params.skillPluginSkillId
  });

  return { skillPluginSkill };
});

export let skillPluginSkillController = Controller.create(
  {
    name: 'Skill Plugin Skills',
    description: 'Manage skill links for skill plugins.'
  },
  {
    list: skillPluginGroup
      .get(instancePath('skill-plugins/:skillPluginId/skills', 'skills.plugins.skills.list'), {
        name: 'List skill plugin skills',
        description: 'Returns skills linked to a skill plugin.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillPluginSkillPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            skill_id: v.optional(v.union([v.string(), v.array(v.string())])),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            ),
            skill_configuration_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('skill plugin skill creation time'),
            updated_at: dateFilterValidator('skill plugin skill last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await skillPluginSkillService.listSkillPluginSkills({
          ...(await getSkillPluginAccess(ctx)),
          skillPlugin: ctx.skillPlugin,
          ids: normalizeArrayParam(ctx.query.id),
          skillIds: normalizeArrayParam(ctx.query.skill_id),
          statuses: normalizeArrayParam(ctx.query.status),
          skillConfigurationIds: normalizeArrayParam(ctx.query.skill_configuration_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillPluginSkill =>
          skillPluginSkillPresenter.present({ skillPluginSkill })
        );
      }),

    add: skillPluginGroup
      .post(instancePath('skill-plugins/:skillPluginId/skills', 'skills.plugins.skills.add'), {
        name: 'Add skill plugin skill',
        description: 'Adds a skill to a skill plugin.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body(
        'default',
        v.object({
          skill_id: v.string(),
          identifier: v.optional(v.string()),
          ...skillPluginSkillInput
        })
      )
      .output(skillPluginSkillPresenter)
      .do(async ctx => {
        let skillPluginSkill = await skillPluginSkillService.addSkillPluginSkill({
          ...(await getSkillPluginAccess(ctx)),
          skillPlugin: ctx.skillPlugin,
          input: {
            skillId: ctx.body.skill_id,
            pluginSkillSlug: ctx.body.identifier,
            clientName: ctx.body.client_name,
            clientDescription: ctx.body.client_description,
            clientMetadata: ctx.body.client_metadata,
            license: ctx.body.license,
            compatibility: ctx.body.compatibility,
            skillConfigurationId: ctx.body.skill_configuration_id
          }
        });

        return skillPluginSkillPresenter.present({ skillPluginSkill });
      }),

    get: skillPluginSkillGroup
      .get(
        instancePath(
          'skill-plugins/:skillPluginId/skills/:skillPluginSkillId',
          'skills.plugins.skills.get'
        ),
        {
          name: 'Get skill plugin skill',
          description: 'Retrieves a skill plugin skill link.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillPluginSkillPresenter)
      .do(async ctx =>
        skillPluginSkillPresenter.present({ skillPluginSkill: ctx.skillPluginSkill })
      ),

    update: skillPluginSkillGroup
      .patch(
        instancePath(
          'skill-plugins/:skillPluginId/skills/:skillPluginSkillId',
          'skills.plugins.skills.update'
        ),
        {
          name: 'Update skill plugin skill',
          description: 'Updates a skill plugin skill link.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body('default', v.object(skillPluginSkillInput))
      .output(skillPluginSkillPresenter)
      .do(async ctx => {
        let skillPluginSkill = await skillPluginSkillService.updateSkillPluginSkill({
          ...(await getSkillPluginAccess(ctx)),
          skillPluginSkill: ctx.skillPluginSkill,
          input: {
            clientName: ctx.body.client_name,
            clientDescription: ctx.body.client_description,
            clientMetadata: ctx.body.client_metadata,
            license: ctx.body.license,
            compatibility: ctx.body.compatibility,
            skillConfigurationId: ctx.body.skill_configuration_id
          }
        });

        return skillPluginSkillPresenter.present({ skillPluginSkill });
      }),

    remove: skillPluginSkillGroup
      .delete(
        instancePath(
          'skill-plugins/:skillPluginId/skills/:skillPluginSkillId',
          'skills.plugins.skills.remove'
        ),
        {
          name: 'Remove skill plugin skill',
          description: 'Removes a skill from a skill plugin.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .output(skillPluginSkillPresenter)
      .do(async ctx => {
        let skillPluginSkill = await skillPluginSkillService.removeSkillPluginSkill({
          ...(await getSkillPluginAccess(ctx)),
          skillPluginSkill: ctx.skillPluginSkill
        });

        return skillPluginSkillPresenter.present({ skillPluginSkill });
      })
  }
);
