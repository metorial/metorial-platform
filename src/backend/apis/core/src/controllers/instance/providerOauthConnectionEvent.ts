import { oauthConnectionService } from '@metorial/module-oauth';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { providerOauthConnectionEventPresenter } from '../../presenters';
import { connectionGroup } from './providerOauthConnection';

export let connectionEventGroup = connectionGroup.use(async ctx => {
  if (!ctx.params.eventId) throw new Error('eventId is required');

  let event = await oauthConnectionService.getConnectionEventById({
    eventId: ctx.params.eventId,
    connection: ctx.connection
  });

  return { event };
});

export let providerOauthConnectionEventController = Controller.create(
  {
    name: 'Provider OAuth Connection Event',
    description: 'Manage provider OAuth connection event information'
  },
  {
    list: connectionGroup
      .get(
        instancePath(
          'provider-oauth/connections/:connectionId/events',
          'provider_oauth.connections.events.list'
        ),
        {
          name: 'List provider OAuth connection events',
          description: 'List provider OAuth connection events for a specific connection'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.connection.event:read'] }))
      .outputList(providerOauthConnectionEventPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await oauthConnectionService.listConnectionEvents({
          connection: ctx.connection
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, providerOauthConnectionEvent =>
          providerOauthConnectionEventPresenter.present({ providerOauthConnectionEvent })
        );
      }),

    get: connectionEventGroup
      .get(
        instancePath(
          'provider-oauth/connections/:connectionId/events/:eventId',
          'provider_oauth.connections.events.get'
        ),
        {
          name: 'Get provider OAuth connection event',
          description: 'Get the information of a specific provider OAuth connection event'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.connection.event:read'] }))
      .output(providerOauthConnectionEventPresenter)
      .do(async ctx => {
        return providerOauthConnectionEventPresenter.present({
          providerOauthConnectionEvent: ctx.event
        });
      })
  }
);
