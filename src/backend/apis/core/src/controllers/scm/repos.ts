import { scmRepositoryService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { scmRepoPresenter, scmRepoPreviewPresenter } from '../../presenters';
import { ScmRepo, ScmRepoPreview } from '../../presenters/types';

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
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .body(
        'default',
        v.object({
          installation_id: v.string({ description: 'SCM installation ID' }),
          external_account_id: v.optional(
            v.string({ description: 'Filter by external account ID' })
          )
        })
      )
      .outputList(scmRepoPreviewPresenter)
      .do(async ctx => {
        let repos = await (scmRepositoryService as any).listRepositoryPreviews({
          instance: ctx.instance,
          scmConnectionId: ctx.body.installation_id,
          externalAccountId: ctx.body.external_account_id
        });

        let items = (repos as any)?.items ?? repos ?? [];

        return {
          object: 'list' as const,
          items: await Promise.all(
            (Array.isArray(items) ? items : []).map((r: any) =>
              scmRepoPreviewPresenter.present({ repoPreview: r as ScmRepoPreview })
            )
          )
        };
      }),

    create: instanceGroup
      .post(instancePath('scm/repos', 'scm.repos.create'), {
        name: 'Create SCM repo',
        description: 'Links or creates a repository in an SCM installation.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:write'] }))
      .body(
        'default',
        v.object({
          installation_id: v.string({ description: 'SCM installation ID' }),
          external_repo_id: v.optional(
            v.string({ description: 'External repo ID to link an existing repo' })
          ),
          external_account_id: v.optional(
            v.string({ description: 'External account ID for creating a new repo' })
          ),
          name: v.optional(v.string({ description: 'Name for a new repository' })),
          is_private: v.optional(v.boolean({ description: 'Whether the new repo is private' }))
        })
      )
      .output(scmRepoPresenter)
      .do(async ctx => {
        let repo: any;

        if (ctx.body.external_repo_id) {
          repo = await (scmRepositoryService as any).linkRepository({
            instance: ctx.instance,
            organizationActor: ctx.actor,
            scmConnectionId: ctx.body.installation_id,
            externalId: ctx.body.external_repo_id,
            name: ctx.body.name
          });
        } else {
          repo = await (scmRepositoryService as any).createRepository({
            instance: ctx.instance,
            organizationActor: ctx.actor,
            scmConnectionId: ctx.body.installation_id,
            externalAccountId: ctx.body.external_account_id,
            name: ctx.body.name ?? 'untitled',
            isPrivate: ctx.body.is_private ?? true
          });
        }

        let scmRepo = repo?.scmRepository ?? repo;

        return scmRepoPresenter.present({
          scmRepo: scmRepo as ScmRepo
        });
      })
  }
);
