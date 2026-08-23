import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import type { Instance, Organization } from '@metorial/db';
import { skillAgentService, skillService, type SkillResource } from '@metorial/module-skill';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { requireConsumerTokenForPublishableKey } from '../../../middleware/requireConsumerTokenForPublishableKey';
import { skillAgentPresenter } from '@metorial/presenters';
import { skillGroup } from './skill';

let skillReadScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;
let skillWriteScopes = ['instance.skill:write', 'consumer#instance.skill:write'] as const;

type SkillAgentContext = Parameters<typeof getInstanceCargoAccess>[0] & {
  instance: Instance;
  organization: Organization;
  skill: SkillResource;
};

let getSkillAgentInput = async (ctx: SkillAgentContext) => ({
  skillId: ctx.skill.id,
  ...(await getInstanceCargoAccess(ctx))
});

export let skillAgentGroup = skillGroup.use(async ctx => {
  if (!ctx.params.skillAgentId) {
    throw new Error('skillAgentId is required');
  }

  let skillAgent = await skillAgentService.getSkillAgentById({
    ...(await getSkillAgentInput(ctx)),
    skillAgentId: ctx.params.skillAgentId
  });

  if (skillAgent.skill.id !== ctx.skill.id) {
    throw new ServiceError(notFoundError('skill.agent', ctx.params.skillAgentId));
  }

  return { skillAgent };
});

export let skillAgentController = Controller.create(
  {
    name: 'Skill Agents',
    description: 'Manage sub-agents attached to a skill.'
  },
  {
    create: skillGroup
      .post(instancePath('skills/:skillId/agents', 'skills.agents.create'), {
        name: 'Create skill agent',
        description: 'Creates a new agent document in the skill agents directory.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.nullable(v.string())),
          content: v.optional(v.string())
        })
      )
      .output(skillAgentPresenter)
      .do(async ctx => {
        let access = await getSkillAgentInput(ctx);
        let skillAgent = await skillAgentService.createSkillAgent({
          ...access,
          skill: await skillService.getSkillById({
            ...access,
            skillId: ctx.skill.id
          }),
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            content: ctx.body.content,
            authorization: access.authorization,
            defaultPermissions: access.defaultPermissions,
            overridePermissions: access.overridePermissions
          }
        });

        return skillAgentPresenter.present({ skillAgent });
      }),

    list: skillGroup
      .get(instancePath('skills/:skillId/agents', 'skills.agents.list'), {
        name: 'List skill agents',
        description: 'Returns a paginated list of agents for a specific skill.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .outputList(skillAgentPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            include_archived: v.optional(v.boolean())
          })
        )
      )
      .do(async ctx => {
        let { include_archived, ...pagination } = ctx.query;
        let paginator = await skillAgentService.listSkillAgents({
          ...(await getSkillAgentInput(ctx)),
          includeArchived: include_archived
        });
        let list = await paginator.run(pagination);

        return Paginator.present(list, skillAgent =>
          skillAgentPresenter.present({ skillAgent })
        );
      }),

    get: skillAgentGroup
      .get(instancePath('skills/:skillId/agents/:skillAgentId', 'skills.agents.get'), {
        name: 'Get skill agent by ID',
        description: 'Retrieves a specific agent within a skill.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillAgentPresenter)
      .do(async ctx => skillAgentPresenter.present({ skillAgent: ctx.skillAgent })),

    update: skillAgentGroup
      .patch(instancePath('skills/:skillId/agents/:skillAgentId', 'skills.agents.update'), {
        name: 'Update skill agent',
        description: 'Updates the name or description for a specific skill agent.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.nullable(v.string()))
        })
      )
      .output(skillAgentPresenter)
      .do(async ctx => {
        let skillAgent = await skillAgentService.updateSkillAgent({
          ...(await getSkillAgentInput(ctx)),
          skillAgent: ctx.skillAgent,
          input: {
            name: ctx.body.name,
            description: ctx.body.description
          }
        });

        return skillAgentPresenter.present({ skillAgent });
      }),

    delete: skillAgentGroup
      .delete(instancePath('skills/:skillId/agents/:skillAgentId', 'skills.agents.delete'), {
        name: 'Delete skill agent',
        description: 'Archives a specific skill agent and removes its linked store item.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .use(requireConsumerTokenForPublishableKey())
      .output(skillAgentPresenter)
      .do(async ctx => {
        let skillAgent = await skillAgentService.deleteSkillAgent({
          ...(await getSkillAgentInput(ctx)),
          skillAgent: ctx.skillAgent
        });

        return skillAgentPresenter.present({ skillAgent });
      })
  }
);
