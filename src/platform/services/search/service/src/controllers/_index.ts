import { v } from '@lowerdeck/validation';
import { indexPresenter } from '../presenters';
import { indexService } from '../services';
import { app } from './_app';
import { sourceApp } from './source';

export let indexApp = sourceApp.use(async ctx => {
  let indexId = ctx.body.indexId;
  if (!indexId) throw new Error('Index ID is required');

  let index = await indexService.getIndexById({ id: indexId, source: ctx.source });

  return { index };
});

export let indexController = app.controller({
  upsert: sourceApp
    .handler()
    .input(
      v.object({
        sourceId: v.string(),

        name: v.string(),
        identifier: v.string()
      })
    )
    .do(async ctx => {
      let index = await indexService.upsertIndex({
        input: {
          source: ctx.source,

          name: ctx.input.name,
          identifier: ctx.input.identifier
        }
      });
      return indexPresenter(index);
    }),

  get: indexApp
    .handler()
    .input(
      v.object({
        sourceId: v.string(),
        indexId: v.string()
      })
    )
    .do(async ctx => indexPresenter(ctx.index))
});
