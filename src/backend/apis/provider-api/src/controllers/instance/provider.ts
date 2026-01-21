import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { providerInstanceGroup, providerPath } from '../../middleware';
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
    description: 'Browse and manage MCP providers available in the catalog.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('providers', 'providers.list'), {
        name: 'List providers',
        description: 'Returns a paginated list of providers.'
      })
      .outputList(providerPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            publisher_id: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderService.list({
          instance: ctx.instance,
          publisherId: ctx.query.publisher_id
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
      .output(providerPresenter)
      .do(async ctx => {
        return providerPresenter.present({ provider: ctx.provider });
      })
  }
);
