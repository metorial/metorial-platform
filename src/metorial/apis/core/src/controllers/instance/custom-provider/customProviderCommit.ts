import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  customProviderCommitService,
  customProviderEnvironmentService,
  customProviderVersionService
} from '@metorial-subspace/module-custom-provider';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { subspaceCustomProviderCommitPresenter } from '@metorial/presenters';

let customProviderCommitGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.customProviderCommitId) {
    throw new ServiceError(
      badRequestError({
        message: 'customProviderCommitId is required',
        description: 'The customProviderCommitId path parameter is required.'
      })
    );
  }

  let customProviderCommit = await customProviderCommitService.getCustomProviderCommitById({
    instance: ctx.instance,
    customProviderCommitId: ctx.params.customProviderCommitId
  });

  return { customProviderCommit };
});

export let customProviderCommitController = Controller.create(
  {
    name: 'Custom Provider Commits',
    description:
      'Commits represent version promotions between environments. Merge versions from one environment to another or rollback to a previous version.',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('custom-provider-commits', 'customProviders.commits.list'), {
        name: 'List custom provider commits',
        description: 'Returns a paginated list of commits for a custom provider.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.custom.commit:read'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
      .outputList(subspaceCustomProviderCommitPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by commit IDs'
            }),
            custom_provider_version_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by version IDs' }
            ),
            custom_provider_environment_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by environment IDs' }
            ),
            custom_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by custom provider IDs'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            created_at: dateFilterValidator('custom provider commit creation time'),
            updated_at: dateFilterValidator('custom provider commit last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await customProviderCommitService.listCustomProviderCommits({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          customProviderVersionIds: normalizeArrayParam(ctx.query.custom_provider_version_id),
          customProviderEnvironmentIds: normalizeArrayParam(
            ctx.query.custom_provider_environment_id
          ),
          customProviderIds: normalizeArrayParam(ctx.query.custom_provider_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, customProviderCommit =>
          subspaceCustomProviderCommitPresenter.present({
            customProviderCommit: customProviderCommit
          })
        );
      }),

    get: customProviderCommitGroup
      .get(
        instancePath(
          'custom-provider-commits/:customProviderCommitId',
          'customProviders.commits.get'
        ),
        {
          name: 'Get custom provider commit',
          description: 'Retrieves a specific commit.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.custom.commit:read'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
      .output(subspaceCustomProviderCommitPresenter)
      .do(async ctx => {
        return subspaceCustomProviderCommitPresenter.present({
          customProviderCommit: ctx.customProviderCommit
        });
      }),

    create: instanceGroup
      .post(instancePath('custom-provider-commits', 'customProviders.commits.create'), {
        name: 'Create custom provider commit',
        description: 'Creates a new commit to promote or rollback a version in an environment.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.custom.commit:write'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
      .body(
        'default',
        v.object({
          message: v.string({
            description: 'Commit message',
            examples: ['Deploy v1.2.0 to production']
          }),
          action: v.union(
            [
              v.object(
                {
                  type: v.literal('merge_version_into_environment'),
                  from_environment_id: v.string({
                    description: 'Source environment ID',
                    examples: ['cpenv_1aBcDeFgHjKlMnPq']
                  }),
                  to_environment_id: v.string({
                    description: 'Target environment ID',
                    examples: ['cpenv_2bCdEfGhJkLmNpQr']
                  })
                },
                {
                  name: 'merge',
                  description: 'Merge a version from one environment to another'
                }
              ),
              v.object(
                {
                  type: v.literal('rollback_commit'),
                  environment_id: v.string({
                    description: 'Environment ID to rollback',
                    examples: ['cpenv_1aBcDeFgHjKlMnPq']
                  }),
                  version_id: v.string({
                    description: 'Version ID to rollback to',
                    examples: ['cpv_1aBcDeFgHjKlMnPq']
                  })
                },
                {
                  name: 'rollback',
                  description: 'Rollback an environment to a previous version'
                }
              )
            ],
            { description: 'The commit action to perform' }
          )
        })
      )
      .output(subspaceCustomProviderCommitPresenter)
      .do(async ctx => {
        let action =
          ctx.body.action.type === 'merge_version_into_environment'
            ? {
                type: 'merge_version_into_environment' as const,
                fromEnvironment:
                  await customProviderEnvironmentService.getCustomProviderEnvironmentById({
                    instance: ctx.instance,
                    customProviderEnvironmentId: ctx.body.action.from_environment_id,
                    includeOtherEnvironments: false
                  }),
                toEnvironment:
                  await customProviderEnvironmentService.getCustomProviderEnvironmentById({
                    instance: ctx.instance,
                    customProviderEnvironmentId: ctx.body.action.to_environment_id,
                    includeUnpublished: true,
                    includeOtherEnvironments: true
                  })
              }
            : {
                type: 'rollback_to_version' as const,
                environment:
                  await customProviderEnvironmentService.getCustomProviderEnvironmentById({
                    instance: ctx.instance,
                    customProviderEnvironmentId: ctx.body.action.environment_id,
                    includeOtherEnvironments: false
                  }),
                version: await customProviderVersionService.getCustomProviderVersionById({
                  instance: ctx.instance,
                  customProviderVersionId: ctx.body.action.version_id
                })
              };

        let customProviderCommit =
          await customProviderCommitService.createCustomProviderCommit({
            instance: ctx.instance,
            auditScope: ctx.auditScope,
            organizationActor: ctx.actor!,
            input: {
              message: ctx.body.message,
              action
            }
          });

        return subspaceCustomProviderCommitPresenter.present({
          customProviderCommit: customProviderCommit
        });
      })
  }
);
