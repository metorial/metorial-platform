import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { skillPluginRepositoryService, skillPluginService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instancePath } from '../../../middleware/instanceGroup';
import { isDashboardGroup } from '../../../middleware/isDashboard';
import { bucketEditorTokenPresenter, skillPluginRepositoryPresenter } from '../../../presenters';
import { getSkillPluginAccess, skillPluginGroup } from './skillPlugin';

let readScopes = ['instance.skill:read'] as const;
let writeScopes = ['instance.skill:write'] as const;

export let skillPluginRepositoryController = Controller.create(
  {
    name: 'Skill Plugin Repositories',
    description: 'Manage repositories linked to skill plugins for an instance.'
  },
  {
    list: skillPluginGroup
      .get(
        instancePath(
          'skill-plugins/:skillPluginId/repositories',
          'skills.plugins.repositories.list'
        ),
        {
          name: 'List skill plugin repositories',
          description: 'Returns repositories linked to a skill plugin.'
        }
      )
      .use(isDashboardGroup())
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .outputList(skillPluginRepositoryPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await skillPluginRepositoryService.listSkillPluginRepositories({
          ...getSkillPluginAccess(ctx),
          skillPlugin: ctx.skillPlugin
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, skillPluginRepository =>
          skillPluginRepositoryPresenter.present({ skillPluginRepository })
        );
      }),

    get: skillPluginGroup
      .get(
        instancePath(
          'skill-plugins/:skillPluginId/repositories/:skillPluginRepositoryId',
          'skills.plugins.repositories.get'
        ),
        {
          name: 'Get skill plugin repository',
          description: 'Retrieves a repository linked to a skill plugin.'
        }
      )
      .use(isDashboardGroup())
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...readScopes] }))
      .output(skillPluginRepositoryPresenter)
      .do(async ctx => {
        let skillPluginRepository =
          await skillPluginRepositoryService.getSkillPluginRepositoryById({
            ...getSkillPluginAccess(ctx),
            skillPlugin: ctx.skillPlugin,
            skillPluginRepositoryId: ctx.params.skillPluginRepositoryId
          });

        return skillPluginRepositoryPresenter.present({ skillPluginRepository });
      }),

    create: skillPluginGroup
      .post(
        instancePath(
          'skill-plugins/:skillPluginId/repositories',
          'skills.plugins.repositories.create'
        ),
        {
          name: 'Link skill plugin repository',
          description: 'Links an SCM repository to a skill plugin.'
        }
      )
      .use(isDashboardGroup())
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body(
        'default',
        v.object({
          repo_id: v.string()
        })
      )
      .output(skillPluginRepositoryPresenter)
      .do(async ctx => {
        let skillPluginRepository =
          await skillPluginRepositoryService.createSkillPluginRepository({
            ...getSkillPluginAccess(ctx),
            skillPlugin: ctx.skillPlugin,
            repoId: ctx.body.repo_id
          });

        return skillPluginRepositoryPresenter.present({ skillPluginRepository });
      }),

    delete: skillPluginGroup
      .delete(
        instancePath(
          'skill-plugins/:skillPluginId/repositories/:skillPluginRepositoryId',
          'skills.plugins.repositories.delete'
        ),
        {
          name: 'Unlink skill plugin repository',
          description: 'Unlinks an SCM repository from a skill plugin.'
        }
      )
      .use(isDashboardGroup())
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .output(skillPluginRepositoryPresenter)
      .do(async ctx => {
        let skillPluginRepository =
          await skillPluginRepositoryService.deleteSkillPluginRepository({
            ...getSkillPluginAccess(ctx),
            skillPlugin: ctx.skillPlugin,
            skillPluginRepositoryId: ctx.params.skillPluginRepositoryId
          });

        return skillPluginRepositoryPresenter.present({ skillPluginRepository });
      }),

    getEditorUrl: skillPluginGroup
      .post(
        instancePath('skill-plugins/:skillPluginId/editor-url', 'skills.plugins.getEditorUrl'),
        {
          name: 'Get skill plugin editor URL',
          description: 'Creates an embeddable editor URL for a skill plugin.',
          hideInDocs: true
        }
      )
      .use(isDashboardGroup())
      .use(hasFlags(['skills-enabled']))
      .use(checkAccess({ possibleScopes: [...writeScopes] }))
      .body('default', v.object({}))
      .output(bucketEditorTokenPresenter)
      .do(async ctx => {
        let token = await skillPluginService.getSkillPluginEditorUrl({
          ...getSkillPluginAccess(ctx),
          skillPlugin: ctx.skillPlugin,
          isReadOnly: true
        });

        return bucketEditorTokenPresenter.present({
          token: {
            id: ctx.skillPlugin.backing.id,
            url: token.url,
            expiresAt: token.expiresAt
          }
        });
      })
  }
);
