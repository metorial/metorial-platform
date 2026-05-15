import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { storeParticipantPresenter } from '../presenters';
import { storeParticipantService } from '@metorial-cargo/module-store';
import { app } from './_app';
import { dateFilterSchema } from './_dateFilter';
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
          storeParticipantIds: v.optional(v.array(v.string())),
          storeId: v.optional(v.string()),
          storeIds: v.optional(v.array(v.string())),
          actorIds: v.optional(v.array(v.string())),
          createdAt: dateFilterSchema
        })
      )
    )
    .do(async ctx => {
      let paginator = await storeParticipantService.listStoreParticipants({
        tenant: ctx.tenant,
        environment: ctx.environment,
        ids: ctx.input.storeParticipantIds,
        storeId: ctx.input.storeId,
        storeIds: ctx.input.storeIds,
        actorIds: ctx.input.actorIds,
        createdAt: ctx.input.createdAt
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
