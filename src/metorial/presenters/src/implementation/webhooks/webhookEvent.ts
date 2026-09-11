import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { webhookEventType } from '../../types';

export let v1WebhookEventPresenter = Presenter.create(webhookEventType)
  .presenter(async ({ webhookEvent }) => ({
    object: 'event.type',
    name: webhookEvent.name
  }))
  .schema(
    v.object({
      object: v.literal('event.type', {
        description: "String representing the object's type"
      }),
      name: v.string({
        description: 'Event type used when configuring an event destination listener',
        examples: ['organization.created']
      })
    })
  )
  .build();
