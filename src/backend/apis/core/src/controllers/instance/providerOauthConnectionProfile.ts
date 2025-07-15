import { oauthConnectionService } from '@metorial/module-oauth';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { providerOauthConnectionProfilePresenter } from '../../presenters';
import { connectionGroup } from './providerOauthConnection';

export let connectionProfileGroup = connectionGroup.use(async ctx => {
  if (!ctx.params.profileId) throw new Error('profileId is required');

  let profile = await oauthConnectionService.getConnectionProfileById({
    profileId: ctx.params.profileId,
    connection: ctx.connection
  });

  return { profile };
});

export let providerOauthConnectionProfileController = Controller.create(
  {
    name: 'Provider OAuth Connection Profile',
    description: 'Manage provider OAuth connection profile information'
  },
  {
    list: connectionGroup
      .get(
        instancePath(
          'provider-oauth/connections/:connectionId/profiles',
          'provider_oauth.connections.profiles.list'
        ),
        {
          name: 'List provider OAuth connection profiles',
          description: 'List provider OAuth connection profiles for a specific connection'
        }
      )
      .use(
        checkAccess({ possibleScopes: ['instance.provider_oauth.connection.profile:read'] })
      )
      .outputList(providerOauthConnectionProfilePresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await oauthConnectionService.listConnectionProfiles({
          connection: ctx.connection
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, providerOauthConnectionProfile =>
          providerOauthConnectionProfilePresenter.present({ providerOauthConnectionProfile })
        );
      }),

    get: connectionProfileGroup
      .get(
        instancePath(
          'provider-oauth/connections/:connectionId/profiles/:profileId',
          'provider_oauth.connections.profiles.get'
        ),
        {
          name: 'Get provider OAuth connection profile',
          description: 'Get the information of a specific provider OAuth connection profile'
        }
      )
      .use(
        checkAccess({ possibleScopes: ['instance.provider_oauth.connection.profile:read'] })
      )
      .output(providerOauthConnectionProfilePresenter)
      .do(async ctx => {
        return providerOauthConnectionProfilePresenter.present({
          providerOauthConnectionProfile: ctx.profile
        });
      })
  }
);
