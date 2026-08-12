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
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { integrationProviderPresenter } from '../../../presenters';
import { normalizeToolFilters, toolFiltersValidator } from '../sessions/_shared';

let integrationProviderGroup = instanceGroup.use(async ctx => {
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
      'Integration providers define the shared provider-level contract for a given integration.'
  },
  {
    list: instanceGroup
      .get(instancePath('integration-providers', 'integrations.providers.list'), {
        name: 'List integration providers',
        description: 'Returns a paginated list of integration providers.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .outputList(integrationProviderPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            search: v.optional(v.string()),
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived', 'deleted']),
                v.array(v.enumOf(['active', 'archived', 'deleted']))
              ])
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())])),
            integration_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_auth_method_id: v.optional(v.union([v.string(), v.array(v.string())])),
            provider_auth_credentials_id: v.optional(
              v.union([v.string(), v.array(v.string())])
            ),
            provider_config_id: v.optional(v.union([v.string(), v.array(v.string())])),
            created_at: dateFilterValidator('integration provider creation time'),
            updated_at: dateFilterValidator('integration provider last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await integrationProviderService.listIntegrationProviders({
          instance: ctx.instance,
          search: ctx.query.search,
          allowDeleted: true,
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
          description: 'Retrieves a specific integration provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:read'] }))
      .output(integrationProviderPresenter)
      .do(async ctx =>
        integrationProviderPresenter.present({ integrationProvider: ctx.integrationProvider })
      ),

    create: instanceGroup
      .post(instancePath('integration-providers', 'integrations.providers.create'), {
        name: 'Create integration provider',
        description: 'Creates a new integration provider.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          integration_id: v.string(),
          provider_id: v.string(),
          provider_deployment_id: v.string(),
          provider_auth_method_id: v.optional(v.nullable(v.string())),
          provider_auth_credentials_id: v.optional(v.nullable(v.string())),
          provider_config_id: v.optional(v.nullable(v.string())),
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          tool_filters: toolFiltersValidator
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
                : normalizeToolFilters(ctx.body.tool_filters)
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
          description: 'Updates a specific integration provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .body(
        'default',
        v.object({
          provider_deployment_id: v.optional(v.string()),
          provider_auth_method_id: v.optional(v.nullable(v.string())),
          provider_auth_credentials_id: v.optional(v.nullable(v.string())),
          provider_config_id: v.optional(v.nullable(v.string())),
          name: v.optional(v.string()),
          description: v.optional(v.nullable(v.string())),
          metadata: v.optional(v.nullable(v.record(v.any()))),
          tool_filters: toolFiltersValidator
        })
      )
      .output(integrationProviderPresenter)
      .do(async ctx => {
        let integrationProvider = await integrationProviderService.updateIntegrationProvider({
          instance: ctx.instance,
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
                : normalizeToolFilters(ctx.body.tool_filters)
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
          name: 'Delete integration provider',
          description: 'Archives a specific integration provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.session:write'] }))
      .output(integrationProviderPresenter)
      .do(async ctx => {
        let integrationProvider = await integrationProviderService.archiveIntegrationProvider({
          instance: ctx.instance,
          integrationProvider: ctx.integrationProvider
        });

        return integrationProviderPresenter.present({ integrationProvider });
      })
  }
);
