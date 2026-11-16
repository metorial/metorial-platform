import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { functionVersionPresenter } from '../presenters';
import { functionVersionService } from '../services';
import { app } from './_app';
import { functionApp } from './function';

export let functionVersionApp = functionApp.use(async ctx => {
  let functionVersionId = ctx.body.functionVersionId;
  if (!functionVersionId) throw new Error('Function Version ID is required');

  let version = await functionVersionService.getFunctionVersionById({
    id: functionVersionId,
    function: ctx.function
  });

  return { version };
});

export let functionVersionController = app.controller({
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
      let paginator = await functionVersionService.listFunctionVersions({
        function: ctx.function
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, functionVersionPresenter);
    }),

  get: functionVersionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        functionId: v.string(),
        functionVersionId: v.string()
      })
    )
    .do(async ctx => functionVersionPresenter(ctx.version))
});
