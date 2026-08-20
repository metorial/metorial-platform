import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { callbackDestinationService } from '@metorial-subspace/module-callback';
import { callbackDestinationPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantWithoutEnvironmentApp } from './tenant';

export let callbackDestinationApp = tenantWithoutEnvironmentApp.use(async ctx => {
  let callbackDestinationId = ctx.body.callbackDestinationId;
  if (!callbackDestinationId) throw new Error('Callback destination ID is required');

  let callbackDestination = await callbackDestinationService.getCallbackDestinationById({
    tenant: ctx.tenant,
    solution: ctx.solution,
    callbackDestinationId
  });

  return { callbackDestination };
});

export let callbackDestinationController = app.controller({
  list: tenantWithoutEnvironmentApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          callbackIds: v.optional(v.array(v.string())),
          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await callbackDestinationService.listCallbackDestinations({
        tenant: ctx.tenant,
        solution: ctx.solution,
        callbackIds: ctx.input.callbackIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });
      let list = await paginator.run(ctx.input);
      let enriched = await callbackDestinationService.enrichCallbackDestinations({
        tenant: ctx.tenant,
        callbackDestinations: list.items
      });
      return Paginator.presentLight(
        {
          ...list,
          items: enriched
        },
        callbackDestination => callbackDestinationPresenter(callbackDestination)
      );
    }),

  get: callbackDestinationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackDestinationId: v.string()
      })
    )
    .do(async ctx =>
      callbackDestinationPresenter(
        await callbackDestinationService.enrichCallbackDestination({
          tenant: ctx.tenant,
          callbackDestination: ctx.callbackDestination
        })
      )
    ),

  create: tenantWithoutEnvironmentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        url: v.string()
      })
    )
    .do(async ctx => {
      let callbackDestination = await callbackDestinationService.createCallbackDestination({
        tenant: ctx.tenant,
        solution: ctx.solution,
        input: {
          name: ctx.input.name!,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          url: ctx.input.url!
        }
      });
      return callbackDestinationPresenter(
        await callbackDestinationService.enrichCallbackDestination({
          tenant: ctx.tenant,
          callbackDestination
        })
      );
    }),

  update: callbackDestinationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackDestinationId: v.string(),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        url: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let callbackDestination = await callbackDestinationService.updateCallbackDestination({
        tenant: ctx.tenant,
        solution: ctx.solution,
        callbackDestination: ctx.callbackDestination,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          metadata: ctx.input.metadata,
          url: ctx.input.url
        }
      });
      return callbackDestinationPresenter(
        await callbackDestinationService.enrichCallbackDestination({
          tenant: ctx.tenant,
          callbackDestination
        })
      );
    }),

  rotateSigningSecret: callbackDestinationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackDestinationId: v.string(),
        graceMs: v.optional(v.number())
      })
    )
    .do(
      async ctx =>
        await callbackDestinationService.rotateSigningSecret({
          tenant: ctx.tenant,
          callbackDestination: ctx.callbackDestination,
          graceMs: ctx.input.graceMs
        })
    ),

  revokeSigningSecret: callbackDestinationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackDestinationId: v.string(),
        secretId: v.string()
      })
    )
    .do(
      async ctx =>
        await callbackDestinationService.revokeSigningSecret({
          tenant: ctx.tenant,
          callbackDestination: ctx.callbackDestination,
          secretId: ctx.input.secretId
        })
    ),

  consumeSigningSecretReceipt: callbackDestinationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackDestinationId: v.string(),
        receiptId: v.string(),
        receiptToken: v.string()
      })
    )
    .do(
      async ctx =>
        await callbackDestinationService.consumeSigningSecretReceipt({
          tenant: ctx.tenant,
          callbackDestination: ctx.callbackDestination,
          receiptId: ctx.input.receiptId,
          receiptToken: ctx.input.receiptToken
        })
    ),

  archive: callbackDestinationApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        callbackDestinationId: v.string()
      })
    )
    .do(async ctx => {
      let callbackDestination = await callbackDestinationService.archiveCallbackDestination({
        tenant: ctx.tenant,
        solution: ctx.solution,
        callbackDestination: ctx.callbackDestination
      });
      return callbackDestinationPresenter(
        await callbackDestinationService.enrichCallbackDestination({
          tenant: ctx.tenant,
          callbackDestination
        })
      );
    })
});
