import { badRequestError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { subspaceProviderAuthCredentialsService } from '@metorial/module-subspace';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { providerAuthCredentialsPresenter } from '../../../presenters';

let normalizePublicOriginParam = (origin: ('custom' | 'managed')[] | undefined) =>
  origin?.map(value => (value === 'custom' ? 'tenant_created' : 'managed_backing'));

let providerAuthCredentialsGroup = instanceGroup.use(async ctx => {
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
    description:
      'Auth credentials store your OAuth app registration (client ID, client secret, and scopes). These are the app-level credentials you get from a service like GitHub or Slack.'
  },
  {
    list: instanceGroup
      .get(
        instancePath('provider-auth-credentials', 'providerDeployments.authCredentials.list'),
        {
          name: 'List provider auth credentials',
          description: 'Returns a paginated list of provider auth credentials.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .outputList(providerAuthCredentialsPresenter)
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
              description: 'Filter by credential ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_auth_method_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider auth method ID(s)'
            }),
            origin: v.optional(
              v.union([
                v.enumOf(['custom', 'managed']),
                v.array(v.enumOf(['custom', 'managed']))
              ]),
              {
                description: 'Filter by credential origin (custom, managed)'
              }
            ),
            search: v.optional(v.string({ description: 'Search by name or description' })),
            created_at: dateFilterValidator('provider auth credentials creation time'),
            updated_at: dateFilterValidator('provider auth credentials last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderAuthCredentialsService.list({
          instance: ctx.instance,
          allowDeleted: false,

          search: ctx.query.search,
          status: normalizeArrayParam(ctx.query.status),
          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerAuthMethodIds: normalizeArrayParam(ctx.query.provider_auth_method_id),
          origin: normalizePublicOriginParam(normalizeArrayParam(ctx.query.origin)),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run({
          limit: ctx.query.limit,
          after: ctx.query.after,
          before: ctx.query.before,
          cursor: ctx.query.cursor,
          order: ctx.query.order
        });

        return Paginator.present(list, authCredentials =>
          providerAuthCredentialsPresenter.present({
            authCredentials
          })
        );
      }),

    get: providerAuthCredentialsGroup
      .get(
        instancePath(
          'provider-auth-credentials/:providerAuthCredentialsId',
          'providerDeployments.authCredentials.get'
        ),
        {
          name: 'Get provider auth credentials',
          description: 'Retrieves specific provider auth credentials by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .output(providerAuthCredentialsPresenter)
      .do(async ctx => {
        return providerAuthCredentialsPresenter.present({
          authCredentials: ctx.authCredentials
        });
      }),

    create: instanceGroup
      .post(
        instancePath(
          'provider-auth-credentials',
          'providerDeployments.authCredentials.create'
        ),
        {
          name: 'Create provider auth credentials',
          description: 'Creates new provider auth credentials.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .body(
        'default',
        v.object({
          provider_id: v.string({
            description: 'Provider ID',
            examples: ['pro_5gHjKlMnPqRsTuVw']
          }),
          name: v.optional(v.string({ examples: ['GitHub OAuth'] })),
          description: v.optional(
            v.string({ examples: ['OAuth credentials for GitHub API'] })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              examples: [{ app_name: 'My GitHub App', created_by: 'admin@company.com' }]
            }),
            { description: 'Custom key-value pairs for storing additional information' }
          ),

          config: v.object({
            type: v.optional(v.literal('oauth')),
            client_id: v.string({
              description: 'OAuth client ID',
              examples: ['Iv1.abc123def456']
            }),
            client_secret: v.string({
              description: 'OAuth client secret',
              examples: ['gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx']
            }),
            scopes: v.array(v.string({ examples: ['repo'] }), {
              description: 'OAuth scopes to request',
              examples: [['repo', 'read:user', 'read:org']]
            })
          })
        })
      )
      .output(providerAuthCredentialsPresenter)
      .do(async ctx => {
        let authCredentials = await subspaceProviderAuthCredentialsService.create({
          instance: ctx.instance,
          providerId: ctx.body.provider_id,
          name: ctx.body.name,
          description: ctx.body.description,
          config: {
            type: 'oauth',
            clientId: ctx.body.config.client_id,
            clientSecret: ctx.body.config.client_secret,
            scopes: ctx.body.config.scopes
          },
          metadata: ctx.body.metadata
        });

        return providerAuthCredentialsPresenter.present({
          authCredentials
        });
      }),

    update: providerAuthCredentialsGroup
      .patch(
        instancePath(
          'provider-auth-credentials/:providerAuthCredentialsId',
          'providerDeployments.authCredentials.update'
        ),
        {
          name: 'Update provider auth credentials',
          description: 'Updates specific provider auth credentials.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any()), {
            description: 'Custom key-value pairs for storing additional information'
          }),

          client_id: v.optional(v.string()),
          client_secret: v.optional(v.string()),
          scopes: v.optional(v.array(v.string()))
        })
      )
      .output(providerAuthCredentialsPresenter)
      .do(async ctx => {
        let authCredentials = await subspaceProviderAuthCredentialsService.update({
          instance: ctx.instance,
          providerAuthCredentialsId: ctx.authCredentials.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata,
          clientId: ctx.body.client_id,
          clientSecret: ctx.body.client_secret,
          scopes: ctx.body.scopes
        });

        return providerAuthCredentialsPresenter.present({
          authCredentials
        });
      }),

    delete: providerAuthCredentialsGroup
      .delete(
        instancePath(
          'provider-auth-credentials/:providerAuthCredentialsId',
          'providerDeployments.authCredentials.delete'
        ),
        {
          name: 'Delete provider auth credentials',
          description: 'Permanently deletes provider auth credentials.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .output(providerAuthCredentialsPresenter)
      .do(async ctx => {
        let authCredentials = await subspaceProviderAuthCredentialsService.delete({
          instance: ctx.instance,
          providerAuthCredentialsId: ctx.authCredentials.id
        });

        return providerAuthCredentialsPresenter.present({
          authCredentials
        });
      })
  }
);
