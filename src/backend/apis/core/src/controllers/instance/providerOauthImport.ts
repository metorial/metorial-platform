import { ProviderOAuthConnection } from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import {
  providerOauthConnectionService,
  providerOauthTakeInService
} from '@metorial/module-provider-oauth';
import { serverDeploymentService } from '@metorial/module-server-deployment';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerOauthTakeInPresenter } from '../../presenters';

export let takeoutGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.takeInId) throw new Error('takeInId is required');

  let takeout = await providerOauthTakeInService.getTakeIn({
    takeInId: ctx.params.takeInId,
    instance: ctx.instance
  });

  return { takeout };
});

export let providerOauthTakeInController = Controller.create(
  {
    name: 'OAuth Token Import',
    description: 'Manage provider OAuth import information',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('provider-oauth/token-imports', 'provider_oauth.token_imports.list'), {
        name: 'List provider OAuth imports',
        description: 'List all provider OAuth imports'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.takeout:read'] }))
      .outputList(providerOauthTakeInPresenter)
      .query('default', Paginator.validate(v.object({})))
      .use(hasFlags(['metorial-gateway-enabled', 'paid-oauth-takeout']))
      .do(async ctx => {
        let paginator = await providerOauthTakeInService.listTakeIns({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, providerOauthTakeIn =>
          providerOauthTakeInPresenter.present({
            providerOauthTakeIn
          })
        );
      }),

    create: instanceGroup
      .post(
        instancePath('provider-oauth/token-imports', 'provider_oauth.token_imports.create'),
        {
          name: 'Create provider OAuth import',
          description: 'Create a new provider OAuth import'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.takeout:write'] }))
      .body(
        'default',
        v.intersection([
          v.object({
            note: v.optional(v.string()),
            metadata: v.optional(v.record(v.any())),
            access_token: v.string(),
            expires_at: v.optional(v.date()),
            id_token: v.optional(v.string()),
            scope: v.optional(v.string()),
            token_type: v.optional(v.string())
          }),
          v.union([
            v.object({
              server_deployment_id: v.string()
            }),
            v.object({
              connection_id: v.string()
            })
          ])
        ])
      )
      .use(hasFlags(['metorial-gateway-enabled', 'paid-oauth-takeout']))
      .output(providerOauthTakeInPresenter)
      .do(async ctx => {
        let connection: ProviderOAuthConnection;

        if ('connection_id' in ctx.body) {
          connection = await providerOauthConnectionService.getConnectionById({
            instance: ctx.instance,
            connectionId: ctx.body.connection_id
          });
        } else if ('server_deployment_id' in ctx.body) {
          let serverDeployment = await serverDeploymentService.getServerDeploymentById({
            instance: ctx.instance,
            serverDeploymentId: ctx.body.server_deployment_id
          });
          if (!serverDeployment.oauthConnection) {
            throw new ServiceError(
              badRequestError({
                message: 'Server deployment does not have an OAuth connection'
              })
            );
          }

          connection = serverDeployment.oauthConnection;
        } else {
          throw new Error('Unreachable');
        }

        if (connection.status != 'active') {
          throw new ServiceError(
            badRequestError({
              message: 'OAuth connection must be active'
            })
          );
        }

        let providerOauthTakeIn = await providerOauthTakeInService.createOauthTakeIn({
          instance: ctx.instance,
          context: ctx.context,
          connection,
          input: {
            note: ctx.body.note,
            metadata: ctx.body.metadata,
            accessToken: ctx.body.access_token,
            expiresAt: ctx.body.expires_at,
            idToken: ctx.body.id_token,
            scope: ctx.body.scope,
            tokenType: ctx.body.token_type
          }
        });

        return providerOauthTakeInPresenter.present({
          providerOauthTakeIn
        });
      }),

    get: takeoutGroup
      .get(
        instancePath(
          'provider-oauth/token-imports/:takeInId',
          'provider_oauth.token_imports.get'
        ),
        {
          name: 'Get provider OAuth import',
          description: 'Get information for a specific provider OAuth import'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.takeout:read'] }))
      .output(providerOauthTakeInPresenter)
      .use(hasFlags(['metorial-gateway-enabled', 'paid-oauth-takeout']))
      .do(async ctx => {
        return providerOauthTakeInPresenter.present({
          providerOauthTakeIn: ctx.takeout
        });
      }),

    update: takeoutGroup
      .patch(
        instancePath(
          'provider-oauth/token-imports/:takeInId',
          'provider_oauth.token_imports.update'
        ),
        {
          name: 'Update provider OAuth import',
          description: 'Update information for a specific provider OAuth import'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.takeout:write'] }))
      .body(
        'default',
        v.object({
          note: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          access_token: v.optional(v.string()),
          expires_at: v.optional(v.date()),
          id_token: v.optional(v.string()),
          scope: v.optional(v.string()),
          token_type: v.optional(v.string())
        })
      )
      .use(hasFlags(['metorial-gateway-enabled', 'paid-oauth-takeout']))
      .output(providerOauthTakeInPresenter)
      .do(async ctx => {
        let providerOauthTakeIn = await providerOauthTakeInService.updateOauthTakeIn({
          takeIn: ctx.takeout,
          context: ctx.context,
          input: {
            note: ctx.body.note,
            metadata: ctx.body.metadata,
            accessToken: ctx.body.access_token,
            expiresAt: ctx.body.expires_at,
            idToken: ctx.body.id_token,
            scope: ctx.body.scope,
            tokenType: ctx.body.token_type
          }
        });

        return providerOauthTakeInPresenter.present({
          providerOauthTakeIn
        });
      })
  }
);
