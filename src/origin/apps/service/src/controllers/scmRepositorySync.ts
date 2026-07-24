import { v } from '@lowerdeck/validation';
import { scmRepositorySyncPresenter } from '../presenters';
import { scmRepositorySyncService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let scmRepositorySyncController = app.controller({
  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        scmRepositorySyncIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let syncs = await scmRepositorySyncService.getManyScmRepositorySyncsByIds({
        tenant: ctx.tenant,
        ids: ctx.input.scmRepositorySyncIds
      });

      return {
        syncs: syncs.map(scmRepositorySyncPresenter)
      };
    }),

  checkStatus: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        scmRepositorySyncId: v.string()
      })
    )
    .do(async ctx => {
      let sync = await scmRepositorySyncService.checkScmRepositorySyncStatus({
        tenant: ctx.tenant,
        id: ctx.input.scmRepositorySyncId
      });
      return scmRepositorySyncPresenter(sync);
    })
});
