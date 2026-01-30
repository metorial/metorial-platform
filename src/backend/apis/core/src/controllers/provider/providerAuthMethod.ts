import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderAuthMethodService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { providerPath } from '../../middleware/providerGroup';
import { providerAuthMethodPresenter } from '../../presenters';
import { SubspaceAuthMethod } from '../../presenters/types';
import { providerGroup } from './provider';

export let providerAuthMethodGroup = providerGroup.use(async ctx => {
  if (!ctx.params.providerAuthMethodId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerAuthMethodId is required',
        description: 'The providerAuthMethodId path parameter is required.'
      })
    );
  }

  let authMethod = await subspaceProviderAuthMethodService.get({
    instance: ctx.instance,
    providerAuthMethodId: ctx.params.providerAuthMethodId
  });

  return { authMethod };
});

export let providerAuthMethodController = Controller.create(
  {
    name: 'Provider Auth Methods',
    description:
      'An auth method defines one way to authenticate with a provider (OAuth, API token, or custom credentials). A provider version may support multiple auth methods.'
  },
  {
    list: providerGroup
      .get(providerPath('providers/:providerId/auth-methods', 'providers.authMethods.list'), {
        name: 'List provider auth methods',
        description: 'Returns a paginated list of provider auth methods.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .outputList(providerAuthMethodPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await subspaceProviderAuthMethodService.list({
          instance: ctx.instance,
          providerId: ctx.provider.id
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authMethod =>
          providerAuthMethodPresenter.present({ authMethod: authMethod as SubspaceAuthMethod })
        );
      }),

    get: providerAuthMethodGroup
      .get(
        providerPath('providers/:providerId/auth-methods/:providerAuthMethodId', 'providers.authMethods.get'),
        {
          name: 'Get provider auth method',
          description: 'Retrieves a specific provider auth method by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .output(providerAuthMethodPresenter)
      .do(async ctx => {
        return providerAuthMethodPresenter.present({ authMethod: ctx.authMethod });
      })
  }
);
