import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { callbackService } from '@metorial-subspace/module-callback';
import { integrationProviderService } from '@metorial-subspace/module-integration';
import { callbackConfigSchemaPresenter, callbackPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';

export let integrationProviderCallbackGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.integrationProviderId) {
    throw new ServiceError(
      badRequestError({
        message: 'integrationProviderId is required',
        description: 'The integrationProviderId path parameter is required.'
      })
    );
  }

  let integrationProvider = await integrationProviderService.getIntegrationProviderById({
    instance: ctx.instance,
    integrationProviderId: ctx.params.integrationProviderId,
    allowDeleted: false
  });

  return { integrationProvider };
});

export let integrationProviderCallbackController = Controller.create(
  {
    name: 'Integration Provider Callback',
    description: 'Configure the callback owned by an integration provider.'
  },
  {
    get: integrationProviderCallbackGroup
      .get(
        instancePath(
          'integration-providers/:integrationProviderId/callback',
          'integrations.providers.callback.get'
        ),
        {
          name: 'Get integration provider callback',
          description: 'Retrieves the active callback configured for an integration provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .output(callbackPresenter)
      .do(async ctx => {
        let callback = await callbackService.getCallbackForIntegrationProvider({
          instance: ctx.instance,
          integrationProvider: ctx.integrationProvider
        });
        if (!callback) {
          throw new ServiceError(notFoundError('callback', ctx.integrationProvider.id));
        }
        return callbackPresenter.present({ callback });
      }),

    upsert: integrationProviderCallbackGroup
      .put(
        instancePath(
          'integration-providers/:integrationProviderId/callback',
          'integrations.providers.callback.upsert'
        ),
        {
          name: 'Upsert integration provider callback',
          description: 'Creates or updates the callback owned by an integration provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          metadata: v.optional(v.record(v.any())),
          poll_interval_seconds_override: v.optional(v.nullable(v.number())),
          triggers: v.array(
            v.object({
              trigger_id: v.string(),
              event_types: v.optional(v.array(v.string()))
            })
          ),
          destination_ids: v.optional(v.array(v.string())),
          config_values: v.optional(v.record(v.string()))
        })
      )
      .output(callbackPresenter)
      .do(async ctx => {
        let callback = await callbackService.upsertCallbackForIntegrationProvider({
          instance: ctx.instance,
          integrationProvider: ctx.integrationProvider,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            metadata: ctx.body.metadata,
            pollIntervalSecondsOverride: ctx.body.poll_interval_seconds_override,
            triggers: ctx.body.triggers.map(trigger => ({
              triggerId: trigger.trigger_id,
              eventTypes: trigger.event_types
            })),
            destinationIds: ctx.body.destination_ids,
            configValues: ctx.body.config_values
          }
        });

        return callbackPresenter.present({ callback });
      }),

    delete: integrationProviderCallbackGroup
      .delete(
        instancePath(
          'integration-providers/:integrationProviderId/callback',
          'integrations.providers.callback.delete'
        ),
        {
          name: 'Delete integration provider callback',
          description: 'Archives the callback owned by an integration provider.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:write'] }))
      .output(callbackPresenter)
      .do(async ctx => {
        let callback = await callbackService.getCallbackForIntegrationProvider({
          instance: ctx.instance,
          integrationProvider: ctx.integrationProvider
        });
        if (!callback) {
          throw new ServiceError(notFoundError('callback', ctx.integrationProvider.id));
        }
        let archived = await callbackService.archiveCallback({
          instance: ctx.instance,
          callback
        });
        return callbackPresenter.present({ callback: archived });
      }),

    getConfigSchema: integrationProviderCallbackGroup
      .get(
        instancePath(
          'integration-providers/:integrationProviderId/callback/config-schema',
          'integrations.providers.callback.getConfigSchema'
        ),
        {
          name: 'Get integration provider callback config schema',
          description: 'Returns the callback config schema for a proposed trigger selection.'
        }
      )
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .query(
        'default',
        v.object({
          trigger_ids: v.array(v.string())
        })
      )
      .output(callbackConfigSchemaPresenter)
      .do(async ctx => {
        let schema = await callbackService.getCallbackConfigSchemaForIntegrationProvider({
          instance: ctx.instance,
          integrationProvider: ctx.integrationProvider,
          triggerIds: ctx.query.trigger_ids
        });
        return callbackConfigSchemaPresenter.present(schema);
      })
  }
);
