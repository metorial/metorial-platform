import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerService, providerVersionService } from '@metorial-subspace/module-catalog';
import {
  providerConfigService,
  providerConfigVaultService,
  providerDeploymentService
} from '@metorial-subspace/module-deployment';
import { normalizeToolFilters } from '@metorial-subspace/module-provider-internal';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { configSchemaPresenter, providerConfigPresenter } from '@metorial/presenters';
import { toolFiltersValidator } from '../sessions/_shared';

let providerConfigGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerConfigId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerConfigId is required',
        description: 'The providerConfigId path parameter is required.'
      })
    );
  }

  let config = await providerConfigService.getProviderConfigById({
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
    list: instanceGroup
      .get(instancePath('provider-configs', 'providerDeployments.configs.list'), {
        name: 'List provider configs',
        description: 'Returns a paginated list of provider configs.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.config:read'] }))
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
            available_for_use: v.optional(v.boolean(), {
              description:
                'Only return configs that are not owned by another integration instance provider.'
            }),
            available_for_provider_deployment_id: v.optional(v.string(), {
              description:
                'Only return configs that are not locked to a different provider deployment.'
            }),
            provider_config_vault_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by config vault ID(s)'
            }),
            actor_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by actor ID(s)'
            }),
            consumer_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by consumer ID(s)'
            }),
            identity_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by identity ID(s)'
            }),
            identity_credential_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by identity credential ID(s)'
            }),
            search: v.optional(v.string({ description: 'Search by name or description' })),
            created_at: dateFilterValidator('provider config creation time'),
            updated_at: dateFilterValidator('provider config last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await providerConfigService.listProviderConfigs({
          instance: ctx.instance,
          allowDeleted: false,

          search: ctx.query.search,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerSpecificationIds: normalizeArrayParam(ctx.query.provider_specification_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          availableForUse: ctx.query.available_for_use,
          availableForProviderDeploymentId: ctx.query.available_for_provider_deployment_id,
          providerConfigVaultIds: normalizeArrayParam(ctx.query.provider_config_vault_id),
          actorIds: normalizeArrayParam(ctx.query.actor_id),
          consumerIds: normalizeArrayParam(ctx.query.consumer_id),
          identityIds: normalizeArrayParam(ctx.query.identity_id),
          identityCredentialIds: normalizeArrayParam(ctx.query.identity_credential_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
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
      .use(checkAccess({ possibleScopes: ['instance.provider.config:read'] }))
      .output(providerConfigPresenter)
      .do(async ctx => {
        return providerConfigPresenter.present({ config: ctx.config });
      }),

    create: instanceGroup
      .post(instancePath('provider-configs', 'providerDeployments.configs.create'), {
        name: 'Create provider config',
        description: 'Creates a new provider config.',
        confidential: true
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.config:write'] }))
      .body(
        'default',
        v.intersection([
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
            name: v.optional(v.string({ examples: ['Production Config'] })),
            description: v.optional(
              v.string({ examples: ['Configuration for production environment'] })
            ),
            metadata: v.optional(
              v.record(v.any(), {
                examples: [{ label: 'primary', notes: 'Default production config' }]
              }),
              { description: 'Custom key-value pairs for storing additional information' }
            ),
            tool_filters: toolFiltersValidator
          }),
          v.union([
            v.object({
              value: v.record(v.any(), {
                description: 'Provider-specific configuration values',
                examples: [{ api_key: 'sk-xxx', base_url: 'https://api.example.com' }]
              })
            }),
            v.object({
              provider_config_vault_id: v.string({
                description: 'Config vault ID to use as template',
                examples: ['pcvt_3bCdEfGhJkLmNpQr']
              })
            })
          ])
        ])
      )
      .output(providerConfigPresenter)
      .do(async ctx => {
        let provider = await providerService.getProviderById({
          instance: ctx.instance,
          providerId: ctx.body.provider_id
        });
        let providerDeployment = ctx.body.provider_deployment_id
          ? await providerDeploymentService.getProviderDeploymentById({
              instance: ctx.instance,
              providerDeploymentId: ctx.body.provider_deployment_id
            })
          : undefined;
        let configVault =
          'provider_config_vault_id' in ctx.body
            ? await providerConfigVaultService.getProviderConfigVaultById({
                instance: ctx.instance,
                providerConfigVaultId: ctx.body.provider_config_vault_id
              })
            : undefined;

        let config = await providerConfigService.createProviderConfig({
          instance: ctx.instance,
          provider,
          providerDeployment,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            toolFilters: normalizeToolFilters(ctx.body.tool_filters as any),
            config:
              'value' in ctx.body
                ? {
                    type: 'inline',
                    data: ctx.body.value
                  }
                : {
                    type: 'vault',
                    vault: configVault!
                  }
          }
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
      .use(checkAccess({ possibleScopes: ['instance.provider.config:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()), {
            description: 'Custom key-value pairs for storing additional information'
          }),
          tool_filters: toolFiltersValidator
        })
      )
      .output(providerConfigPresenter)
      .do(async ctx => {
        let config = await providerConfigService.updateProviderConfig({
          instance: ctx.instance,
          providerConfig: ctx.config,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            ...(ctx.body.tool_filters !== undefined
              ? { toolFilters: normalizeToolFilters(ctx.body.tool_filters as any) }
              : {})
          }
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
      .use(checkAccess({ possibleScopes: ['instance.provider.config:write'] }))
      .output(providerConfigPresenter)
      .do(async ctx => {
        let config = await providerConfigService.archiveProviderConfig({
          instance: ctx.instance,
          providerConfig: ctx.config
        });

        return providerConfigPresenter.present({ config });
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
      .use(checkAccess({ possibleScopes: ['instance.provider.config:read'] }))
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
        let provider = ctx.query.provider_id
          ? await providerService.getProviderById({
              instance: ctx.instance,
              providerId: ctx.query.provider_id
            })
          : undefined;
        let providerConfig = ctx.query.provider_config_id
          ? await providerConfigService.getProviderConfigById({
              instance: ctx.instance,
              providerConfigId: ctx.query.provider_config_id
            })
          : undefined;
        let providerVersion = ctx.query.provider_version_id
          ? await providerVersionService.getProviderVersionById({
              instance: ctx.instance,
              providerVersionId: ctx.query.provider_version_id
            })
          : undefined;
        let providerDeployment = ctx.query.provider_deployment_id
          ? await providerDeploymentService.getProviderDeploymentById({
              instance: ctx.instance,
              providerDeploymentId: ctx.query.provider_deployment_id
            })
          : undefined;
        let schema = await providerConfigService.getProviderConfigSchema({
          instance: ctx.instance,
          provider,
          providerConfig,
          providerVersion,
          providerDeployment
        });

        return configSchemaPresenter.present({
          schema
        });
      })
  }
);
