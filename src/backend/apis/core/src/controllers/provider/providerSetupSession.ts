import { badRequestError, ServiceError } from '@metorial/error';
import { subspaceProviderSetupSessionService } from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerSetupSessionPresenter } from '../../presenters';

let providerSetupSessionGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.providerSetupSessionId) {
    throw new ServiceError(
      badRequestError({
        message: 'providerSetupSessionId is required',
        description: 'The providerSetupSessionId path parameter is required.'
      })
    );
  }

  let setupSession = await subspaceProviderSetupSessionService.get({
    instance: ctx.instance,
    providerSetupSessionId: ctx.params.providerSetupSessionId
  });

  return { setupSession };
});

export let providerSetupSessionController = Controller.create(
  {
    name: 'Provider Setup Sessions',
    description:
      "A setup session tracks an in-progress OAuth flow, storing state during the redirect. On success, it creates an auth config with the user's access token."
  },
  {
    list: instanceGroup
      .get(instancePath('provider-setup-sessions', 'providerDeployments.setupSessions.list'), {
        name: 'List provider setup sessions',
        description: 'Returns a paginated list of provider setup sessions.'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .outputList(providerSetupSessionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by setup session ID(s)'
            }),
            provider_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider ID(s)'
            }),
            provider_deployment_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider deployment ID(s)'
            }),
            provider_auth_method_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by auth method ID(s)'
            }),
            provider_auth_config_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by provider auth config ID(s)'
            }),
            provider_auth_credentials_id: v.optional(
              v.union([v.string(), v.array(v.string())]),
              { description: 'Filter by provider auth credentials ID(s)' }
            ),
            status: v.optional(
              v.union([
                v.enumOf(['archived', 'failed', 'completed', 'expired', 'pending']),
                v.array(v.enumOf(['archived', 'failed', 'completed', 'expired', 'pending']))
              ]),
              {
                description:
                  'Filter by session status (archived, failed, completed, expired, pending)'
              }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderSetupSessionService.list({
          instance: ctx.instance,
          allowDeleted: false,

          ids: normalizeArrayParam(ctx.query.id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerDeploymentIds: normalizeArrayParam(ctx.query.provider_deployment_id),
          providerAuthMethodIds: normalizeArrayParam(ctx.query.provider_auth_method_id),
          providerAuthConfigIds: normalizeArrayParam(ctx.query.provider_auth_config_id),
          providerAuthCredentialsIds: normalizeArrayParam(
            ctx.query.provider_auth_credentials_id
          ),
          status: normalizeArrayParam(ctx.query.status)
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, setupSession =>
          providerSetupSessionPresenter.present({
            setupSession
          })
        );
      }),

    get: providerSetupSessionGroup
      .get(
        instancePath(
          'provider-setup-sessions/:providerSetupSessionId',
          'providerDeployments.setupSessions.get'
        ),
        {
          name: 'Get provider setup session',
          description: 'Retrieves a specific provider setup session by ID.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .output(providerSetupSessionPresenter)
      .do(async ctx => {
        return providerSetupSessionPresenter.present({ setupSession: ctx.setupSession });
      }),

    create: instanceGroup
      .post(
        instancePath('provider-setup-sessions', 'providerDeployments.setupSessions.create'),
        {
          name: 'Create provider setup session',
          description: 'Creates a new provider setup session for OAuth authentication.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .body(
        'default',
        v.object({
          provider_id: v.string({
            examples: ['pro_5gHjKlMnPqRsTuVw'],
            description: 'The provider ID'
          }),
          provider_deployment_id: v.optional(
            v.string({
              examples: ['pdp_4dEfGhJkLmNpQrSt'],
              description: 'Optional provider deployment ID'
            })
          ),
          name: v.optional(v.string({ examples: ['GitHub OAuth Setup'] })),
          description: v.optional(v.string({ examples: ['Connect your GitHub account'] })),
          metadata: v.optional(
            v.record(v.any(), {
              examples: [{ redirect_uri: 'https://app.example.com/callback' }]
            }),
            { description: 'Custom key-value pairs for storing additional information' }
          ),
          provider_auth_method_id: v.optional(
            v.string({
              examples: ['pam_2mNpQrStUvWxYzAb'],
              description: 'The authentication method to use (e.g., OAuth flow)'
            })
          ),
          provider_auth_credentials_id: v.optional(
            v.string({
              examples: ['pac_3nOpRsTuVwXyZaBc'],
              description: 'Optional OAuth app credentials to use instead of defaults'
            })
          ),
          redirect_url: v.optional(
            v.string({ examples: ['https://app.example.com/oauth/callback'] })
          )
        })
      )
      .output(providerSetupSessionPresenter)
      .do(async ctx => {
        let setupSession = await subspaceProviderSetupSessionService.create({
          instance: ctx.instance,
          providerId: ctx.body.provider_id,
          providerDeploymentId: ctx.body.provider_deployment_id,
          providerAuthMethodId: ctx.body.provider_auth_method_id,
          providerAuthCredentialsId: ctx.body.provider_auth_credentials_id,
          name: ctx.body.name ?? 'Setup Session',
          description: ctx.body.description,
          uiMode: 'metorial_elements',
          type: 'auth_only',
          ip: ctx.context.ip,
          ua: ctx.context.ua ?? '',
          redirectUrl: ctx.body.redirect_url,
          metadata: ctx.body.metadata
        });

        return providerSetupSessionPresenter.present({
          setupSession
        });
      }),

    update: providerSetupSessionGroup
      .patch(
        instancePath(
          'provider-setup-sessions/:providerSetupSessionId',
          'providerDeployments.setupSessions.update'
        ),
        {
          name: 'Update provider setup session',
          description: 'Updates a specific provider setup session.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['Updated Setup Session'] })),
          description: v.optional(
            v.string({ examples: ['Updated setup session description'] })
          ),
          metadata: v.optional(
            v.record(v.any(), {
              examples: [{ redirect_uri: 'https://app.example.com/new-callback' }]
            }),
            { description: 'Custom key-value pairs for storing additional information' }
          )
        })
      )
      .output(providerSetupSessionPresenter)
      .do(async ctx => {
        let setupSession = await subspaceProviderSetupSessionService.update({
          instance: ctx.instance,
          providerSetupSessionId: ctx.setupSession.id,
          name: ctx.body.name,
          description: ctx.body.description,
          metadata: ctx.body.metadata
        });

        return providerSetupSessionPresenter.present({
          setupSession
        });
      }),

    delete: providerSetupSessionGroup
      .delete(
        instancePath(
          'provider-setup-sessions/:providerSetupSessionId',
          'providerDeployments.setupSessions.delete'
        ),
        {
          name: 'Delete provider setup session',
          description: 'Deletes a provider setup session.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .output(providerSetupSessionPresenter)
      .do(async ctx => {
        return providerSetupSessionPresenter.present({ setupSession: ctx.setupSession });
      })
  }
);
