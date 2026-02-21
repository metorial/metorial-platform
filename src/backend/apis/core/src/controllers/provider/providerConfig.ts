import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderConfigService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { configSchemaPresenter, providerConfigPresenter } from '../../presenters';

let providerConfigGroup = instanceGroup.use(async ctx => {
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

type ProviderConfigCreateConfig = Parameters<
  typeof subspaceProviderConfigService.create
>[0]['config'];

let mapProviderConfigCreateConfig = (
  config:
    | { type: 'inline'; data: Record<string, any> }
    | { type: 'vault'; provider_config_vault_id: string }
): ProviderConfigCreateConfig => {
  if (config.type === 'inline') {
    return {
      type: 'inline',
      data: config.data
    };
  }

  return {
    type: 'vault',
    providerConfigVaultId: config.provider_config_vault_id
  };
};

export let providerConfigController = Controller.create(
  {
    name: 'Provider Configs',
    description:
      'A config holds settings for a deployment, like API endpoints or feature flags. Create configs with values directly, or from a saved config vault with pre-saved values.'
  },
  {
    list: instanceGroup
      .get(instancePath('provider-configs', 'providerDeployments.configs.list'), {
        name: 'List provider configs',
        description: 'Returns a paginated list of provider configs.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:read'] }))
      .outputList(providerConfigPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived']),
                v.array(v.enumOf(['active', 'archived']))
              ]),
              { description: 'Filter by status (active, archived)' }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by config ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_specification_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider specification ID(s)'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider deployment ID(s)'
            }),
            provider_config_vault_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by config vault ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderConfigService.list({
          instance: ctx.instance,
          allowDeleted: false,

          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerSpecificationIds: normalizeArrayParam(ctx.query.provider_specification_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerConfigVaultIds: normalizeArrayParam(ctx.query.provider_config_vault_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, config => providerConfigPresenter.present({ config }));
      }),

    get: providerConfigGroup
      .get(
        instancePath('provider-configs/:providerConfigId', 'providerDeployments.configs.get'),
        {
          name: 'Get provider config',
          description: 'Retrieves a specific provider config by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:read'] }))
      .output(providerConfigPresenter)
      .do(async ctx => {
        return providerConfigPresenter.present({ config: ctx.config });
      }),

    create: instanceGroup
      .post(instancePath('provider-configs', 'providerDeployments.configs.create'), {
        name: 'Create provider config',
        description: 'Creates a new provider config.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .body(
        'default',
        v.object({
          provider_id: v.string({
            description: 'Provider ID',
            examples: ['pro_5gHjKlMnPqRsTuVw']
          }),
          provider_deployment_id: v.optional(
            v.string({
              description: 'Optional provider deployment ID',
              examples: ['pdp_4dEfGhJkLmNpQrSt']
            })
          ),
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
                { name: 'inline', description: 'Provide configuration values directly' }
              ),
              v.object(
                {
                  type: v.literal('vault'),
                  provider_config_vault_id: v.string({
                    description: 'Config vault ID to use as template',
                    examples: ['pcvt_3bCdEfGhJkLmNpQr']
                  })
                },
                { name: 'vault', description: 'Create config from a vault template' }
              )
            ],
            { description: 'Configuration data source' }
          )
        })
      )
      .output(providerConfigPresenter)
      .do(async ctx => {
        let config = await subspaceProviderConfigService.create({
          instance: ctx.instance,
          providerId: ctx.body.provider_id,
          providerDeployment: ctx.body.provider_deployment_id
            ? {
                type: 'reference',
                providerDeploymentId: ctx.body.provider_deployment_id
              }
            : undefined,
          name: ctx.body.name,
          description: ctx.body.description,
          config: mapProviderConfigCreateConfig(ctx.body.config),
          metadata: ctx.body.metadata
        });

        return providerConfigPresenter.present({ config });
      }),

    update: providerConfigGroup
      .patch(
        instancePath(
          'provider-configs/:providerConfigId',
          'providerDeployments.configs.update'
        ),
        {
          name: 'Update provider config',
          description: 'Updates a specific provider config.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
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

        return providerConfigPresenter.present({ config });
      }),

    delete: providerConfigGroup
      .delete(
        instancePath(
          'provider-configs/:providerConfigId',
          'providerDeployments.configs.delete'
        ),
        {
          name: 'Delete provider config',
          description: 'Permanently deletes a provider config.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:write'] }))
      .output(providerConfigPresenter)
      .do(async ctx => {
        return providerConfigPresenter.present({ config: ctx.config });
      }),

    getConfigSchema: instanceGroup
      .get(
        instancePath('provider-config-schema', 'providerDeployments.configs.getConfigSchema'),
        {
          name: 'Get config schema',
          description:
            'Retrieves the JSON Schema for configuration of this provider deployment.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.deployment:read'] }))
      .query(
        'default',
        v.object({
          provider_id: v.optional(v.string()),
          provider_config_id: v.optional(v.string()),
          provider_version_id: v.optional(v.string()),
          provider_deployment_id: v.optional(v.string())
        })
      )
      .output(configSchemaPresenter)
      .do(async ctx => {
        let schema = await subspaceProviderConfigService.getConfigSchema({
          instance: ctx.instance,
          providerId: ctx.query.provider_id,
          providerConfigId: ctx.query.provider_config_id,
          providerVersionId: ctx.query.provider_version_id,
          providerDeploymentId: ctx.query.provider_deployment_id
        });

        return configSchemaPresenter.present({
          schema
        });
      })
  }
);
