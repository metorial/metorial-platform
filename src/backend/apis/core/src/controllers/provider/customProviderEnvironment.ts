import { badRequestError, ServiceError } from '@metorial/error';
import { customProviderEnvironmentService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { subspaceCustomProviderEnvironmentPresenter } from '../../presenters';
import { SubspaceCustomProviderEnvironment } from '../../presenters/types';
import { customProviderGroup } from './customProvider';

export let customProviderEnvironmentGroup = customProviderGroup.use(async ctx => {
  if (!ctx.params.customProviderEnvironmentId) {
    throw new ServiceError(
      badRequestError({
        message: 'customProviderEnvironmentId is required',
        description: 'The customProviderEnvironmentId path parameter is required.'
      })
    );
  }

  let customProviderEnvironment = await customProviderEnvironmentService.get({
    instance: ctx.instance,
    customProviderEnvironmentId: ctx.params.customProviderEnvironmentId
  });

  return { customProviderEnvironment };
});

export let customProviderEnvironmentController = Controller.create(
  {
    name: 'Custom Provider Environments',
    description:
      'Environments represent deployment targets for custom provider versions (e.g., staging, production).'
  },
  {
    list: customProviderGroup
      .get(
        instancePath(
          'custom-providers/:customProviderId/environments',
          'customProviders.environments.list'
        ),
        {
          name: 'List custom provider environments',
          description: 'Returns a paginated list of environments for a custom provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .outputList(subspaceCustomProviderEnvironmentPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            ids: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by environment IDs'
            }),
            custom_provider_version_ids: v.optional(
              v.union([v.string(), v.array(v.string())]),
              {
                description: 'Filter by version IDs'
              }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await customProviderEnvironmentService.list({
          instance: ctx.instance,
          customProviderIds: [ctx.customProvider.id],
          ids: normalizeArrayParam(ctx.query.ids),
          customProviderVersionIds: normalizeArrayParam(ctx.query.custom_provider_version_ids)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, customProviderEnvironment =>
          subspaceCustomProviderEnvironmentPresenter.present({
            customProviderEnvironment:
              customProviderEnvironment as SubspaceCustomProviderEnvironment
          })
        );
      }),

    get: customProviderEnvironmentGroup
      .get(
        instancePath(
          'custom-providers/:customProviderId/environments/:customProviderEnvironmentId',
          'customProviders.environments.get'
        ),
        {
          name: 'Get custom provider environment',
          description: 'Retrieves a specific environment.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .output(subspaceCustomProviderEnvironmentPresenter)
      .do(async ctx => {
        return subspaceCustomProviderEnvironmentPresenter.present({
          customProviderEnvironment:
            ctx.customProviderEnvironment as SubspaceCustomProviderEnvironment
        });
      })
  }
);
