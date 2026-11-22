import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { webhookEventService } from '@metorial-subspace/module-callback';
import { incomingWebhookListPresenter, incomingWebhookPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { getRequiredParam, incomingWebhookStatusValidator, stringOrArray } from './_shared';

export let incomingWebhookController = Controller.create(
  {
    name: 'Incoming Webhooks',
    description:
      'An incoming webhook is a raw inbound HTTP request received for a provider. You see every request received on your own webhook registrations, plus requests received on endpoints Metorial operates for a provider when they produced one of your callback events.'
  },
  {
    list: instanceGroup
      .get(instancePath('incoming-webhooks', 'incomingWebhooks.list'), {
        name: 'List incoming webhooks',
        description: 'Returns a paginated list of incoming webhooks you can see.'
      })
      .use(checkAccess({ possibleScopes: ['instance.callback:read'] }))
      .outputList(incomingWebhookListPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            webhook_registration_id: v.optional(stringOrArray(), {
              description: 'Only return webhooks received on one of these registrations.'
            }),
            provider_id: v.optional(stringOrArray(), {
              description: 'Only return webhooks received for one of these providers.'
            }),
            status: v.optional(
              v.union([
                incomingWebhookStatusValidator,
                v.array(incomingWebhookStatusValidator)
              ]),
              { description: 'Only return webhooks with one of these statuses.' }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await webhookEventService.listWebhookEvents({
          instance: ctx.instance,
          webhookRegistrationIds: normalizeArrayParam(ctx.query.webhook_registration_id),
          providerIds: normalizeArrayParam(ctx.query.provider_id),
          statuses: normalizeArrayParam(ctx.query.status)
        });

        return Paginator.present(await paginator.run(ctx.query), incomingWebhook =>
          incomingWebhookListPresenter.present({ incomingWebhook })
        );
      }),

    get: instanceGroup
      .get(instancePath('incoming-webhooks/:incomingWebhookId', 'incomingWebhooks.get'), {
        name: 'Get incoming webhook',
        description: 'Retrieves an incoming webhook.'
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
