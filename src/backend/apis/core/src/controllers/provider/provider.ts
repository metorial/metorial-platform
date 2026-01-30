import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { providerInstanceGroup, providerPath } from '../../middleware/providerGroup';
import { providerPresenter } from '../../presenters';
import { SubspaceProvider } from '../../presenters/types';

export let providerGroup = providerInstanceGroup.use(async ctx => {
  if (!ctx.params.providerId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerId is required',
        description: 'The providerId path parameter is required.'
      })
    );
  }

  let provider = await subspaceProviderService.get({
    instance: ctx.instance,
    providerId: ctx.params.providerId
  });

  return { provider };
});

export let providerController = Controller.create(
  {
    name: 'Providers',
    description:
      'A provider is a read-only template for an MCP server integration (like GitHub or Slack). To use a provider, create a deployment from it.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('providers', 'providers.list'), {
        name: 'List providers',
        description: 'Returns a paginated list of providers.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .outputList(providerPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            publisher_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by publisher ID(s)' }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderService.list({
          instance: ctx.instance,
          publisherIds: normalizeArrayParam(ctx.query.publisher_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, provider =>
          providerPresenter.present({ provider: provider as SubspaceProvider })
        );
      }),

    get: providerGroup
      .get(providerPath('providers/:providerId', 'providers.get'), {
        name: 'Get provider',
        description: 'Retrieves a specific provider by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .output(providerPresenter)
      .do(async ctx => {
        return providerPresenter.present({ provider: ctx.provider });
      })
  }
);
