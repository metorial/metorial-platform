import {
  subspaceProviderSetupSessionService,
  type SubspaceProviderSetupSession
} from '@metorial/module-subspace';
import { Paginator } from '@metorial/pagination';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { normalizeArrayParam } from '../../lib/normalizeArrayParam';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup } from '../../middleware/instanceGroup';
import { providerSetupSessionPresenter } from '../../presenters';

export let providerSetupSessionDashboardController = Controller.create(
  {
    name: 'Provider Setup Sessions (Dashboard)',
    description:
      "A setup session tracks an in-progress OAuth flow, storing state during the redirect. On success, it creates an auth config with the user's access token."
  },
  {
    list: instanceGroup
      .get(
        Path(
          '/dashboard/instances/:instanceId/provider-deployments/:providerDeploymentId/setup-sessions',
          'dashboard.instance.providerDeployments.setupSessions.list'
        ),
        {
          name: 'List provider setup sessions',
          description: 'Returns a paginated list of provider setup sessions.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:read'] }))
      .outputList(providerSetupSessionPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            provider_auth_method_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by auth method ID(s)'
            }),
            status: v.optional(v.string(), { description: 'Filter by session status' })

            //             status: ("archived" | "failed" | "pending" | "completed" | "expired")[] | undefined;
            // ids: string[] | undefined;
            // providerIds: string[] | undefined;
            // providerAuthMethodIds: string[] | undefined;
            // providerDeploymentIds: string[] | undefined;
            // providerAuthConfigIds: string[] | undefined;
            // providerAuthCredentialsIds: string[] | undefined;
          })
        )
      )
      .do(async ctx => {
        let paginator = await subspaceProviderSetupSessionService.list({
          instance: ctx.instance,
          providerIds: [ctx.deployment.providerId],
          providerAuthMethodIds: normalizeArrayParam(ctx.query.provider_auth_method_id),
          status: ctx.query.status
            ? ([ctx.query.status] as (
                | 'archived'
                | 'failed'
                | 'completed'
                | 'expired'
                | 'pending'
              )[])
            : undefined
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, setupSession =>
          providerSetupSessionPresenter.present({
            setupSession: setupSession as SubspaceProviderSetupSession
          })
        );
      }),

    get: instanceGroup
      .get(
        Path(
          '/dashboard/instances/:instanceId/provider-deployments/:providerDeploymentId/setup-sessions/:providerSetupSessionId',
          'dashboard.instance.providerDeployments.setupSessions.get'
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
        Path(
          '/dashboard/instances/:instanceId/provider-deployments/:providerDeploymentId/setup-sessions',
          'dashboard.instance.providerDeployments.setupSessions.create'
        ),
        {
          name: 'Create provider setup session',
          description: 'Creates a new provider setup session for OAuth authentication.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider.auth:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string({ examples: ['GitHub OAuth Setup'] })),
          description: v.optional(v.string({ examples: ['Connect your GitHub account'] })),
          metadata: v.optional(
            v.record(v.any(), {
              examples: [{ redirect_uri: 'https://app.example.com/callback' }]
            }),
            { description: 'Custom key-value pairs for storing additional information' }
          ),
          providerAuthMethodId: v.string({
            examples: ['pam_2mNpQrStUvWxYzAb'],
            description: 'The authentication method to use (e.g., OAuth flow)'
          }),
          providerAuthCredentialsId: v.optional(
            v.string({
              examples: ['pac_3nOpRsTuVwXyZaBc'],
              description: 'Optional OAuth app credentials to use instead of defaults'
            })
          ),
          redirectUrl: v.optional(
            v.string({ examples: ['https://app.example.com/oauth/callback'] })
          )
        })
      )
      .output(providerSetupSessionPresenter)
      .do(async ctx => {
        let setupSession = await subspaceProviderSetupSessionService.create({
          instance: ctx.instance,
          providerId: ctx.deployment.providerId,
          providerDeploymentId: ctx.deployment.id,
          providerAuthMethodId: ctx.body.providerAuthMethodId,
          providerAuthCredentialsId: ctx.body.providerAuthCredentialsId,
          name: ctx.body.name ?? 'Setup Session',
          description: ctx.body.description,
          uiMode: 'dashboard_embeddable',
          type: 'auth_only',
          ip: ctx.context.ip,
          ua: ctx.context.ua ?? '',
          redirectUrl: ctx.body.redirectUrl,
          metadata: ctx.body.metadata
        });

        return providerSetupSessionPresenter.present({
          setupSession: setupSession as SubspaceProviderSetupSession
        });
      }),

    update: instanceGroup
      .patch(
        Path(
          '/dashboard/instances/:instanceId/provider-deployments/:providerDeploymentId/setup-sessions/:providerSetupSessionId',
          'dashboard.instance.providerDeployments.setupSessions.update'
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
          setupSession: setupSession as SubspaceProviderSetupSession
        });
      }),

    delete: instanceGroup
      .delete(
        Path(
          '/dashboard/instances/:instanceId/provider-deployments/:providerDeploymentId/setup-sessions/:providerSetupSessionId',
          'dashboard.instance.providerDeployments.setupSessions.delete'
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
