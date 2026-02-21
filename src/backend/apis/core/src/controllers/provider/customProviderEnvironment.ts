import { badRequestError, ServiceError } from '@metorial/error';
import {
  subspaceCustomProviderEnvironmentService,
  type SubspaceCustomProviderEnvironment
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { subspaceCustomProviderEnvironmentPresenter } from '../../presenters';

export let customProviderEnvironmentGroup = instanceGroup.use(async ctx => {
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
      'Environments represent deployment targets for custom provider versions (e.g., staging, production).'
  },
  {
    list: instanceGroup
      .get(instancePath('custom-provider-environments', 'customProviders.environments.list'), {
        name: 'List custom provider environments',
        description: 'Returns a paginated list of environments for a custom provider.'
      })
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
              { description: 'Filter by version IDs' }
            ),
            custom_provider_ids: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by custom provider IDs'
            })

            //          ids: string[] | undefined;
            // customProviderIds: string[] | undefined;
            // customProviderVersionIds: string[] | undefined;
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceCustomProviderEnvironmentService.list({
          instance: ctx.instance,
          ids: normalizeArrayParam(ctx.query.ids),
          customProviderVersionIds: normalizeArrayParam(ctx.query.custom_provider_version_ids),
          customProviderIds: normalizeArrayParam(ctx.query.custom_provider_ids)
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
          'custom-provider-environments/:customProviderEnvironmentId',
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
