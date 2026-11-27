import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  integrationProviderService,
  integrationService
} from '@metorial-subspace/module-integration';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { requireNonPublishableMachineAccess } from '../../../middleware/requireNonPublishableMachineAccess';
import { integrationsGroup, instancePath } from '../../../middleware/instanceGroup';
import { integrationProviderPresenter } from '@metorial/presenters';
import { normalizeToolFilters, toolFiltersValidator } from '../sessions/_shared';

let callbacksInputValidator = v.object(
  {
    status: v.enumOf(['enabled', 'disabled'] as const, {
      description:
        'Enabling registers a callback against every matching integration instance. Disabling tears it down again. Only providers whose type reports `triggers.status` as `enabled` can enable callbacks.'
    })
  },
  { description: 'Provider callback state for this integration provider' }
);

let integrationProviderGroup = integrationsGroup.use(async ctx => {
  if (!ctx.params.integrationProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationProviderId is required',
        description: 'The integrationProviderId path parameter is required.'
      })
    );
  }

  let integrationProvider = await integrationProviderService.getIntegrationProviderById({
    instance: ctx.instance,
    integrationProviderId: ctx.params.integrationProviderId,
    allowDeleted: true
  });

  return { integrationProvider };
});

export let integrationProviderController = Controller.create(
  {
    name: 'Integration Providers',
    description:
      'An integration provider is one provider in an integration, with the deployment, configuration, credentials, and tool filters it runs with.'
  },
  {
    list: integrationsGroup
      .get(instancePath('integration-providers', 'integrations.providers.list'), {
        name: 'List integration providers',
        description: 'Returns a paginated list of integration providers.'
      })
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(integrationProviderPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string(), {
              description:
                'Search integration providers by name, description, ID, or provider.'
            }),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ]),
              {
                description:
                  'Only return integration providers with one of these statuses. `deleted` providers are never listed.'
              }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integration providers with one of these IDs.'
            }),
            integration_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integration providers for one of these integrations.'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integration providers using one of these providers.'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description:
                'Only return integration providers running on one of these deployments.'
            }),
            provider_auth_method_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integration providers using one of these auth methods.'
            }),
            provider_auth_credentials_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              {
                description:
                  'Only return integration providers using one of these credentials.'
              }
            ),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Only return integration providers using one of these configs.'
            }),
            created_at: dateFilterValidator('integration provider creation time'),
            updated_at: dateFilterValidator('integration provider last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await integrationProviderService.listIntegrationProviders({
          instance: ctx.instance,
          search: ctx.query.search,
          allowDeleted: false,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          integrationIds: normalizeArrayParam(ctx.query.integration_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerAuthMethodIds: normalizeArrayParam(ctx.query.provider_auth_method_id),
          providerAuthCredentialsIds: normalizeArrayParam(
            ctx.query.provider_auth_credentials_id
          ),
          providerConfigIds: normalizeArrayParam(ctx.query.provider_config_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, integrationProvider =>
          integrationProviderPresenter.present({ integrationProvider })
        );
      }),

    get: integrationProviderGroup
      .get(
        instancePath(
          'integration-providers/:integrationProviderId',
          'integrations.providers.get'
        ),
        {
          name: 'Get integration provider',
          description: 'Retrieves an integration provider.'
        }
      )
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(integrationProviderPresenter)
      .do(async ctx =>
        integrationProviderPresenter.present({ integrationProvider: ctx.integrationProvider })
      ),

    create: integrationsGroup
      .post(instancePath('integration-providers', 'integrations.providers.create'), {
        name: 'Create integration provider',
        description: 'Creates an integration provider.'
      })
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          integration_id: v.string({
            description: 'Integration the provider belongs to.',
            examples: ['int_2bCdEfGhJkLmNpQr']
          }),
          provider_id: v.string({
            description: 'Provider to add to the integration.'
          }),
          provider_deployment_id: v.string({
            description: 'Deployment the provider runs with.'
          }),
          provider_auth_method_id: v.optional(
            v.nullable(
              v.string({
                description: 'Auth method the provider runs with. Omitted leaves it unset.'
              })
            )
          ),
          provider_auth_credentials_id: v.optional(
            v.nullable(
              v.string({
                description: 'Credentials the provider runs with. Omitted leaves them unset.'
              })
            )
          ),
          provider_config_id: v.optional(
            v.nullable(
              v.string({
                description: 'Provider config the provider runs with. Omitted leaves it unset.'
              })
            )
          ),
          name: v.optional(
            v.string({
              description:
                'Display name for the integration provider. Defaults to the provider name.'
            })
          ),
          description: v.optional(
            v.string({
              description: 'Free-text description.'
            })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              description: 'Custom data to identify or organize the integration provider.'
            })
          ),
          tool_filters: toolFiltersValidator,
          callbacks: v.optional(callbacksInputValidator)
        })
      )
      .output(integrationProviderPresenter)
      .do(async ctx => {
        let integration = await integrationService.getIntegrationById({
          instance: ctx.instance,
          integrationId: ctx.body.integration_id
        });
        let integrationProvider = await integrationProviderService.createIntegrationProvider({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          integration,
          input: {
            providerId: ctx.body.provider_id,
            providerDeploymentId: ctx.body.provider_deployment_id,
            providerAuthMethodId: ctx.body.provider_auth_method_id,
            providerAuthCredentialsId: ctx.body.provider_auth_credentials_id,
            providerConfigId: ctx.body.provider_config_id,
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            toolFilters:
              ctx.body.tool_filters === undefined
                ? undefined
                : normalizeToolFilters(ctx.body.tool_filters),
            callbacksEnabled:
              ctx.body.callbacks === undefined
                ? undefined
                : ctx.body.callbacks.status === 'enabled'
          }
        });

        return integrationProviderPresenter.present({ integrationProvider });
      }),

    update: integrationProviderGroup
      .patch(
        instancePath(
          'integration-providers/:integrationProviderId',
          'integrations.providers.update'
        ),
        {
          name: 'Update integration provider',
          description:
            'Updates an integration provider. Omitted fields keep their current value.'
        }
      )
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          provider_deployment_id: v.optional(
            v.string({
              description: 'Deployment the provider runs with. Omitted keeps the current one.'
            })
          ),
          provider_auth_method_id: v.optional(
            v.nullable(
              v.string({
                description:
                  'Auth method the provider runs with. `null` clears it. Omitted keeps the current one.'
              })
            )
          ),
          provider_auth_credentials_id: v.optional(
            v.nullable(
              v.string({
                description:
                  'Credentials the provider runs with. `null` clears them. Omitted keeps the current ones.'
              })
            )
          ),
          provider_config_id: v.optional(
            v.nullable(
              v.string({
                description:
                  'Provider config the provider runs with. `null` clears it. Omitted keeps the current one.'
              })
            )
          ),
          name: v.optional(
            v.string({
              description:
                'Display name for the integration provider. Omitted keeps the current one.'
            })
          ),
          description: v.optional(
            v.nullable(
              v.string({
                description: 'Free-text description. `null` clears it.'
              })
            )
          ),
          metadata: v.optional(
            v.nullable(
              v.record(v.any(), {
                description:
                  'Custom data to identify or organize the integration provider. Replaces existing metadata. `null` clears it.'
              })
            )
          ),
          tool_filters: toolFiltersValidator,
          callbacks: v.optional(callbacksInputValidator)
        })
      )
      .output(integrationProviderPresenter)
      .do(async ctx => {
        let integrationProvider = await integrationProviderService.updateIntegrationProvider({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          integrationProvider: ctx.integrationProvider,
          input: {
            providerDeploymentId: ctx.body.provider_deployment_id,
            providerAuthMethodId: ctx.body.provider_auth_method_id,
            providerAuthCredentialsId: ctx.body.provider_auth_credentials_id,
            providerConfigId: ctx.body.provider_config_id,
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            toolFilters:
              ctx.body.tool_filters === undefined
                ? undefined
                : normalizeToolFilters(ctx.body.tool_filters),
            callbacksEnabled:
              ctx.body.callbacks === undefined
                ? undefined
                : ctx.body.callbacks.status === 'enabled'
          }
        });

        return integrationProviderPresenter.present({ integrationProvider });
      }),

    delete: integrationProviderGroup
      .delete(
        instancePath(
          'integration-providers/:integrationProviderId',
          'integrations.providers.delete'
        ),
        {
          name: 'Archive integration provider',
          description:
            'Archives an integration provider. It stays retrievable by ID and listable with `status=archived`.'
        }
      )
      .use(requireNonPublishableMachineAccess())
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .output(integrationProviderPresenter)
      .do(async ctx => {
        let integrationProvider = await integrationProviderService.archiveIntegrationProvider({
          instance: ctx.instance,
          auditScope: ctx.auditScope,
          integrationProvider: ctx.integrationProvider
        });

        return integrationProviderPresenter.present({ integrationProvider });
      })
  }
);
