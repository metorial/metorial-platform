import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { chatTypingIndicatorType } from '../../types';

export let v1ChatTypingIndicatorPresenter = Presenter.create(chatTypingIndicatorType)
  .presenter(async ({ started }) => ({
    object: 'chat.typing_indicator' as const,
    started
  }))
  .schema(
    v.object({
      object: v.literal('chat.typing_indicator', {
        description: "String representing the object's type"
      }),

      started: v.boolean({
        name: 'started',
        description: 'Whether the typing indicator was shown'
      })
    })
  )
  .build();
