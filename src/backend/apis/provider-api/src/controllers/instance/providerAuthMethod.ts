import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderAuthMethodService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { providerInstanceGroup, providerPath } from '../../middleware';
import { authMethodPresenter } from '../../presenters';
import { SubspaceAuthMethod } from '../../presenters/types';

export let providerAuthMethodGroup = providerInstanceGroup.use(async ctx => {
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
    description: 'Browse authentication methods available for providers.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('provider-auth-methods', 'providerAuthMethods.list'), {
        name: 'List provider auth methods',
        description: 'Returns a paginated list of provider auth methods.'
      })
      .outputList(authMethodPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(v.string()),
            provider_specification_id: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderAuthMethodService.list({
          instance: ctx.instance,
          providerId: ctx.query.provider_id,
          providerSpecificationId: ctx.query.provider_specification_id
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authMethod =>
          authMethodPresenter.present({ authMethod: authMethod as SubspaceAuthMethod })
        );
      }),

    get: providerAuthMethodGroup
      .get(providerPath('provider-auth-methods/:providerAuthMethodId', 'providerAuthMethods.get'), {
        name: 'Get provider auth method',
        description: 'Retrieves a specific provider auth method by ID.'
      })
      .output(authMethodPresenter)
      .do(async ctx => {
        return authMethodPresenter.present({ authMethod: ctx.authMethod });
      })
  }
);
