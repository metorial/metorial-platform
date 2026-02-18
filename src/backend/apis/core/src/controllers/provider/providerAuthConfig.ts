import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceReferenceAuthConfigService } from '@metorial/module-subspace-reference';
import { subspaceProviderAuthConfigService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerAuthConfigPresenter } from '../../presenters';

import { providerDeploymentGroup } from './providerDeployment';

export let providerAuthConfigGroup = providerDeploymentGroup.use(async ctx => {
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
    list: providerDeploymentGroup
      .get(
        instancePath(
          'provider-deployments/:providerDeploymentId/auth-configs',
          'providerDeployments.authConfigs.list'
        ),
        {
          name: 'List provider auth configs',
          description: 'Returns a paginated list of provider auth configs.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .outputList(providerAuthConfigPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_auth_method_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by auth method ID(s)'
            }),
            provider_auth_credentials_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by auth credentials ID(s)' }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderAuthConfigService.list({
          instance: ctx.instance,
          providerIds: [ctx.deployment.providerId],
          providerDeploymentIds: [ctx.deployment.id],
          providerAuthMethodIds: normalizeArrayParam(ctx.query.provider_auth_method_id),
          providerAuthCredentialsIds: normalizeArrayParam(
            ctx.query.provider_auth_credentials_id
          )
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authConfig =>
          providerAuthConfigPresenter.present({ authConfig })
        );
      }),

    get: providerAuthConfigGroup
      .get(
        instancePath(
          'provider-deployments/:providerDeploymentId/auth-configs/:providerAuthConfigId',
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

    create: providerDeploymentGroup
      .post(
        instancePath(
          'provider-deployments/:providerDeploymentId/auth-configs',
          'providerDeployments.authConfigs.create'
        ),
        {
          name: 'Create provider auth config',
          description: 'Creates a new provider auth config.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .body(
        'default',
        v.object({
          name: v.string({ examples: ['GitHub OAuth Token'] }),
          description: v.optional(
            v.string({ examples: ['OAuth token for GitHub API access'] })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              examples: [{ connected_by: 'alex@company.com', purpose: 'ci-pipeline' }]
            }),
            { description: 'Custom key-value pairs for storing additional information' }
          ),
          provider_auth_method_id: v.string({
            examples: ['pam_2mNpQrStUvWxYzAb'],
            description: 'The authentication method this config uses (e.g., OAuth, API key)'
          }),
          credentials: v.union(
            [
              v.object(
                {
                  type: v.literal('reference'),
                  provider_auth_credentials_id: v.string({
                    description: 'Existing credentials ID',
                    examples: ['par_4sTuVwXyZaBcDeFg']
                  })
                },
                { name: 'reference', description: 'Reference existing credentials by ID' }
              ),
              v.object(
                {
                  type: v.literal('new'),
                  data: v.record(v.any(), {
                    description: 'Authentication credentials',
                    examples: [{ client_id: 'xxx', client_secret: 'xxx' }]
                  })
                },
                { name: 'new', description: 'Provide credentials directly' }
              )
            ],
            { description: 'Authentication credentials source' }
          )
        })
      )
      .output(providerAuthConfigPresenter)
      .do(async ctx => {
        let authConfig = await subspaceProviderAuthConfigService.create({
          instance: ctx.instance,
          providerId: ctx.deployment.providerId,
          providerDeployment: ctx.deployment.id,
          providerAuthMethodId: ctx.body.provider_auth_method_id,
          name: ctx.body.name,
          description: ctx.body.description,
          config: ctx.body.credentials.type === 'new' ? ctx.body.credentials.data : {},
          ip: ctx.context.ip,
          ua: ctx.context.ua ?? '',
          metadata: ctx.body.metadata
        });

        await subspaceReferenceAuthConfigService
          .create({
            instance: ctx.instance,
            authConfig: {
              id: authConfig.id,
              providerId: ctx.deployment.providerId,
              providerDeploymentId: ctx.deployment?.id,
              providerAuthMethodId: ctx.body.provider_auth_method_id,
              name: authConfig.name,
              isEphemeral: authConfig.isEphemeral,
              createdAt: authConfig.createdAt
            }
          })
          .catch(err => console.error('Failed to store subspace reference:', err));

        return providerAuthConfigPresenter.present({ authConfig });
      }),

    update: providerAuthConfigGroup
      .patch(
        instancePath(
          'provider-deployments/:providerDeploymentId/auth-configs/:providerAuthConfigId',
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
          )
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
          ip: ctx.context.ip,
          ua: ctx.context.ua ?? ''
        });

        return providerAuthConfigPresenter.present({ authConfig });
      }),

    // delete handler removed: delete method not available on subspaceProviderAuthConfigService
  }
);

// Provider-scoped auth config list (not deployment-scoped)
export let providerAuthConfigListController = Controller.create(
  {
    name: 'Provider Auth Configs (Provider-scoped)',
    description: 'List auth configs scoped to a provider, optionally filtered by deployment.'
  },
  {
    list: instanceGroup
      .get(instancePath('providers/auth-configs', 'providers.authConfigs.list'), {
        name: 'List provider auth configs',
        description:
          'Returns a paginated list of auth configs, optionally filtered by provider and deployment IDs.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .outputList(providerAuthConfigPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by deployment ID(s)'
            }),
            provider_auth_method_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by auth method ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderAuthConfigService.list({
          instance: ctx.instance,
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerAuthMethodIds: normalizeArrayParam(ctx.query.provider_auth_method_id)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, authConfig =>
          providerAuthConfigPresenter.present({ authConfig })
        );
      })
  }
);
