import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { subspaceCustomProviderEnvironmentService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../lib/dateFilter';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { subspaceCustomProviderEnvironmentPresenter } from '../../presenters';

let customProviderEnvironmentGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.customProviderEnvironmentId) {
    throw new ServiceError(
      badRequestError({
        message: 'customProviderEnvironmentId is required',
        description: 'The customProviderEnvironmentId path parameter is required.'
      })
    );
  }

  let customProviderEnvironment = await subspaceCustomProviderEnvironmentService.get({
    instance: ctx.instance,
    customProviderEnvironmentId: ctx.params.customProviderEnvironmentId
  });

  return { customProviderEnvironment };
});

export let customProviderEnvironmentController = Controller.create(
  {
    name: 'Custom Provider Environments',
    description:
      'Environments represent deployment targets for custom provider versions (e.g., staging, production).',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('custom-provider-environments', 'customProviders.environments.list'), {
        name: 'List custom provider environments',
        description: 'Returns a paginated list of environments for a custom provider.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.custom.environment:read'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
      .outputList(subspaceCustomProviderEnvironmentPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by environment IDs'
            }),
            custom_provider_version_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by version IDs' }
            ),
            custom_provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by custom provider IDs'
            }),
            created_at: dateFilterValidator('custom provider environment creation time'),
            updated_at: dateFilterValidator('custom provider environment last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceCustomProviderEnvironmentService.list({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.id),
          customProviderVersionIds: normalizeArrayParam(ctx.query.custom_provider_version_id),
          customProviderIds: normalizeArrayParam(ctx.query.custom_provider_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, customProviderEnvironment =>
          subspaceCustomProviderEnvironmentPresenter.present({
            customProviderEnvironment
          })
        );
      }),

    get: customProviderEnvironmentGroup
      .get(
        instancePath(
          'custom-provider-environments/:customProviderEnvironmentId',
          'customProviders.environments.get'
        ),
        {
          name: 'Get custom provider environment',
          description: 'Retrieves a specific environment.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.custom.environment:read'] }))
      .use(hasFlags(['custom-providers-enabled', 'paid-custom-providers']))
      .output(subspaceCustomProviderEnvironmentPresenter)
      .do(async ctx => {
        return subspaceCustomProviderEnvironmentPresenter.present({
          customProviderEnvironment: ctx.customProviderEnvironment
        });
      })
  }
);
