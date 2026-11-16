import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { callbackTriggerSelectionOptionType } from '../../../types';

export let v1CallbackTriggerSelectionOptionPresenter = Presenter.create(
  callbackTriggerSelectionOptionType
)
  .presenter(async ({ triggerSelectionOption }) => ({
    object: 'callback.trigger_selection_option' as const,

    value: triggerSelectionOption.value,
    label: triggerSelectionOption.label,
    description: triggerSelectionOption.description ?? null
  }))
  .schema(
    v.object({
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
    })
  )
  .build();
