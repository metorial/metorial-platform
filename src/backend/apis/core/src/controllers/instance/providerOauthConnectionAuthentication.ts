import { oauthConnectionService } from '@metorial/module-oauth';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { providerOauthConnectionAuthenticationPresenter } from '../../presenters';
import { connectionGroup } from './providerOauthConnection';

export let connectionAuthenticationGroup = connectionGroup.use(async ctx => {
  if (!ctx.params.authenticationId) throw new Error('authenticationId is required');

  let authentication = await oauthConnectionService.getConnectionAuthenticationById({
    authenticationId: ctx.params.authenticationId,
    connection: ctx.connection
  });

  return { authentication };
});

export let providerOauthConnectionAuthenticationController = Controller.create(
  {
    name: 'OAuth Authentication',
    description: 'Manage provider OAuth connection authentication information',
    hideInDocs: true
  },
  {
    list: connectionGroup
      .get(
        instancePath(
          'provider-oauth/connections/:connectionId/authentications',
          'provider_oauth.connections.authentications.list'
        ),
        {
          name: 'List provider OAuth connection authentications',
          description:
            'List provider OAuth connection authentications for a specific connection'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.provider_oauth.connection.authentication:read']
        })
      )
      .outputList(providerOauthConnectionAuthenticationPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await oauthConnectionService.listConnectionAuthentications({
          connection: ctx.connection
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, providerOauthConnectionAuthAttempt =>
          providerOauthConnectionAuthenticationPresenter.present({
            providerOauthConnectionAuthAttempt
          })
        );
      }),

    get: connectionAuthenticationGroup
      .get(
        instancePath(
          'provider-oauth/connections/:connectionId/authentications/:authenticationId',
          'provider_oauth.connections.authentications.get'
        ),
        {
          name: 'Get provider OAuth connection authentication',
          description:
            'Get the information of a specific provider OAuth connection authentication'
        }
      )
      .use(
        checkAccess({
          possibleScopes: ['instance.provider_oauth.connection.authentication:read']
        })
      )
      .output(providerOauthConnectionAuthenticationPresenter)
      .do(async ctx => {
        return providerOauthConnectionAuthenticationPresenter.present({
          providerOauthConnectionAuthAttempt: ctx.authentication
        });
      })
  }
);
