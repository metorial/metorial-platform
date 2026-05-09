import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { storeParticipantPresenter } from '../presenters';
import { storeParticipantService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let storeParticipantApp = tenantApp.use(async ctx => {
  let storeParticipantId = ctx.body.storeParticipantId;
  if (!storeParticipantId) throw new Error('Store participant ID is required');

  let storeParticipant = await storeParticipantService.getStoreParticipantById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    storeParticipantId
  });

  return { storeParticipant };
});

export let storeParticipantController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          storeId: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let paginator = await storeParticipantService.listStoreParticipants({
        tenant: ctx.tenant,
        environment: ctx.environment,
        storeId: ctx.input.storeId
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, storeParticipantPresenter);
    }),

  get: storeParticipantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        storeParticipantId: v.string()
      })
    )
    .do(async ctx => storeParticipantPresenter(ctx.storeParticipant))
});
