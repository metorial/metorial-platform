import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { scmRepositoryService } from '@metorial-subspace/module-custom-provider';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { scmRepoPresenter, scmRepoPreviewPresenter } from '@metorial/presenters';

let scmRepoGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.scmRepositoryId) {
    throw new ServiceError(
      badRequestError({
        message: 'scmRepositoryId is required',
        description: 'The scmRepositoryId path parameter is required.'
      })
    );
  }

  let scmRepo = await scmRepositoryService.getScmRepositoryById({
    instance: ctx.instance,
    scmRepositoryId: ctx.params.scmRepositoryId
  });

  return { scmRepo };
});

export let scmReposController = Controller.create(
  {
    name: 'SCM Repos',
    description: 'Manage source control repositories.'
  },
  {
    list: instanceGroup
      .get(instancePath('scm/repos', 'scm.repos.list'), {
        name: 'List SCM repos',
        description: 'Returns a paginated list of SCM repositories.'
      })
      .use(checkAccess({ possibleScopes: ['instance.scm.repo:read'] }))
      .outputList(scmRepoPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by repository ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by SCM provider ID(s)'
            }),
            created_at: dateFilterValidator('SCM repository creation time'),
            updated_at: dateFilterValidator('SCM repository last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await scmRepositoryService.listScmRepositories({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          customProviderIds: normalizeArrayParam(ctx.query.provider_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, scmRepo =>
          scmRepoPresenter.present({
            scmRepo
          })
        );
      }),

    get: scmRepoGroup
      .get(instancePath('scm/repos/:scmRepositoryId', 'scm.repos.get'), {
        name: 'Get SCM repo',
        description: 'Retrieves a specific SCM repository by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.scm.repo:read'] }))
      .output(scmRepoPresenter)
      .do(async ctx => {
        return scmRepoPresenter.present({
          scmRepo: ctx.scmRepo
        });
      }),

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
          ),
          cursor: v.optional(v.string({ description: 'Cursor from a previous repository preview page' })),
          limit: v.optional(
            v.number({
              description: 'Maximum number of repositories to return (defaults to 50)',
              modifiers: [v.minValue(1), v.maxValue(100)]
            })
          )
        })
      )
      .output(scmRepoPreviewPresenter)
      .do(async ctx => {
        let repoPreviews = await scmRepositoryService.listScmRepositoryPreviews({
          instance: ctx.instance,
          input: {
            scmConnectionId: ctx.body.installation_id,
            externalAccountId: ctx.body.external_account_id,
            cursor: ctx.body.cursor,
            limit: ctx.body.limit
          }
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
          let scmRepo = await scmRepositoryService.linkScmRepository({
            instance: ctx.instance,
            auditScope: ctx.auditScope,
            input: {
              scmConnectionId: ctx.body.installation_id,
              externalId: ctx.body.external_repo_id
            }
          });

          return scmRepoPresenter.present({
            scmRepo
          });
        }

        let scmRepo = await scmRepositoryService.createScmRepository({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          input: {
            scmConnectionId: ctx.body.installation_id,
            externalAccountId: (ctx.body as any).external_account_id,
            name: (ctx.body as any).name,
            isPrivate: !!(ctx.body as any).is_private
          }
        });

        return scmRepoPresenter.present({
          scmRepo
        });
      })
  }
);
