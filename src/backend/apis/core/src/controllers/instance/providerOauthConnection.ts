import {
  providerOauthConnectionService,
  providerOauthTemplateService
} from '@metorial/module-provider-oauth';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { providerOauthConnectionPresenter } from '../../presenters';

export let connectionGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.connectionId) throw new Error('connectionId is required');

  let connection = await providerOauthConnectionService.getConnectionById({
    connectionId: ctx.params.connectionId,
    instance: ctx.instance
  });

  return { connection };
});

export let providerOauthConnectionController = Controller.create(
  {
    name: 'OAuth Connection',
    description: 'Manage provider OAuth connection information',
    hideInDocs: true
  },
  {
    list: instanceGroup
      .get(instancePath('provider-oauth/connections', 'provider_oauth.connections.list'), {
        name: 'List provider OAuth connections',
        description: 'List all provider OAuth connections'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.connection:read'] }))
      .outputList(providerOauthConnectionPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await providerOauthConnectionService.listConnections({
          instance: ctx.instance
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, providerOauthConnection =>
          providerOauthConnectionPresenter.present({ providerOauthConnection })
        );
      }),

    create: instanceGroup
      .post(instancePath('provider-oauth/connections', 'provider_oauth.connections.create'), {
        name: 'Create provider OAuth connection',
        description: 'Create a new provider OAuth connection'
      })
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.connection:write'] }))
      .body(
        'default',
        v.intersection([
          v.object({
            template_id: v.optional(v.string()),
            name: v.optional(v.string()),
            description: v.optional(v.string()),
            discovery_url: v.optional(v.string()),
            config: v.record(v.any()),
            scopes: v.array(v.string()),
            metadata: v.optional(v.record(v.any()))
          }),
          v.union([
            v.object({
              client_id: v.string(),
              client_secret: v.string()
            }),
            v.object({
              auto_registration_id: v.string()
            })
          ])
        ])
      )
      .body(
        'mt_2025_01_01_pulsar',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          discovery_url: v.optional(v.string()),
          config: v.record(v.any()),
          client_id: v.string(),
          client_secret: v.string(),
          scopes: v.array(v.string()),
          metadata: v.optional(v.record(v.any()))
        }),
        i => i
      )
      .output(providerOauthConnectionPresenter)
      .do(async ctx => {
        let template = ctx.body.template_id
          ? await providerOauthTemplateService.getTemplateById({
              templateId: ctx.body.template_id
            })
          : undefined;

        let providerOauthConnection = await providerOauthConnectionService.createConnection({
          organization: ctx.organization,
          performedBy: ctx.actor,
          instance: ctx.instance,
          template,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            discoveryUrl: ctx.body.discovery_url,
            config: ctx.body.config as any,
            clientId: 'client_id' in ctx.body ? ctx.body.client_id : undefined,
            clientSecret: 'client_secret' in ctx.body ? ctx.body.client_secret : undefined,
            autoRegistrationId:
              'auto_registration_id' in ctx.body ? ctx.body.auto_registration_id : undefined,
            scopes: ctx.body.scopes,
            metadata: ctx.body.metadata
          }
        });

        return providerOauthConnectionPresenter.present({ providerOauthConnection });
      }),

    get: connectionGroup
      .get(
        instancePath(
          'provider-oauth/connections/:connectionId',
          'provider_oauth.connections.get'
        ),
        {
          name: 'Get provider OAuth connection',
          description: 'Get information for a specific provider OAuth connection'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.connection:read'] }))
      .output(providerOauthConnectionPresenter)
      .do(async ctx => {
        return providerOauthConnectionPresenter.present({
          providerOauthConnection: ctx.connection
        });
      }),

    update: connectionGroup
      .patch(
        instancePath(
          'provider-oauth/connections/:connectionId',
          'provider_oauth.connections.update'
        ),
        {
          name: 'Update provider OAuth connection',
          description: 'Update a provider OAuth connection'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.connection:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          config: v.optional(v.record(v.any())),
          client_id: v.optional(v.string()),
          client_secret: v.optional(v.string()),
          scopes: v.optional(v.array(v.string())),
          metadata: v.optional(v.record(v.any()))
        })
      )
      .output(providerOauthConnectionPresenter)
      .do(async ctx => {
        let providerOauthConnection = await providerOauthConnectionService.updateConnection({
          organization: ctx.organization,
          performedBy: ctx.actor,
          instance: ctx.instance,
          connection: ctx.connection,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            config: ctx.body.config as any,
            clientId: ctx.body.client_id,
            clientSecret: ctx.body.client_secret,
            scopes: ctx.body.scopes,
            metadata: ctx.body.metadata
          }
        });

        return providerOauthConnectionPresenter.present({ providerOauthConnection });
      }),

    delete: connectionGroup
      .delete(
        instancePath(
          'provider-oauth/connections/:connectionId',
          'provider_oauth.connections.delete'
        ),
        {
          name: 'Delete provider OAuth connection',
          description: 'Delete a provider OAuth connection'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.provider_oauth.connection:write'] }))
      .output(providerOauthConnectionPresenter)
      .do(async ctx => {
        let providerOauthConnection = await providerOauthConnectionService.archiveConnection({
          organization: ctx.organization,
          performedBy: ctx.actor,
          instance: ctx.instance,
          connection: ctx.connection
        });

        return providerOauthConnectionPresenter.present({ providerOauthConnection });
      })
  }
);
