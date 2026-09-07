import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { webhookEventService } from '@metorial-subspace/module-callback';
import { incomingWebhookPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { getRequiredParam, stringOrArray } from './_shared';

export let incomingWebhookController = Controller.create(
  {
    name: 'Incoming Webhooks',
    description:
      'The raw inbound HTTP requests behind your callback events. Useful for confirming a provider is actually delivering, including for requests that matched no trigger. You see every request received on your own webhook registrations, plus requests received on endpoints Metorial operates for a provider that produced a callback event of yours.'
  },
  {
    list: instanceGroup
      .get(instancePath('incoming-webhooks', 'incomingWebhooks.list'), {
        name: 'List incoming webhooks',
        description: 'Returns a paginated list of incoming webhooks you can see.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .outputList(incomingWebhookPresenter)
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

        return Paginator.present(await paginator.run(ctx.query), incomingWebhook =>
          incomingWebhookPresenter.present({ incomingWebhook })
        );
      }),

    get: instanceGroup
      .get(instancePath('incoming-webhooks/:incomingWebhookId', 'incomingWebhooks.get'), {
        name: 'Get incoming webhook',
        description: 'Retrieves a specific incoming webhook.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .output(incomingWebhookPresenter)
      .do(async ctx => {
        let incomingWebhook = await webhookEventService.getWebhookEvent({
          instance: ctx.instance,
          webhookEventId: getRequiredParam(ctx.params, 'incomingWebhookId')
        });

        return incomingWebhookPresenter.present({ incomingWebhook });
      })
  }
);
