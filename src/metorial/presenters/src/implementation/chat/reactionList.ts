import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { chatReactionListType } from '../../types';

export let v1ChatReactionListPresenter = Presenter.create(chatReactionListType)
  .presenter(async ({ reactions }) => ({
    object: 'chat.reaction_list' as const,
    reactions
  }))
  .schema(
    v.object({
      object: v.literal('chat.reaction_list', {
        description: "String representing the object's type"
      }),

      reactions: v.array(
        v.record(v.any(), {
          name: 'reactions',
          description: 'A reaction left on the message'
        }),
        {
          name: 'reactions',
          description: 'Reactions left on the message, as reported by the provider',
          examples: [[{ emoji: { name: 'tada' }, count: 3 }]]
        }
      )
    })
  )
  .build();
