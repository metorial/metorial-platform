import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackTriggerSelectionOptionListType } from '../../../types';
import { v1ProviderPreview } from '../provider/providerPreview';

export let v1CallbackTriggerSelectionOptionListPresenter = Presenter.create(
  callbackTriggerSelectionOptionListType
)
  .presenter(async ({ triggerSelectionOptions }) => ({
    object: 'list' as const,

    items: triggerSelectionOptions.options.map(option => ({
      object: 'callback.trigger_selection_option' as const,
      value: option.value,
      label: option.label,
      description: option.description ?? null
    })),

    source:
      triggerSelectionOptions.source === 'linked'
        ? ('linked_provider' as const)
        : ('callback' as const),

    linked_provider: triggerSelectionOptions.linkedProvider
      ? {
          object: 'callback.trigger_selection_linked_provider' as const,
          provider: v1ProviderPreview(triggerSelectionOptions.linkedProvider.provider),
          connection_status: triggerSelectionOptions.linkedProvider.connected
            ? ('connected' as const)
            : ('not_connected' as const)
        }
      : null,

    next_page_token: triggerSelectionOptions.nextPageToken
  }))
  .schema(
    v.object({
      object: v.literal('list', {
        description: "String representing the object's type"
      }),

      items: v.array(
        v.object(
          {
            object: v.literal('callback.trigger_selection_option', {
              description: "String representing the object's type"
            }),

            value: v.union([v.string(), v.number()], {
              name: 'value',
              description: 'Value to store in the trigger group selection for this field',
              examples: ['1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms']
            }),

            label: v.string({
              name: 'label',
              description: 'Display name of the option',
              examples: ['Customer Orders']
            }),

            description: v.nullable(
              v.string({
                name: 'description',
                description: 'Extra detail that tells similar options apart',
                examples: ['Last changed on March 3, 2026']
              })
            )
          },
          {
            name: 'trigger_selection_option',
            description: 'A value the connected account can pick for a selection field'
          }
        ),
        { name: 'items', description: 'Options on this page' }
      ),

      source: v.enumOf(['callback', 'linked_provider'], {
        name: 'source',
        description:
          "Which connection the options were listed with. `callback` means the callback's own connected account. `linked_provider` means a connection of the provider named in `linked_provider` for the same account; `linked_provider` is always set then."
      }),

      linked_provider: v.nullable(
        v.object(
          {
            object: v.literal('callback.trigger_selection_linked_provider', {
              description: "String representing the object's type"
            }),

            provider: v1ProviderPreview.schema,

            connection_status: v.enumOf(['connected', 'not_connected'], {
              name: 'connection_status',
              description:
                "Whether a connection of this provider for the same account was found. When `not_connected`, the options come from the callback's own connection and may be incomplete; connecting this provider with the same account lets the list show everything."
            })
          },
          {
            name: 'linked_provider',
            description:
              "Another provider whose list can supply this field's options. Null when the field has no linked provider that is available in this project; `source` is then always `callback`."
          }
        )
      ),

      next_page_token: v.nullable(
        v.string({
          name: 'next_page_token',
          description: 'Pass as `page_token` to get the next page. Null on the last page.'
        })
      )
    })
  )
  .build();
