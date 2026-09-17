import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { chatReactionListType } from '../../types';
import { presentReactions, reactionCountSchema } from './message';

export let v1ChatReactionListPresenter = Presenter.create(chatReactionListType)
  .presenter(async ({ reactions }) => ({
    object: 'chat.reaction_list' as const,
    reactions: await presentReactions(reactions)
  }))
  .schema(
    v.object({
      object: v.literal('chat.reaction_list', {
        description: "String representing the object's type"
      }),

      reactions: v.array(reactionCountSchema, {
        name: 'reactions',
        description: 'Reactions left on the message, as reported by the provider'
      })
    })
  )
  .build();
