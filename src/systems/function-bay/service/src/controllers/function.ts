import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { functionPresenter } from '../presenters/function';
import { functionService } from '../services';
import { functionInvocationService } from '../services/functionInvocation';
import { app } from './_app';
import { tenantApp } from './tenant';

export let functionApp = tenantApp.use(async ctx => {
  let functionId = ctx.body.functionId;
  if (!functionId) throw new Error('Function ID is required');

  let func = await functionService.getFunctionById({
    id: functionId,
    tenant: ctx.tenant
  });

  return { function: func };
});

export let functionController = app.controller({
  upsert: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),

        name: v.string(),
        identifier: v.string()
      })
    )
    .do(async ctx => {
      let func = await functionService.upsertFunction({
        tenant: ctx.tenant,
        input: {
          name: ctx.input.name,
          identifier: ctx.input.identifier
        }
      });
      return functionPresenter(func);
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await functionService.listFunctions({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, functionPresenter);
    }),

  get: functionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        functionId: v.string()
      })
    )
    .do(async ctx => functionPresenter(ctx.function)),

  update: functionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        functionId: v.string(),

        name: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let func = await functionService.updateFunction({
        function: ctx.function,
        input: {
          name: ctx.input.name
        }
      });

      return functionPresenter(func);
    }),

  invoke: app
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        functionId: v.string(),

        payload: v.record(v.any())
      })
    )
    .do(
      async ctx =>
        await functionInvocationService.invokeFunction({
          functionId: ctx.input.functionId,
          tenantId: ctx.input.tenantId,
          payload: ctx.input.payload
        })
    )
});
