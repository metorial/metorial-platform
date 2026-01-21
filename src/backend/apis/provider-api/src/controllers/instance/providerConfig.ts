import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderConfigService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { providerInstanceGroup, providerPath } from '../../middleware';
import { configPresenter, deleteResponsePresenter } from '../../presenters';
import { SubspaceConfig } from '../../presenters/types';

export let providerConfigGroup = providerInstanceGroup.use(async ctx => {
  if (!ctx.params.providerConfigId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerConfigId is required',
        description: 'The providerConfigId path parameter is required.'
      })
    );
  }

  let config = await subspaceProviderConfigService.get({
    instance: ctx.instance,
    providerConfigId: ctx.params.providerConfigId
  });

  return { config };
});

export let providerConfigController = Controller.create(
  {
    name: 'Provider Configs',
    description: 'Manage provider configurations within deployments.'
  },
  {
    list: providerInstanceGroup
      .get(providerPath('provider-configs', 'providerConfigs.list'), {
        name: 'List provider configs',
        description: 'Returns a paginated list of provider configs.'
      })
      .outputList(configPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(v.string()),
            provider_deployment_id: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderConfigService.list({
          instance: ctx.instance,
          providerId: ctx.query.provider_id,
          providerDeploymentId: ctx.query.provider_deployment_id
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, config =>
          configPresenter.present({ config: config as SubspaceConfig })
        );
      }),

    get: providerConfigGroup
      .get(providerPath('provider-configs/:providerConfigId', 'providerConfigs.get'), {
        name: 'Get provider config',
        description: 'Retrieves a specific provider config by ID.'
      })
      .output(configPresenter)
      .do(async ctx => {
        return configPresenter.present({ config: ctx.config });
      }),

    create: providerInstanceGroup
      .post(providerPath('provider-configs', 'providerConfigs.create'), {
        name: 'Create provider config',
        description: 'Creates a new provider config.'
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
          config: v.union([
            v.object({ type: v.literal('inline'), data: v.record(v.any()) }),
            v.object({ type: v.literal('vault'), providerConfigVaultId: v.string() })
          ])
        })
      )
      .output(configPresenter)
      .do(async ctx => {
        let config = await subspaceProviderConfigService.create({
          instance: ctx.instance,
          providerId: ctx.body.providerId,
          providerDeploymentId: ctx.body.providerDeploymentId,
          name: ctx.body.name,
          description: ctx.body.description,
          isEphemeral: ctx.body.isEphemeral,
          config: ctx.body.config,
          metadata: ctx.body.metadata
        });

        return configPresenter.present({ config: config as SubspaceConfig });
      }),

    update: providerConfigGroup
      .patch(providerPath('provider-configs/:providerConfigId', 'providerConfigs.update'), {
        name: 'Update provider config',
        description: 'Updates a specific provider config.'
      })
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(configPresenter)
      .do(async ctx => {
        let config = await subspaceProviderConfigService.update({
          instance: ctx.instance,
          providerConfigId: ctx.config.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return configPresenter.present({ config: config as SubspaceConfig });
      }),

    delete: providerConfigGroup
      .delete(providerPath('provider-configs/:providerConfigId', 'providerConfigs.delete'), {
        name: 'Delete provider config',
        description: 'Permanently deletes a provider config.'
      })
      .output(deleteResponsePresenter)
      .do(async ctx => {
        await subspaceProviderConfigService.delete({
          instance: ctx.instance,
          providerConfigId: ctx.config.id
        });

        return deleteResponsePresenter.present({
          id: ctx.config.id,
          object: 'provider.config'
        });
      })
  }
);
