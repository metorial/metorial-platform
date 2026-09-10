import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { eventDestinationType } from '../../types';
import { v1EventDestinationListenerPresenter } from './eventDestinationListener';

export let v1EventDestinationPresenter = Presenter.create(eventDestinationType)
  .presenter(async ({ eventDestination, revealSecret }, opts) => ({
    object: 'event.destination',
    id: eventDestination.id,
    organization_id: eventDestination.organization.id,
    name: eventDestination.name,
    description: eventDestination.description ?? null,
    status: eventDestination.status,
    type: eventDestination.type,
    webhook: eventDestination.webhookDestination
      ? {
          url: eventDestination.webhookDestination.url,
          method: eventDestination.webhookDestination.method,
          // Never read from the DB row here — only ever the explicit `revealSecret` the caller
          // passes in, so list/get/update/archive can never leak it.
          signing_secret: revealSecret ?? null
        }
      : null,
    listeners: await Promise.all(
      eventDestination.listeners.map(listener =>
        v1EventDestinationListenerPresenter
          .present(
            {
              listener: { ...listener, eventDestination },
              instance: listener.instance
            },
            opts
          )
          .run()
      )
    ),
    created_at: eventDestination.createdAt,
    updated_at: eventDestination.updatedAt,
    archived_at: eventDestination.archivedAt ?? null
  }))
  .schema(
    v.object({
      object: v.literal('event.destination'),
      id: v.string({
        description: 'Unique identifier for the event destination',
        examples: ['evtd_1aBcDeFgHjKlMnPq']
      }),
      organization_id: v.string({
        description: 'The organization this event destination belongs to',
        examples: ['org_1aBcDeFgHjKlMnPq']
      }),
      name: v.string({
        description: 'Display name for the event destination',
        examples: ['Production webhook']
      }),
      description: v.nullable(
        v.string({
          description: 'Optional description of what this event destination is used for',
          examples: ['Delivers session and callback events to our internal event bus']
        })
      ),
      status: v.enumOf(['active', 'archived'], {
        description: 'Lifecycle status of the event destination'
      }),
      type: v.literal('webhook', {
        description:
          'The delivery mechanism used by this event destination. Only "webhook" is currently supported.'
      }),
      webhook: v.nullable(
        v.object(
          {
            url: v.string({
              description: 'URL that event deliveries are sent to via HTTP POST',
              modifiers: [v.url()],
              examples: ['https://example.com/webhooks/metorial']
            }),
            method: v.literal('POST', {
              description: 'HTTP method used to deliver events'
            }),
            signing_secret: v.nullable(
              v.string({
                description:
                  'Secret used to sign the `metorial-signature` header on every delivery, so you can verify a delivery actually came from Metorial. Only present in the response to the create and rotate-secret actions — never returned by list/get/update.',
                examples: ['whsec_1aBcDeFgHjKlMnPq']
              })
            )
          },
          { description: 'Webhook-specific settings, present when `type` is `webhook`' }
        )
      ),
      listeners: v.array(v1EventDestinationListenerPresenter.schema, {
        description: 'Listeners that deliver matching instance events to this destination'
      }),
      created_at: v.date({ description: 'When the event destination was created' }),
      updated_at: v.date({ description: 'When the event destination was last updated' }),
      archived_at: v.nullable(
        v.date({ description: 'When the event destination was archived' })
      )
    })
  )
  .build();
