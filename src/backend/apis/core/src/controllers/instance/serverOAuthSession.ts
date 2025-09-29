import { badRequestError, ServiceError } from '@metorial/error';
import { providerOauthConnectionService } from '@metorial/module-provider-oauth';
import { serverDeploymentService } from '@metorial/module-server-deployment';
import { serverOAuthSessionService } from '@metorial/module-session';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { serverOAuthSessionPresenter } from '../../presenters';

export let oauthSessionGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.oauthSessionId) throw new Error('oauthSessionId is required');

  let oauthSession = await serverOAuthSessionService.getServerOAuthSessionById({
    serverOAuthSessionId: ctx.params.oauthSessionId,
    instance: ctx.instance
  });

  return { oauthSession };
});

export let serverOauthSessionController = Controller.create(
  {
    name: 'OAuth Session',
    description: 'Manage provider OAuth session information',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('provider-oauth/sessions', 'provider_oauth.sessions.list'), {
        name: 'List provider OAuth sessions',
        description: 'List all provider OAuth sessions'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.session:read'] }))
      .outputList(serverOAuthSessionPresenter)
      .query('default', Paginator.validate(v.object({})))
      .use(hasFlags(['metorial-gateway-enabled']))
      .do(async ctx => {
        let paginator = await serverOAuthSessionService.listServerOAuthSessions({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, serverOauthSession =>
          serverOAuthSessionPresenter.present({ serverOauthSession })
        );
      }),

    create: instanceGroup
      .post(instancePath('provider-oauth/sessions', 'provider_oauth.sessions.create'), {
        name: 'Create provider OAuth session',
        description: 'Create a new provider OAuth session'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.session:write'] }))
      .body(
        'default',
        v.intersection([
          v.object({
            metadata: v.optional(v.record(v.any())),
            redirect_uri: v.optional(
              v.string({
                modifiers: [v.url()]
              })
            )
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
      .output(serverOAuthSessionPresenter)
      .use(hasFlags(['metorial-gateway-enabled']))
      .do(async ctx => {
        let connectionId: string;

        if ('connection_id' in ctx.body) {
          connectionId = ctx.body.connection_id;
        } else if ('server_deployment_id' in ctx.body) {
          let deployment = await serverDeploymentService.getServerDeploymentById({
            instance: ctx.instance,
            serverDeploymentId: ctx.body.server_deployment_id
          });

          let conId = deployment.oauthConnection?.id;
          if (!conId) {
            throw new ServiceError(
              badRequestError({
                message: 'The specified server deployment does not have an OAuth connection'
              })
            );
          }

          connectionId = conId;
        } else {
          throw new Error('Unreachable');
        }

        let connection = await providerOauthConnectionService.getConnectionById({
          instance: ctx.instance,
          connectionId
        });

        let serverOauthSession = await serverOAuthSessionService.createServerOAuthSession({
          instance: ctx.instance,
          connection,
          input: {
            metadata: ctx.body.metadata,
            redirectUri: ctx.body.redirect_uri
          }
        });

        return serverOAuthSessionPresenter.present({ serverOauthSession });
      }),

    get: oauthSessionGroup
      .get(
        instancePath('provider-oauth/sessions/:oauthSessionId', 'provider_oauth.sessions.get'),
        {
          name: 'Get provider OAuth session',
          description: 'Get information for a specific provider OAuth session'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.session:read'] }))
      .output(serverOAuthSessionPresenter)
      .use(hasFlags(['metorial-gateway-enabled']))
      .do(async ctx => {
        return serverOAuthSessionPresenter.present({
          serverOauthSession: ctx.oauthSession
        });
      }),

    delete: oauthSessionGroup
      .delete(
        instancePath(
          'provider-oauth/sessions/:oauthSessionId',
          'provider_oauth.sessions.delete'
        ),
        {
          name: 'Delete provider OAuth session',
          description: 'Delete a provider OAuth session'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.session:write'] }))
      .output(serverOAuthSessionPresenter)
      .use(hasFlags(['metorial-gateway-enabled']))
      .do(async ctx => {
        let serverOauthSession = await serverOAuthSessionService.archiveServerOAuthSession({
          session: ctx.oauthSession
        });

        return serverOAuthSessionPresenter.present({ serverOauthSession });
      })
  }
);
