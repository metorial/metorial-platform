import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerPresenter } from '../presenters';
import { consumerService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let consumerApp = tenantApp.use(async ctx => {
  let consumerId = ctx.body.consumerId;
  if (!consumerId) throw new Error('Consumer ID is required');

  let consumer = await consumerService.getConsumerById({
    tenant: ctx.tenant,
    id: consumerId
  });

  return { consumer };
});

export let consumerController = app.controller({
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
      let consumer = await consumerService.upsertConsumer({
        tenant: ctx.tenant,
        input: {
          name: ctx.input.name,
          identifier: ctx.input.identifier
        }
      });
      return consumerPresenter(consumer);
    }),

  list: tenantApp
    .handler()
    .input(Paginator.validate(v.object({ tenantId: v.string() })))
    .do(async ctx => {
      let paginator = await consumerService.listConsumers({ tenant: ctx.tenant });
      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, consumerPresenter);
    }),

  get: consumerApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        consumerId: v.string()
      })
    )
    .do(async ctx => consumerPresenter(ctx.consumer))
});
