import { v } from '@lowerdeck/validation';
import { functionServerInvocationPresenter } from '../../presenters';
import { functionServerInvocationService } from '../../services';
import { app } from './_app';

export let functionServerInvocationApp = app.use(async ctx => {
  let functionInvocationId = ctx.body.functionInvocationId;
  if (!functionInvocationId) throw new Error('functionInvocationId is required');

  let functionServerInvocation =
    await functionServerInvocationService.getFunctionServerInvocationById({
      functionInvocationId
    });

  return { functionServerInvocation };
});

export let functionServerInvocationController = app.controller({
  list: app
    .handler()
    .input(
      v.object({
        functionInvocationIds: v.optional(v.array(v.string())),
        serverConnectionIds: v.optional(v.array(v.string())),
        isError: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let list = await functionServerInvocationService.listFunctionServerInvocations({
        functionInvocationIds: ctx.input.functionInvocationIds,
        serverConnectionIds: ctx.input.serverConnectionIds,
        isError: ctx.input.isError
      });

      return Promise.all(list.map(functionServerInvocationPresenter));
    }),

  get: functionServerInvocationApp
    .handler()
    .input(
      v.object({
        functionInvocationId: v.string()
      })
    )
    .do(async ctx => functionServerInvocationPresenter(ctx.functionServerInvocation)),

  getLogs: functionServerInvocationApp
    .handler()
    .input(
      v.object({
        functionInvocationId: v.string()
      })
    )
    .do(async ctx =>
      functionServerInvocationService.getFunctionServerInvocationLogs({
        functionServerInvocation: ctx.functionServerInvocation
      })
    )
});
