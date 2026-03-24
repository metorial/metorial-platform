import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { slateTriggerDestinationPresenter } from '../../presenters';
import { slateTriggerDestinationService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let slateTriggerDestinationApp = tenantApp.use(async ctx => {
  let slateTriggerDestinationId = ctx.body.slateTriggerDestinationId;
  if (!slateTriggerDestinationId) throw new Error('Trigger destination ID is required');

  let destination = await slateTriggerDestinationService.getTriggerDestinationById({
    tenant: ctx.tenant,
    id: slateTriggerDestinationId
  });

  return { destination };
});

export let slateTriggerDestinationController = app.controller({
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
      let paginator = await slateTriggerDestinationService.listTriggerDestinations({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateTriggerDestinationPresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          name: v.string(),
          description: v.optional(v.string()),
          url: v.string(),
          method: v.optional(v.enumOf(['POST', 'PUT', 'PATCH'])),
          eventTypes: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let destination = await slateTriggerDestinationService.createTriggerDestination({
        tenant: ctx.tenant,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          url: ctx.input.url,
          method: ctx.input.method,
          eventTypes: ctx.input.eventTypes
        }
      });

      return slateTriggerDestinationPresenter(destination);
    }),

  get: slateTriggerDestinationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateTriggerDestinationId: v.string()
      })
    )
    .do(async ctx => slateTriggerDestinationPresenter(ctx.destination)),

  update: slateTriggerDestinationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateTriggerDestinationId: v.string(),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        url: v.optional(v.string()),
        method: v.optional(v.enumOf(['POST', 'PUT', 'PATCH'])),
        eventTypes: v.optional(v.array(v.string()))
      })
    )
    .do(async ctx => {
      let destination = await slateTriggerDestinationService.updateTriggerDestination({
        tenant: ctx.tenant,
        destination: ctx.destination,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          url: ctx.input.url,
          method: ctx.input.method,
          eventTypes: ctx.input.eventTypes
        }
      });

      return slateTriggerDestinationPresenter(destination);
    }),

  delete: slateTriggerDestinationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateTriggerDestinationId: v.string()
      })
    )
    .do(async ctx => {
      let destination = await slateTriggerDestinationService.deleteTriggerDestination({
        tenant: ctx.tenant,
        destination: ctx.destination
      });

      return slateTriggerDestinationPresenter(destination);
    }),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateTriggerDestinationIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let destinations = await Promise.all(
        ctx.input.slateTriggerDestinationIds.map(id =>
          slateTriggerDestinationService.getTriggerDestinationById({
            tenant: ctx.tenant,
            id
          })
        )
      );

      return destinations.map(slateTriggerDestinationPresenter);
    })
});
