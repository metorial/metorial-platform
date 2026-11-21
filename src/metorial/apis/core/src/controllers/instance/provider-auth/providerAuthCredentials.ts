import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { providerAuthCredentialsService } from '@metorial-subspace/module-auth';
import { providerService } from '@metorial-subspace/module-catalog';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { integrationsGroup, instancePath } from '../../../middleware/instanceGroup';
import { providerAuthCredentialsPresenter } from '@metorial/presenters';

let normalizePublicOriginParam = (origin: ('custom' | 'managed')[] | undefined) =>
  origin?.map(value => (value === 'custom' ? 'tenant_created' : 'managed_backing'));

let providerAuthCredentialsGroup = integrationsGroup.use(async ctx => {
  if (!ctx.params.providerAuthCredentialsId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerAuthCredentialsId is required',
        description: 'The providerAuthCredentialsId path parameter is required.'
      })
    );
  }

  let authCredentials = await providerAuthCredentialsService.getProviderAuthCredentialsById({
    instance: ctx.instance,
    providerAuthCredentialsId: ctx.params.providerAuthCredentialsId
  });
  let [enrichedAuthCredentials] = await providerAuthCredentialsService.enrichWithScopes({
    instance: ctx.instance,
    credentials: [authCredentials]
  });

  return { authCredentials: enrichedAuthCredentials! };
});

export let providerAuthCredentialsController = Controller.create(
  {
    name: 'Provider Auth Credentials',
    description:
      'Provider auth credentials are an OAuth app registration used with a provider: a client ID, a client secret, and scopes.'
  },
  {
    list: integrationsGroup
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
        let paginator = await providerAuthCredentialsService.listProviderAuthCredentials({
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
        let authCredentials = await providerAuthCredentialsService.enrichWithScopes({
          instance: ctx.instance,
          credentials: list.items
        });

        return Paginator.present({ ...list, items: authCredentials }, authCredentials =>
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
          description: 'Retrieves provider auth credentials.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .output(providerAuthCredentialsPresenter)
      .do(async ctx => {
        return providerAuthCredentialsPresenter.present({
          authCredentials: ctx.authCredentials
        });
      }),

    create: integrationsGroup
      .post(
        instancePath(
          'provider-auth-credentials',
          'providerDeployments.authCredentials.create'
        ),
        {
          name: 'Create provider auth credentials',
          description: 'Creates provider auth credentials.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .body(
        'default',
        v.object({
          provider_id: v.string({
            description: 'Provider to create credentials for.',
            examples: ['pro_5gHjKlMnPqRsTuVw']
          }),
          name: v.optional(v.string({ examples: ['GitHub OAuth'] }), {
            description: 'Display name.'
          }),
          description: v.optional(
            v.string({ examples: ['OAuth credentials for GitHub API'] }),
            { description: 'Free-text description.' }
          ),
          metadata: v.optional(
            v.record(v.any(), {
              examples: [{ app_name: 'My GitHub App', created_by: 'admin@company.com' }]
            }),
            {
              description:
                'Custom data to identify or organize the provider auth credentials. Replaces existing metadata.'
            }
          ),

          config: v.object(
            {
              type: v.optional(v.literal('oauth'), { description: 'Must be `oauth`.' }),
              client_id: v.string({
                description: 'Client ID of your OAuth app.',
                examples: ['Iv1.abc123def456']
              }),
              client_secret: v.string({
                description: 'Client secret of your OAuth app.',
                examples: ['gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx']
              }),
              scopes: v.array(v.string({ examples: ['repo'] }), {
                description: 'OAuth scopes to request',
                examples: [['repo', 'read:user', 'read:org']]
              })
            },
            { description: 'OAuth app credentials to store.' }
          )
        })
      )
      .output(providerAuthCredentialsPresenter)
      .do(async ctx => {
        let provider = await providerService.getProviderById({
          instance: ctx.instance,
          providerId: ctx.body.provider_id
        });
        let authCredentials =
          await providerAuthCredentialsService.createProviderAuthCredentials({
            instance: ctx.instance,
            auditScope: ctx.auditScope,
            provider,
            input: {
              name: ctx.body.name,
              description: ctx.body.description,
              config: {
                type: 'oauth',
                clientId: ctx.body.config.client_id,
                clientSecret: ctx.body.config.client_secret,
                scopes: ctx.body.config.scopes
              },
              metadata: ctx.body.metadata
            }
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
          description: 'Updates provider auth credentials.',
          confidential: true
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string(), { description: 'Display name.' }),
          description: v.optional(v.string(), { description: 'Free-text description.' }),
          metadata: v.optional(v.record(v.any()), {
            description:
              'Custom data to identify or organize the provider auth credentials. Replaces existing metadata.'
          }),

          client_id: v.optional(v.string(), {
            description: 'Client ID of your OAuth app.'
          }),
          client_secret: v.optional(v.string(), {
            description: 'Client secret of your OAuth app.'
          }),
          scopes: v.optional(v.array(v.string()), {
            description: 'OAuth scopes to request.'
          })
        })
      )
      .output(providerAuthCredentialsPresenter)
      .do(async ctx => {
        let authCredentials =
          await providerAuthCredentialsService.updateProviderAuthCredentials({
            instance: ctx.instance,
            auditScope: ctx.auditScope,
            providerAuthCredentials: ctx.authCredentials,
            input: {
              name: ctx.body.name,
              description: ctx.body.description,
              metadata: ctx.body.metadata,
              clientId: ctx.body.client_id,
              clientSecret: ctx.body.client_secret,
              scopes: ctx.body.scopes
            }
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
          name: 'Archive provider auth credentials',
          description:
            'Archives provider auth credentials. They stay listable with `status=archived`.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .output(providerAuthCredentialsPresenter)
      .do(async ctx => {
        let authCredentials =
          await providerAuthCredentialsService.archiveProviderAuthCredentials({
            instance: ctx.instance,
            auditScope: ctx.auditScope,
            providerAuthCredentials: ctx.authCredentials
          });

        return providerAuthCredentialsPresenter.present({
          authCredentials
        });
      })
  }
);
