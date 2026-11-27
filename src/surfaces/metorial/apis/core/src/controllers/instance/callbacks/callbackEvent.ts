import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackEventService } from '@metorial-subspace/module-callback';
import { callbackEventListPresenter, callbackEventPresenter } from '@metorial/presenters';
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
      'A callback event is recorded every time a provider trigger behind one of your callbacks fires.'
  },
  {
    list: instanceGroup
      .get(instancePath('callback-events', 'callbackEvents.list'), {
        name: 'List callback events',
        description: 'Returns a paginated list of callback events.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .outputList(callbackEventListPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            callback_id: v.optional(stringOrArray(), {
              description: 'Only return events for one of these callbacks.'
            }),
            callback_instance_id: v.optional(stringOrArray(), {
              description: 'Only return events for one of these callback instances.'
            }),
            integration_id: v.optional(stringOrArray(), {
              description: 'Only return events for callbacks belonging to one of these integrations.'
            }),
            integration_provider_id: v.optional(stringOrArray(), {
              description:
                'Only return events for callbacks belonging to one of these integration providers.'
            }),
            provider_id: v.optional(stringOrArray(), {
              description: 'Only return events for callbacks belonging to one of these providers.'
            }),
            provider_trigger_key: v.optional(stringOrArray(), {
              description: 'Only return events produced by one of these provider triggers.'
            }),
            status: v.optional(
              v.union([callbackEventStatusValidator, v.array(callbackEventStatusValidator)]),
              { description: 'Only return events with one of these statuses.' }
            ),
            source: v.optional(
              v.union([callbackEventSourceValidator, v.array(callbackEventSourceValidator)]),
              { description: 'Only return events from one of these sources.' }
            ),
            occurred_at: dateFilterValidator('provider event time'),
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
          callbackEventListPresenter.present({ callbackEvent })
        );
      }),

    get: instanceGroup
      .get(instancePath('callback-events/:callbackEventId', 'callbackEvents.get'), {
        name: 'Get callback event',
        description:
          'Retrieves a callback event, with the payload the provider produced and the inbound webhook behind it when there is one. The inbound request is `null` once it is past its retention period.'
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
