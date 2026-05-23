import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { registryPresenter } from '../../presenters';
import { registryService } from '../../services';
import { app } from './_app';

export let registryApp = app.use(async ctx => {
  let registryId = ctx.body.registryId;
  if (!registryId) throw new Error('Slate Registry ID is required');

  let registry = await registryService.getRegistryById({
    id: registryId
  });

  return { registry };
});

export let registryController = app.controller({
  list: app
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let paginator = await registryService.listRegistries({});

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, registryPresenter);
    }),

  get: registryApp
    .handler()
    .input(
      v.object({
        registryId: v.string()
      })
    )
    .do(async ctx => registryPresenter(ctx.registry)),

  listAll: app
    .handler()
    .input(v.object({}))
    .do(async _ctx => {
      let res = await registryService.listAllRegistries({});

      return res.map(registryPresenter);
    }),

  getMany: app
    .handler()
    .input(
      v.object({
        registryIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let registries = await registryService.getManyRegistriesByIds({
        ids: ctx.input.registryIds
      });

      return registries.map(registryPresenter);
    }),

  create: app
    .handler()
    .input(
      v.object({
        registryUrl: v.string(),
        name: v.optional(v.string())
      })
    )
    .do(async ctx => {
      await registryService.createRegistry({
        registryUrl: ctx.input.registryUrl,
        name: ctx.input.name
      });
    })
});
