import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderAuthConfigService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { providerInstanceGroup, providerPath } from '../../middleware';
import { authConfigPresenter, deleteResponsePresenter } from '../../presenters';
import { SubspaceAuthConfig } from '../../presenters/types';

export let providerAuthConfigGroup = providerInstanceGroup.use(async ctx => {
  if (!ctx.params.providerAuthConfigId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerAuthConfigId is required',
        description: 'The providerAuthConfigId path parameter is required.'
      })
    );
  }

  let authConfig = await subspaceProviderAuthConfigService.get({
    instance: ctx.instance,
    providerAuthConfigId: ctx.params.providerAuthConfigId
  });

  return { authConfig };
});

export let providerAuthConfigController = Controller.create(
  {
    name: 'Provider Auth Configs',
    description: 'Manage authentication configurations for providers.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('provider-auth-configs', 'providerAuthConfigs.list'), {
        name: 'List provider auth configs',
        description: 'Returns a paginated list of provider auth configs.'
      })
      .outputList(authConfigPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(v.string()),
            provider_deployment_id: v.optional(v.string()),
            provider_auth_method_id: v.optional(v.string()),
            provider_auth_credentials_id: v.optional(v.string()),
            status: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderAuthConfigService.list({
          instance: ctx.instance,
          providerId: ctx.query.provider_id,
          providerDeploymentId: ctx.query.provider_deployment_id,
          providerAuthMethodId: ctx.query.provider_auth_method_id,
          providerAuthCredentialsId: ctx.query.provider_auth_credentials_id,
          status: ctx.query.status
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authConfig =>
          authConfigPresenter.present({ authConfig: authConfig as SubspaceAuthConfig })
        );
      }),

    get: providerAuthConfigGroup
      .get(providerPath('provider-auth-configs/:providerAuthConfigId', 'providerAuthConfigs.get'), {
        name: 'Get provider auth config',
        description: 'Retrieves a specific provider auth config by ID.'
      })
      .output(authConfigPresenter)
      .do(async ctx => {
        return authConfigPresenter.present({ authConfig: ctx.authConfig });
      }),

    create: providerInstanceGroup
      .post(providerPath('provider-auth-configs', 'providerAuthConfigs.create'), {
        name: 'Create provider auth config',
        description: 'Creates a new provider auth config.'
      })
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          isEphemeral: v.optional(v.boolean()),
          providerId: v.string(),
          providerDeploymentId: v.optional(v.string()),
          providerAuthMethodId: v.string(),
          credentials: v.union([
            v.object({ type: v.literal('inline'), data: v.record(v.any()) }),
            v.object({ type: v.literal('existing'), providerAuthCredentialsId: v.string() })
          ])
        })
      )
      .output(authConfigPresenter)
      .do(async ctx => {
        let authConfig = await subspaceProviderAuthConfigService.create({
          instance: ctx.instance,
          providerId: ctx.body.providerId,
          providerDeploymentId: ctx.body.providerDeploymentId,
          providerAuthMethodId: ctx.body.providerAuthMethodId,
          name: ctx.body.name,
          description: ctx.body.description,
          isEphemeral: ctx.body.isEphemeral,
          credentials: ctx.body.credentials,
          metadata: ctx.body.metadata
        });

        return authConfigPresenter.present({ authConfig: authConfig as SubspaceAuthConfig });
      }),

    update: providerAuthConfigGroup
      .patch(providerPath('provider-auth-configs/:providerAuthConfigId', 'providerAuthConfigs.update'), {
        name: 'Update provider auth config',
        description: 'Updates a specific provider auth config.'
      })
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(authConfigPresenter)
      .do(async ctx => {
        let authConfig = await subspaceProviderAuthConfigService.update({
          instance: ctx.instance,
          providerAuthConfigId: ctx.authConfig.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return authConfigPresenter.present({ authConfig: authConfig as SubspaceAuthConfig });
      }),

    delete: providerAuthConfigGroup
      .delete(providerPath('provider-auth-configs/:providerAuthConfigId', 'providerAuthConfigs.delete'), {
        name: 'Delete provider auth config',
        description: 'Permanently deletes a provider auth config.'
      })
      .output(deleteResponsePresenter)
      .do(async ctx => {
        await subspaceProviderAuthConfigService.delete({
          instance: ctx.instance,
          providerAuthConfigId: ctx.authConfig.id
        });

        return deleteResponsePresenter.present({
          id: ctx.authConfig.id,
          object: 'provider.auth_config'
        });
      })
  }
);
