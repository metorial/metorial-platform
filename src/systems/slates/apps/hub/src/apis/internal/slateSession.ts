import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { slateSessionPresenter } from '../../presenters';
import {
  slateInstanceService,
  slateService,
  slateSessionService,
  slateVersionService
} from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let slateSessionApp = tenantApp.use(async ctx => {
  let slateSessionId = ctx.body.slateSessionId;
  if (!slateSessionId) throw new Error('Slate Session ID is required');

  let slateSession = await slateSessionService.getSlateSessionById({
    id: slateSessionId,
    tenant: ctx.tenant
  });

  return { slateSession };
});

export let slateSessionController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          slateIds: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateSessionService.listSlateSessions({
        tenant: ctx.tenant,
        slateIds: ctx.input.slateIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateSessionPresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          slateId: v.string(),
          slateInstanceId: v.string(),
          lockedSlateVersion: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let slate = await slateService.getSlateById({
        id: ctx.input.slateId
      });
      let slateInstance = await slateInstanceService.getSlateInstanceById({
        id: ctx.input.slateInstanceId,
        tenant: ctx.tenant
      });
      let lockedVersion = ctx.input.lockedSlateVersion
        ? await slateVersionService.getSlateVersionById({
            slate,
            id: ctx.input.lockedSlateVersion
          })
        : undefined;

      let res = await slateSessionService.createSlateSession({
        tenant: ctx.tenant,

        input: {
          slate,
          slateInstance,
          lockedVersion
        }
      });

      return slateSessionPresenter(res);
    }),

  get: slateSessionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateSessionId: v.string()
      })
    )
    .do(async ctx => slateSessionPresenter(ctx.slateSession)),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateSessionIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let list = await slateSessionService.getManySlateSessionsByIds({
        ids: ctx.input.slateSessionIds,
        tenant: ctx.tenant
      });

      return list.map(slateSessionPresenter);
    })
});
