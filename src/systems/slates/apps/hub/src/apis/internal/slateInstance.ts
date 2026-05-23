import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { slateInstancePresenter } from '../../presenters';
import { slateInstanceService, slateService, slateVersionService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let slateInstanceApp = tenantApp.use(async ctx => {
  let slateInstanceId = ctx.body.slateInstanceId;
  if (!slateInstanceId) throw new Error('Slate Instance ID is required');

  let slateInstance = await slateInstanceService.getSlateInstanceById({
    id: slateInstanceId,
    tenant: ctx.tenant
  });

  return { slateInstance };
});

export let slateInstanceController = app.controller({
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
      let paginator = await slateInstanceService.listSlateInstances({
        tenant: ctx.tenant,
        slateIds: ctx.input.slateIds
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateInstancePresenter);
    }),

  create: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          slateId: v.string(),

          config: v.record(v.any()),
          lockedVersionId: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let slate = await slateService.getSlateById({
        id: ctx.input.slateId
      });

      let lockedVersion = ctx.input.lockedVersionId
        ? await slateVersionService.getSlateVersionById({
            id: ctx.input.lockedVersionId,
            slate
          })
        : undefined;

      let res = await slateInstanceService.createSlateInstance({
        tenant: ctx.tenant,
        slate,

        input: {
          lockedVersion,
          config: ctx.input.config
        }
      });

      return slateInstancePresenter(res);
    }),

  get: slateInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateInstanceId: v.string()
      })
    )
    .do(async ctx => slateInstancePresenter(ctx.slateInstance)),

  delete: slateInstanceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateInstanceId: v.string()
      })
    )
    .do(async ctx => {
      await slateInstanceService.deleteSlateInstance({
        tenant: ctx.tenant,
        slateInstance: ctx.slateInstance
      });

      return { success: true };
    }),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateInstanceIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let slateInstances = await slateInstanceService.getManySlateInstancesByIds({
        ids: ctx.input.slateInstanceIds,
        tenant: ctx.tenant
      });

      return slateInstances.map(slateInstancePresenter);
    })
});
