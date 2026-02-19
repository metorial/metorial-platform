import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderAuthMethodService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { providerAuthMethodPresenter } from '../../presenters';

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
      .get(instancePath('providers/:providerId/auth-methods', 'providers.authMethods.list'), {
        name: 'List provider auth methods',
        description: 'Returns a paginated list of provider auth methods.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .outputList(providerAuthMethodPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_version_id: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderAuthMethodService.list({
          instance: ctx.instance,
          providerVersion: ctx.query.provider_version_id ?? ctx.provider.currentVersion!.id
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authMethod =>
          providerAuthMethodPresenter.present({ authMethod })
        );
      }),

    get: providerAuthMethodGroup
      .get(
        instancePath(
          'providers/:providerId/auth-methods/:providerAuthMethodId',
          'providers.authMethods.get'
        ),
        {
          name: 'Get provider auth method',
          description: 'Retrieves a specific provider auth method by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .output(providerAuthMethodPresenter)
      .do(async ctx => {
        return providerAuthMethodPresenter.present({
          authMethod: ctx.authMethod as unknown as SubspaceAuthMethod
        });
      })
  }
);
