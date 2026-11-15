import { v } from '@lowerdeck/validation';
import { userPasswordService } from '../../../services/userPassword';
import { internalApp } from '../_app';

let identity = { appId: v.string(), userId: v.string() };

let context = v.object({ ip: v.string(), ua: v.optional(v.nullable(v.string())) });

export let userPasswordController = internalApp.controller({
  get: internalApp
    .handler()
    .input(v.object(identity))
    .do(({ input }) => userPasswordService.get(input)),

  set: internalApp
    .handler()
    .input(
      v.object({
        ...identity,
        password: v.string({ modifiers: [v.maxLength(256)] }),
        context
      })
    )
    .do(({ input }) =>
      userPasswordService.set({
        ...input,
        context: { ...input.context, ua: input.context.ua ?? '' }
      })
    ),

  remove: internalApp
    .handler()
    .input(v.object({ ...identity, context }))
    .do(({ input }) =>
      userPasswordService.remove({
        ...input,
        context: { ...input.context, ua: input.context.ua ?? '' }
      })
    )
});
