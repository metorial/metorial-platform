import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { chatCommandResponseType } from '../../types';
import { v1ChatMessagePresenter } from './message';

export let v1ChatCommandResponsePresenter = Presenter.create(chatCommandResponseType)
  .presenter(async ({ chatMessage }, opts) => ({
    object: 'chat.command_response' as const,
    message: chatMessage
      ? await v1ChatMessagePresenter.present({ chatMessage }, opts).run()
      : null
  }))
  .schema(
    v.object({
      object: v.literal('chat.command_response', {
        description: "String representing the object's type"
      }),

      message: v.nullable({
        ...v1ChatMessagePresenter.schema,
        name: 'message',
        description:
          'The response message, when the provider identifies it. Null when the provider accepts the response without returning the message, as Slack does.'
      })
    })
  )
  .build();
