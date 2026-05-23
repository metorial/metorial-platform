import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import type { Instance, Organization } from '@metorial/db';
import { skillVersionService } from '@metorial/module-file';
import type { SubspaceSkill } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { skillVersionPresenter, skillVersionSnapshotPresenter } from '../../../presenters';
import { skillGroup } from './skill';

let skillReadScopes = ['instance.skill:read', 'consumer#instance.skill:read'] as const;

type SkillVersionContext = Parameters<typeof getInstanceCargoAccess>[0] & {
  instance: Instance;
  organization: Organization;
  skill: SubspaceSkill;
};

let getSkillVersionInput = (ctx: SkillVersionContext) => ({
  owner: {
    type: 'instance' as const,
    instance: ctx.instance,
    organization: ctx.organization
  },
  skillId: ctx.skill.id,
  storeId: ctx.skill.storeId,
  ...getInstanceCargoAccess(ctx)
});

export let skillVersionGroup = skillGroup.use(async ctx => {
  if (!ctx.params.skillVersionId) {
    throw new Error('skillVersionId is required');
  }

  let skillVersion = await skillVersionService.getSkillVersionById({
    ...getSkillVersionInput(ctx),
    skillVersionId: ctx.params.skillVersionId
  });

  if (skillVersion.skillId !== ctx.skill.id) {
    throw new ServiceError(notFoundError('skill.version', ctx.params.skillVersionId));
  }

  return { skillVersion };
});

export let skillVersionController = Controller.create(
  {
    name: 'Skill Versions',
    description: 'Inspect version history and snapshots for a skill.'
  },
  {
    list: skillGroup
      .get(instancePath('skills/:skillId/versions', 'skills.versions.list'), {
        name: 'List skill versions',
        description: 'Returns a paginated list of versions for a specific skill.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .outputList(skillVersionPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await skillVersionService.listSkillVersions(getSkillVersionInput(ctx));
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillVersion =>
          skillVersionPresenter.present({ skillVersion })
        );
      }),

    get: skillVersionGroup
      .get(instancePath('skills/:skillId/versions/:skillVersionId', 'skills.versions.get'), {
        name: 'Get skill version by ID',
        description: 'Retrieves a specific skill version by its ID.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .output(skillVersionPresenter)
      .do(async ctx => skillVersionPresenter.present({ skillVersion: ctx.skillVersion })),

    getSnapshot: skillVersionGroup
      .get(
        instancePath(
          'skills/:skillId/versions/:skillVersionId/snapshot',
          'skills.versions.snapshot.get'
        ),
        {
          name: 'Get skill version snapshot',
          description: 'Retrieves the store-backed snapshot for a specific skill version.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .output(skillVersionSnapshotPresenter)
      .do(async ctx => {
        let snapshot = await skillVersionService.getSkillVersionSnapshot({
          ...getSkillVersionInput(ctx),
          skillVersionId: ctx.skillVersion.id
        });

        return skillVersionSnapshotPresenter.present({ skillVersionSnapshot: snapshot });
      })
  }
);
