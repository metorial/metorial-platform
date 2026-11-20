import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { catalogService, catalogSyncService } from '@mtsrc/ai-gateway-module-catalog';
import { routeService } from '@mtsrc/ai-gateway-module-routing';
import {
  catalogSyncPresenter,
  labPresenter,
  modelPresenter,
  offeringPresenter,
  providerPresenter
} from '../presenters/catalog';
import { app } from './_app';

export let catalogController = app.controller({
  listLabs: app
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let list = await (await catalogService.listLabs()).run(ctx.input);

      return Paginator.presentLight(list, labPresenter);
    }),

  listProviders: app
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let list = await (await catalogService.listProviders()).run(ctx.input);

      return Paginator.presentLight(list, providerPresenter);
    }),

  listModels: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          labSlug: v.optional(v.string()),
          kind: v.optional(v.string()),
          search: v.optional(v.string({ modifiers: [v.maxLength(200)] }))
        })
      )
    )
    .do(async ctx => {
      let paginator = await catalogService.listModels({
        labSlug: ctx.input.labSlug,
        kind: ctx.input.kind,
        search: ctx.input.search
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, modelPresenter);
    }),

  getModel: app
    .handler()
    .input(v.object({ modelId: v.string() }))
    .do(async ctx => modelPresenter(await catalogService.getModel(ctx.input))),

  listOfferings: app
    .handler()
    .input(
      Paginator.validate(
        v.object({ modelId: v.optional(v.string()), providerSlug: v.optional(v.string()) })
      )
    )
    .do(async ctx => {
      let paginator = await catalogService.listOfferings({
        modelId: ctx.input.modelId,
        providerSlug: ctx.input.providerSlug
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, offeringPresenter);
    }),

  resolveModel: app
    .handler()
    .input(v.object({ model: v.string({ modifiers: [v.minLength(1)] }) }))
    .do(async ctx => {
      let resolved = await routeService.resolveModel({ model: ctx.input.model });
      let model = await catalogService.getModel({ modelId: resolved.model.slug });

      return {
        object: 'ai_gateway#model_resolution',
        requested: ctx.input.model,
        request: resolved.request,
        via: resolved.via,
        model: modelPresenter(model)
      };
    }),

  getSyncStatus: app
    .handler()
    .input(v.object({}))
    .do(async () => catalogSyncPresenter(await catalogSyncService.getStatus())),

  requestSync: app
    .handler()
    .input(v.object({}))
    .do(async () => {
      await catalogSyncService.requestSync();

      return { requested: true };
    })
});
