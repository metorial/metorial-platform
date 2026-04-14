import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { functionInvocationPresenter } from '../presenters';
import { functionInvocationService } from '../services';
import { app } from './_app';
import { functionApp } from './function';

export let functionInvocationApp = functionApp.use(async ctx => {
  let functionInvocationId = ctx.body.functionInvocationId;
  if (!functionInvocationId) throw new Error('Function Invocation ID is required');

  let invocation = await functionInvocationService.getFunctionInvocationById({
    id: functionInvocationId,
    function: ctx.function
  });

  return { invocation };
});

export let functionInvocationController = app.controller({
  list: functionApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          functionId: v.string(),
          tenantId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await functionInvocationService.listFunctionInvocations({
        function: ctx.function
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, functionInvocationPresenter);
    }),

  get: functionInvocationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        functionId: v.string(),
        functionInvocationId: v.string()
      })
    )
    .do(async ctx => functionInvocationPresenter(ctx.invocation))
});
