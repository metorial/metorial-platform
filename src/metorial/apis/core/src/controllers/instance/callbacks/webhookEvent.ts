import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { webhookEventService } from '@metorial-subspace/module-callback';
import { webhookEventPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { getRequiredParam, stringOrArray } from './_shared';

export let webhookEventController = Controller.create(
  {
    name: 'Webhook Events',
    description:
      'The raw inbound HTTP requests behind your callback events. Useful for confirming a provider is actually delivering, including for requests that matched no trigger. You see every request received on your own webhook registrations, plus requests received on endpoints Metorial operates for a provider that produced a callback event of yours.'
  },
  {
    list: instanceGroup
      .get(instancePath('webhook-events', 'webhookEvents.list'), {
        name: 'List webhook events',
        description: 'Returns a paginated list of webhook events you can see.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .outputList(webhookEventPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            webhook_registration_id: v.optional(stringOrArray(), {
              description: 'Filter by webhook registration ID(s)'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await webhookEventService.listWebhookEvents({
          instance: ctx.instance,
          webhookRegistrationIds: normalizeArrayParam(ctx.query.webhook_registration_id)
        });

        return Paginator.present(await paginator.run(ctx.query), webhookEvent =>
          webhookEventPresenter.present({ webhookEvent })
        );
      }),

    get: instanceGroup
      .get(instancePath('webhook-events/:webhookEventId', 'webhookEvents.get'), {
        name: 'Get webhook event',
        description: 'Retrieves a specific webhook event.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .output(webhookEventPresenter)
      .do(async ctx => {
        let webhookEvent = await webhookEventService.getWebhookEvent({
          instance: ctx.instance,
          webhookEventId: getRequiredParam(ctx.params, 'webhookEventId')
        });

        return webhookEventPresenter.present({ webhookEvent });
      })
  }
);
