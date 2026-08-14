import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import type { Instance, Organization } from '@metorial/db';
import { skillConfigurationService } from '@metorial/cargo-module-skill';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { skillConfigurationPresenter } from '@metorial/presenters';

let skillReadScopes = ['instance.skill:read'] as const;
let skillWriteScopes = ['instance.skill:write'] as const;

let skillConfigurationInput = {
  allow_scripts: v.optional(v.boolean()),
  allowed_file_extensions: v.optional(v.nullable(v.array(v.string()))),
  allow_non_standard_directories: v.optional(v.boolean())
};

type SkillConfigurationContext = Parameters<typeof getInstanceCargoAccess>[0] & {
  instance: Instance;
  organization: Organization;
};

let getSkillConfigurationInput = (ctx: SkillConfigurationContext) => getInstanceCargoAccess(ctx);

export let skillConfigurationGroup = instanceGroup
  .use(hasFlags(['skills-enabled']))
  .use(async ctx => {
    if (!ctx.params.skillConfigurationId) {
      throw new Error('skillConfigurationId is required');
    }

    let skillConfiguration = await skillConfigurationService.getSkillConfigurationById({
      ...(await getSkillConfigurationInput(ctx)),
      skillConfigurationId: ctx.params.skillConfigurationId
    });

    return { skillConfiguration };
  });

export let skillConfigurationController = Controller.create(
  {
    name: 'Skill Configurations',
    description: 'Manage configuration profiles for skill execution.'
  },
  {
    create: instanceGroup
      .post(instancePath('skills/configurations', 'skills.configurations.create'), {
        name: 'Create skill configuration',
        description: 'Creates a new non-default skill configuration.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .body('default', v.object(skillConfigurationInput))
      .output(skillConfigurationPresenter)
      .do(async ctx => {
        let skillConfiguration = await skillConfigurationService.createSkillConfiguration({
          ...(await getSkillConfigurationInput(ctx)),
          input: {
            allowScripts: ctx.body.allow_scripts,
            allowedFileExtensions: ctx.body.allowed_file_extensions,
            allowNonStandardDirectories: ctx.body.allow_non_standard_directories
          }
        });

        return skillConfigurationPresenter.present({ skillConfiguration });
      }),

    list: instanceGroup
      .get(instancePath('skills/configurations', 'skills.configurations.list'), {
        name: 'List skill configurations',
        description: 'Returns a paginated list of visible skill configurations.'
      })
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .outputList(skillConfigurationPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await skillConfigurationService.listSkillConfigurations({
          ...(await getSkillConfigurationInput(ctx))
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillConfiguration =>
          skillConfigurationPresenter.present({ skillConfiguration })
        );
      }),

    get: skillConfigurationGroup
      .get(
        instancePath(
          'skills/configurations/:skillConfigurationId',
          'skills.configurations.get'
        ),
        {
          name: 'Get skill configuration',
          description: 'Retrieves a specific skill configuration by ID, or the default.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillReadScopes] }))
      .output(skillConfigurationPresenter)
      .do(async ctx =>
        skillConfigurationPresenter.present({ skillConfiguration: ctx.skillConfiguration })
      ),

    update: skillConfigurationGroup
      .patch(
        instancePath(
          'skills/configurations/:skillConfigurationId',
          'skills.configurations.update'
        ),
        {
          name: 'Update skill configuration',
          description:
            'Updates a specific skill configuration. Updating default creates it first if needed.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .body('default', v.object(skillConfigurationInput))
      .output(skillConfigurationPresenter)
      .do(async ctx => {
        let skillConfiguration = await skillConfigurationService.updateSkillConfiguration({
          ...(await getSkillConfigurationInput(ctx)),
          skillConfigurationId: ctx.params.skillConfigurationId,
          input: {
            allowScripts: ctx.body.allow_scripts,
            allowedFileExtensions: ctx.body.allowed_file_extensions,
            allowNonStandardDirectories: ctx.body.allow_non_standard_directories
          }
        });

        return skillConfigurationPresenter.present({ skillConfiguration });
      }),

    delete: skillConfigurationGroup
      .delete(
        instancePath(
          'skills/configurations/:skillConfigurationId',
          'skills.configurations.delete'
        ),
        {
          name: 'Delete skill configuration',
          description: 'Soft deletes a specific non-internal skill configuration.'
        }
      )
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...skillWriteScopes] }))
      .output(skillConfigurationPresenter)
      .do(async ctx => {
        let skillConfiguration = await skillConfigurationService.deleteSkillConfiguration({
          ...(await getSkillConfigurationInput(ctx)),
          skillConfigurationId: ctx.skillConfiguration.id
        });

        return skillConfigurationPresenter.present({ skillConfiguration });
      })
  }
);
