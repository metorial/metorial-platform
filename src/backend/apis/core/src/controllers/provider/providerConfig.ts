import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceReferenceConfigService } from '@metorial/module-subspace-reference';
import { subspaceProviderConfigService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { providerPath } from '../../middleware/providerGroup';
import { providerConfigPresenter } from '../../presenters';
import { SubspaceConfig } from '../../presenters/types';
import { providerDeploymentGroup } from './providerDeployment';

export let providerConfigGroup = providerDeploymentGroup.use(async ctx => {
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
    description:
      'A config holds settings for a deployment, like API endpoints or feature flags. Create configs with values directly, or from a saved config vault with pre-saved values.'
  },
  {
    list: providerDeploymentGroup
      .get(providerPath('provider-deployments/:providerDeploymentId/configs', 'providerDeployments.configs.list'), {
        name: 'List provider configs',
        description: 'Returns a paginated list of provider configs.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .outputList(providerConfigPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await subspaceProviderConfigService.list({
          instance: ctx.instance,
          providerIds: [ctx.deployment.providerId],
          providerDeploymentIds: [ctx.deployment.id]
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, config =>
          providerConfigPresenter.present({ config: config as SubspaceConfig })
        );
      }),

    get: providerConfigGroup
      .get(providerPath('provider-deployments/:providerDeploymentId/configs/:providerConfigId', 'providerDeployments.configs.get'), {
        name: 'Get provider config',
        description: 'Retrieves a specific provider config by ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:read'] }))
      .use(hasFlags(['paid-provider-api']))
      .output(providerConfigPresenter)
      .do(async ctx => {
        return providerConfigPresenter.present({ config: ctx.config });
      }),

    create: providerDeploymentGroup
      .post(providerPath('provider-deployments/:providerDeploymentId/configs', 'providerDeployments.configs.create'), {
        name: 'Create provider config',
        description: 'Creates a new provider config.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .use(hasFlags(['paid-provider-api']))
      .body(
        'default',
        v.object({
          name: v.string({ examples: ['Production Config'] }),
          description: v.optional(
            v.string({ examples: ['Configuration for production environment'] })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              examples: [{ label: 'primary', notes: 'Default production config' }]
            }),
            { description: 'Custom key-value pairs for storing additional information' }
          ),
          config: v.union(
            [
              v.object(
                {
                  type: v.literal('inline'),
                  data: v.record(v.any(), {
                    description: 'Provider-specific configuration values',
                    examples: [{ api_key: 'sk-xxx', base_url: 'https://api.example.com' }]
                  })
                },
                { name: 'Inline config', description: 'Provide configuration values directly' }
              ),
              v.object(
                {
                  type: v.literal('vault'),
                  provider_config_vault_id: v.string({
                    description: 'Config vault ID to use as template',
                    examples: ['pcvt_3bCdEfGhJkLmNpQr']
                  })
                },
                { name: 'From vault', description: 'Create config from a vault template' }
              )
            ],
            { description: 'Configuration data source' }
          )
        })
      )
      .output(providerConfigPresenter)
      .do(async ctx => {
        let bodyConfig = ctx.body.config;
        let transformedConfig =
          bodyConfig.type === 'vault'
            ? { type: 'vault' as const, providerConfigVaultId: bodyConfig.provider_config_vault_id }
            : bodyConfig;

        let config = await subspaceProviderConfigService.create({
          instance: ctx.instance,
          providerId: ctx.deployment.providerId,
          providerDeploymentId: ctx.deployment.id,
          name: ctx.body.name,
          description: ctx.body.description,
          config: transformedConfig,
          metadata: ctx.body.metadata
        });

        await subspaceReferenceConfigService
          .create({
            instance: ctx.instance,
            config: {
              id: config.id,
              providerId: ctx.deployment.providerId,
              providerDeploymentId: config.providerDeploymentId,
              name: config.name,
              isEphemeral: config.isEphemeral,
              createdAt: config.createdAt
            }
          })
          .catch(err => console.error('Failed to store subspace reference:', err));

        return providerConfigPresenter.present({ config: config as SubspaceConfig });
      }),

    update: providerConfigGroup
      .patch(providerPath('provider-deployments/:providerDeploymentId/configs/:providerConfigId', 'providerDeployments.configs.update'), {
        name: 'Update provider config',
        description: 'Updates a specific provider config.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .use(hasFlags(['paid-provider-api']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()), {
            description: 'Custom key-value pairs for storing additional information'
          })
        })
      )
      .output(providerConfigPresenter)
      .do(async ctx => {
        let config = await subspaceProviderConfigService.update({
          instance: ctx.instance,
          providerConfigId: ctx.config.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return providerConfigPresenter.present({ config: config as SubspaceConfig });
      }),

    delete: providerConfigGroup
      .delete(providerPath('provider-deployments/:providerDeploymentId/configs/:providerConfigId', 'providerDeployments.configs.delete'), {
        name: 'Delete provider config',
        description: 'Permanently deletes a provider config.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .use(hasFlags(['paid-provider-api']))
      .output(providerConfigPresenter)
      .do(async ctx => {
        await subspaceProviderConfigService.delete({
          instance: ctx.instance,
          providerConfigId: ctx.config.id
        });

        await subspaceReferenceConfigService
          .delete({
            instance: ctx.instance,
            id: ctx.config.id
          })
          .catch(err => console.error('Failed to remove subspace reference:', err));

        return providerConfigPresenter.present({ config: ctx.config });
      })
  }
);
