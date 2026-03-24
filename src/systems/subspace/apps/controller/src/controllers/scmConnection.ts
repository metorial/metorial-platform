import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  scmConnectionPresenter,
  scmConnectionService
} from '@metorial-subspace/module-custom-provider';
import { actorService } from '@metorial-subspace/module-tenant';
import { app } from './_app';
import { tenantApp } from './tenant';

export let scmConnectionApp = tenantApp.use(async ctx => {
  let scmConnectionId = ctx.body.scmConnectionId;
  if (!scmConnectionId) throw new Error('ScmConnection ID is required');

  let scmConnection = await scmConnectionService.getScmConnectionById({
    scmConnectionId,
    tenant: ctx.tenant
  });

  return { scmConnection };
});

export let scmConnectionController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          actorId: v.string()
        })
      )
    )
    .do(async ctx => {
      let actor = await actorService.getActorById({
        tenant: ctx.tenant,
        id: ctx.input.actorId
      });

      let paginator = await scmConnectionService.listScmConnections({
        tenant: ctx.tenant,
        actor,
        ...ctx.input
      });

      return {
        ...paginator,
        items: paginator.items.map(item => scmConnectionPresenter(item))
      };
    }),

  get: scmConnectionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        scmConnectionId: v.string()
      })
    )
    .do(async ctx => scmConnectionPresenter(ctx.scmConnection))
});
