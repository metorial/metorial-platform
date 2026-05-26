import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { consumerPresenter } from '../presenters';
import { consumerService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let consumerInstanceApp = tenantApp.use(async ctx => {
  let token = ctx.body.consumerToken ?? ctx.body.token;
  try {
    let { consumer, consumerInstance } = await consumerService.authenticateConsumerInstanceToken({
      token: typeof token === 'string' ? token : ''
    });

    return { consumer, consumerInstance };
  } catch {
    throw new ServiceError(badRequestError({ message: 'Unable to use secret' }));
  }
});

export let consumerController = app.controller({
  register: app
    .handler()
    .input(
      v.object({
        secret: v.string(),
        identifier: v.string()
      })
    )
    .do(async ctx => {
      return await consumerService.registerConsumerInstance({
        secret: ctx.input.secret,
        identifier: ctx.input.identifier
      });
    }),

  refresh: app
    .handler()
    .input(
      v.object({
        secret: v.string(),
        token: v.string()
      })
    )
    .do(async ctx => {
      return await consumerService.refreshConsumerInstance({
        secret: ctx.input.secret,
        token: ctx.input.token
      });
    }),

  list: app
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let paginator = await consumerService.listConsumers();
      let list = await paginator.run(ctx.input);
      return Paginator.presentLight(list, consumerPresenter);
    }),

  get: app
    .handler()
    .input(
      v.object({
        consumerId: v.string()
      })
    )
    .do(async ctx => {
      let consumer = await consumerService.getConsumerById({ id: ctx.input.consumerId });
      return consumerPresenter(consumer);
    })
});
