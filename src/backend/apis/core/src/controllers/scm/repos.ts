import { subspaceScmRepositoryService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { scmRepoPresenter, scmRepoPreviewPresenter } from '../../presenters';

export let scmReposController = Controller.create(
  {
    name: 'SCM Repos',
    description: 'Manage source control repositories.'
  },
  {
    preview: instanceGroup
      .post(instancePath('scm/repos/preview', 'scm.repos.preview'), {
        name: 'Preview SCM repos',
        description: 'Lists available repositories from an SCM installation.'
      })
      .use(checkAccess({ possibleScopes: ['instance.scm.repo:read'] }))
      .body(
        'default',
        v.object({
          installation_id: v.string({ description: 'SCM installation ID' }),
          external_account_id: v.optional(
            v.string({ description: 'Filter by external account ID' })
          )
        })
      )
      .output(scmRepoPreviewPresenter)
      .do(async ctx => {
        let repoPreviews = await subspaceScmRepositoryService.listRepositoryPreviews({
          instance: ctx.instance,
          scmConnectionId: ctx.body.installation_id,
          externalAccountId: ctx.body.external_account_id
        });

        return scmRepoPreviewPresenter.present({
          repoPreviews
        });
      }),

    create: instanceGroup
      .post(instancePath('scm/repos', 'scm.repos.create'), {
        name: 'Create SCM repo',
        description: 'Links or creates a repository in an SCM installation.'
      })
      .use(checkAccess({ possibleScopes: ['instance.scm.repo:write'] }))
      .body(
        'default',
        v.intersection([
          v.object({
            installation_id: v.string({ description: 'SCM installation ID' })
          }),
          v.union([
            v.object({
              external_repo_id: v.string({
                description: 'External repo ID to link an existing repo'
              })
            }),

            v.object({
              external_account_id: v.string({
                description: 'External account ID for creating a new repo'
              }),
              name: v.string({ description: 'Name for a new repository' }),
              is_private: v.optional(
                v.boolean({ description: 'Whether the new repo is private' })
              )
            })
          ])
        ])
      )
      .output(scmRepoPresenter)
      .do(async ctx => {
        if ('external_repo_id' in ctx.body) {
          let scmRepo = await subspaceScmRepositoryService.linkRepository({
            instance: ctx.instance,
            scmConnectionId: ctx.body.installation_id,
            externalId: ctx.body.external_repo_id
          });

          return scmRepoPresenter.present({
            scmRepo
          });
        }

        let scmRepo = await subspaceScmRepositoryService.createRepository({
          instance: ctx.instance,
          scmConnectionId: ctx.body.installation_id,
          externalAccountId: ctx.body.external_account_id,
          name: ctx.body.name,
          isPrivate: !!ctx.body.is_private
        });

        return scmRepoPresenter.present({
          scmRepo
        });
      })
  }
);
