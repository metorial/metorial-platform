import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackEventService } from '@metorial-subspace/module-callback';
import { callbackEventPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import {
  callbackEventSourceValidator,
  callbackEventStatusValidator,
  getRequiredParam,
  stringOrArray
} from './_shared';

export let callbackEventController = Controller.create(
  {
    name: 'Callback Events',
    description:
      'A callback event is recorded every time a provider trigger behind one of your callbacks fires. Listing returns the events themselves; fetch a single event to enrich it with the payload the provider produced, and the inbound webhook behind it, if any.'
  },
  {
    list: instanceGroup
      .get(instancePath('callback-events', 'callbackEvents.list'), {
        name: 'List callback events',
        description: 'Returns a paginated list of callback events.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .outputList(callbackEventPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            callback_id: v.optional(stringOrArray(), {
              description: 'Filter by callback ID(s)'
            }),
            callback_instance_id: v.optional(stringOrArray(), {
              description: 'Filter by callback instance ID(s)'
            }),
            integration_id: v.optional(stringOrArray(), {
              description: 'Filter by the integration the callback belongs to'
            }),
            integration_provider_id: v.optional(stringOrArray(), {
              description: 'Filter by the integration provider the callback belongs to'
            }),
            provider_id: v.optional(stringOrArray(), {
              description: 'Filter by the provider the callback belongs to'
            }),
            provider_trigger_key: v.optional(stringOrArray(), {
              description: 'Filter by the provider trigger key that produced the event'
            }),
            status: v.optional(
              v.union([callbackEventStatusValidator, v.array(callbackEventStatusValidator)]),
              { description: 'Filter by callback event processing status' }
            ),
            source: v.optional(
              v.union([callbackEventSourceValidator, v.array(callbackEventSourceValidator)]),
              { description: 'Filter by callback event source' }
            ),
            occurred_at: dateFilterValidator('when the underlying provider event occurred'),
            created_at: dateFilterValidator('callback event creation time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await callbackEventService.listCallbackEvents({
          instance: ctx.instance,
          callbackIds: normalizeArrayParam(ctx.query.callback_id),
          callbackInstanceIds: normalizeArrayParam(ctx.query.callback_instance_id),
          integrationIds: normalizeArrayParam(ctx.query.integration_id),
          integrationProviderIds: normalizeArrayParam(ctx.query.integration_provider_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          providerTriggerKeys: normalizeArrayParam(ctx.query.provider_trigger_key),
          status: normalizeArrayParam(ctx.query.status),
          source: normalizeArrayParam(ctx.query.source),
          occurredAt: ctx.query.occurred_at,
          createdAt: ctx.query.created_at
        });

        return Paginator.present(await paginator.run(ctx.query), callbackEvent =>
          callbackEventPresenter.present({ callbackEvent })
        );
      }),

    get: instanceGroup
      .get(instancePath('callback-events/:callbackEventId', 'callbackEvents.get'), {
        name: 'Get callback event',
        description:
          'Retrieves a specific callback event by ID, enriched with the payload the provider produced for it and, if it came from a webhook, the inbound request behind it.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .output(callbackEventPresenter)
      .do(async ctx => {
        let callbackEvent = await callbackEventService.getCallbackEventById({
          instance: ctx.instance,
          callbackEventId: getRequiredParam(ctx.params, 'callbackEventId')
        });

        return callbackEventPresenter.present({
          callbackEvent,
          details: callbackEvent.details
        });
      })
  }
);
