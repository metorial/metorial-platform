import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderAuthCredentialsService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { providerInstanceGroup, providerPath } from '../../middleware';
import { authCredentialsPresenter, deleteResponsePresenter } from '../../presenters';
import { SubspaceAuthCredentials } from '../../presenters/types';

export let providerAuthCredentialsGroup = providerInstanceGroup.use(async ctx => {
  if (!ctx.params.providerAuthCredentialsId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerAuthCredentialsId is required',
        description: 'The providerAuthCredentialsId path parameter is required.'
      })
    );
  }

  let authCredentials = await subspaceProviderAuthCredentialsService.get({
    instance: ctx.instance,
    providerAuthCredentialsId: ctx.params.providerAuthCredentialsId
  });

  return { authCredentials };
});

export let providerAuthCredentialsController = Controller.create(
  {
    name: 'Provider Auth Credentials',
    description: 'Manage authentication credentials for providers.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('provider-auth-credentials', 'providerAuthCredentials.list'), {
        name: 'List provider auth credentials',
        description: 'Returns a paginated list of provider auth credentials.'
      })
      .outputList(authCredentialsPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(v.string()),
            provider_auth_method_id: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderAuthCredentialsService.list({
          instance: ctx.instance,
          providerId: ctx.query.provider_id,
          providerAuthMethodId: ctx.query.provider_auth_method_id
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authCredentials =>
          authCredentialsPresenter.present({ authCredentials: authCredentials as SubspaceAuthCredentials })
        );
      }),

    get: providerAuthCredentialsGroup
      .get(providerPath('provider-auth-credentials/:providerAuthCredentialsId', 'providerAuthCredentials.get'), {
        name: 'Get provider auth credentials',
        description: 'Retrieves specific provider auth credentials by ID.'
      })
      .output(authCredentialsPresenter)
      .do(async ctx => {
        return authCredentialsPresenter.present({ authCredentials: ctx.authCredentials });
      }),

    create: providerInstanceGroup
      .post(providerPath('provider-auth-credentials', 'providerAuthCredentials.create'), {
        name: 'Create provider auth credentials',
        description: 'Creates new provider auth credentials.'
      })
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          isEphemeral: v.optional(v.boolean()),
          providerId: v.string(),
          providerAuthMethodId: v.string(),
          credentials: v.record(v.any())
        })
      )
      .output(authCredentialsPresenter)
      .do(async ctx => {
        let authCredentials = await subspaceProviderAuthCredentialsService.create({
          instance: ctx.instance,
          providerId: ctx.body.providerId,
          providerAuthMethodId: ctx.body.providerAuthMethodId,
          name: ctx.body.name,
          description: ctx.body.description,
          isEphemeral: ctx.body.isEphemeral,
          credentials: ctx.body.credentials,
          metadata: ctx.body.metadata
        });

        return authCredentialsPresenter.present({ authCredentials: authCredentials as SubspaceAuthCredentials });
      }),

    update: providerAuthCredentialsGroup
      .patch(providerPath('provider-auth-credentials/:providerAuthCredentialsId', 'providerAuthCredentials.update'), {
        name: 'Update provider auth credentials',
        description: 'Updates specific provider auth credentials.'
      })
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(authCredentialsPresenter)
      .do(async ctx => {
        let authCredentials = await subspaceProviderAuthCredentialsService.update({
          instance: ctx.instance,
          providerAuthCredentialsId: ctx.authCredentials.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return authCredentialsPresenter.present({ authCredentials: authCredentials as SubspaceAuthCredentials });
      }),

    delete: providerAuthCredentialsGroup
      .delete(providerPath('provider-auth-credentials/:providerAuthCredentialsId', 'providerAuthCredentials.delete'), {
        name: 'Delete provider auth credentials',
        description: 'Permanently deletes provider auth credentials.'
      })
      .output(deleteResponsePresenter)
      .do(async ctx => {
        await subspaceProviderAuthCredentialsService.delete({
          instance: ctx.instance,
          providerAuthCredentialsId: ctx.authCredentials.id
        });

        return deleteResponsePresenter.present({
          id: ctx.authCredentials.id,
          object: 'provider.auth_credentials'
        });
      })
  }
);
