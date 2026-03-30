import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  subspaceProviderAuthConfigService,
  subspaceProviderAuthMethodService
} from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../lib/dateFilter';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerAuthConfigPresenter } from '../../presenters';
import { toolFiltersValidator } from './session';

let providerAuthConfigGroup = instanceGroup.use(async ctx => {
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
    description:
      "An auth config is a user's authenticated connection to a provider. Created when a user completes OAuth or manually enters an API token."
  },
  {
    list: instanceGroup
      .get(instancePath('provider-auth-configs', 'providerDeployments.authConfigs.list'), {
        name: 'List provider auth configs',
        description: 'Returns a paginated list of provider auth configs.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .outputList(providerAuthConfigPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([
                v.enumOf(['active', 'archived']),
                v.array(v.enumOf(['active', 'archived']))
              ]),
              {
                description: 'Filter by status (active, archived)'
              }
            ),
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by auth config ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider deployment ID(s)'
            }),
            provider_auth_credentials_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              {
                description: 'Filter by auth credentials ID(s)'
              }
            ),
            provider_auth_method_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by auth method ID(s)'
            }),
            search: v.optional(v.string({ description: 'Search by name or description' })),
            created_at: dateFilterValidator('provider auth config creation time'),
            updated_at: dateFilterValidator('provider auth config last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderAuthConfigService.list({
          instance: ctx.instance,
          allowDeleted: false,

          search: ctx.query.search,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerAuthCredentialsIds: normalizeArrayParam(
            ctx.query.provider_auth_credentials_id
          ),
          providerAuthMethodIds: normalizeArrayParam(ctx.query.provider_auth_method_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authConfig =>
          providerAuthConfigPresenter.present({
            authConfig
          })
        );
      }),

    get: providerAuthConfigGroup
      .get(
        instancePath(
          'provider-auth-configs/:providerAuthConfigId',
          'providerDeployments.authConfigs.get'
        ),
        {
          name: 'Get provider auth config',
          description: 'Retrieves a specific provider auth config by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .output(providerAuthConfigPresenter)
      .do(async ctx => {
        return providerAuthConfigPresenter.present({ authConfig: ctx.authConfig });
      }),

    create: instanceGroup
      .post(instancePath('provider-auth-configs', 'providerDeployments.authConfigs.create'), {
        name: 'Create provider auth config',
        description: 'Creates a new provider auth config.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['GitHub OAuth Token'] })),
          description: v.optional(
            v.string({ examples: ['OAuth token for GitHub API access'] })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              examples: [{ connected_by: 'alex@company.com', purpose: 'ci-pipeline' }]
            }),
            { description: 'Custom key-value pairs for storing additional information' }
          ),
          tool_filters: toolFiltersValidator,
          provider_auth_method_id: v.string({
            examples: ['pam_2mNpQrStUvWxYzAb'],
            description: 'The authentication method this config uses (e.g., OAuth, API key)'
          }),

          provider_deployment_id: v.optional(
            v.string({
              description:
                'The provider deployment this auth config is associated with (if applicable)',
              examples: ['pd_2mNpQrStUvWxYzAb']
            })
          ),

          value: v.record(v.any(), {
            description: 'Authentication config payload',
            examples: [{ client_id: 'xxx', client_secret: 'xxx' }]
          })
        })
      )
      .output(providerAuthConfigPresenter)
      .do(async ctx => {
        let authMethod = await subspaceProviderAuthMethodService.get({
          instance: ctx.instance,
          providerAuthMethodId: ctx.body.provider_auth_method_id
        });

        let authConfig = await subspaceProviderAuthConfigService.create({
          instance: ctx.instance,
          providerId: authMethod.providerId,
          providerAuthMethodId: ctx.body.provider_auth_method_id,

          providerDeployment: ctx.body.provider_deployment_id
            ? {
                type: 'reference',
                providerDeploymentId: ctx.body.provider_deployment_id
              }
            : undefined,

          name: ctx.body.name,
          description: ctx.body.description,
          ip: ctx.context.ip,
          ua: ctx.context.ua ?? '',
          metadata: ctx.body.metadata,
          toolFilters: ctx.body.tool_filters,

          config: ctx.body.value
        });

        return providerAuthConfigPresenter.present({
          authConfig
        });
      }),

    update: providerAuthConfigGroup
      .patch(
        instancePath(
          'provider-auth-configs/:providerAuthConfigId',
          'providerDeployments.authConfigs.update'
        ),
        {
          name: 'Update provider auth config',
          description: 'Updates a specific provider auth config.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['Updated Auth Config Name'] })),
          description: v.optional(
            v.string({ examples: ['Updated description for auth configuration'] })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              examples: [{ connected_by: 'alex@company.com', purpose: 'production' }]
            }),
            { description: 'Custom key-value pairs for storing additional information' }
          ),
          tool_filters: toolFiltersValidator
        })
      )
      .output(providerAuthConfigPresenter)
      .do(async ctx => {
        let authConfig = await subspaceProviderAuthConfigService.update({
          instance: ctx.instance,
          providerAuthConfigId: ctx.authConfig.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          toolFilters: ctx.body.tool_filters,
          ip: ctx.context.ip,
          ua: ctx.context.ua ?? ''
        });

        return providerAuthConfigPresenter.present({
          authConfig
        });
      }),

    delete: providerAuthConfigGroup
      .delete(
        instancePath(
          'provider-auth-configs/:providerAuthConfigId',
          'providerDeployments.authConfigs.delete'
        ),
        {
          name: 'Delete provider auth config',
          description: 'Permanently deletes a provider auth config.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .output(providerAuthConfigPresenter)
      .do(async ctx => {
        return providerAuthConfigPresenter.present({ authConfig: ctx.authConfig });
      })
  }
);
