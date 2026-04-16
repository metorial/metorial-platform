import { v } from '@lowerdeck/validation';
import { slateInvocationPresenter } from '../../presenters';
import { slateInvocationService } from '../../services';
import { app } from './_app';

let slateInvocationApp = app.use(async ctx => {
  let slateInvocationId = ctx.body.slateInvocationId;
  if (!slateInvocationId) throw new Error('Slate Invocation ID is required');

  let slateInvocation = await slateInvocationService.DANGEROUSLY_getSlateInvocationById({
    id: slateInvocationId
  });

  return { slateInvocation };
});

export let slateInvocationController = app.controller({
  DANGEROUSLY_get: slateInvocationApp
    .handler()
    .input(
      v.object({
        slateInvocationId: v.string()
      })
    )
    .do(async ctx => await slateInvocationPresenter(ctx.slateInvocation))
});
