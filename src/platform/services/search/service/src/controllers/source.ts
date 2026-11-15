import { v } from '@lowerdeck/validation';
import { sourcePresenter } from '../presenters';
import { sourceService } from '../services';
import { app } from './_app';

export let sourceApp = app.use(async ctx => {
  let sourceId = ctx.body.sourceId;
  if (!sourceId) throw new Error('Source ID is required');

  let source = await sourceService.getSourceById({ id: sourceId });

  return { source };
});

export let sourceController = app.controller({
  upsert: app
    .handler()
    .input(
      v.object({
        name: v.string(),
        identifier: v.string()
      })
    )
    .do(async ctx => {
      let source = await sourceService.upsertSource({
        input: {
          name: ctx.input.name,
          identifier: ctx.input.identifier
        }
      });
      return sourcePresenter(source);
    }),

  get: sourceApp
    .handler()
    .input(
      v.object({
        sourceId: v.string()
      })
    )
    .do(async ctx => sourcePresenter(ctx.source))
});
