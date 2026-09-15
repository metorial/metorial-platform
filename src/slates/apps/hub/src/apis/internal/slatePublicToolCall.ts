import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  slatePublicToolCallLogsPresenter,
  slatePublicToolCallPresenter
} from '../../presenters';
import { slatePublicToolCallService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let slatePublicToolCallApp = tenantApp.use(async ctx => {
  let slatePublicToolCallId = ctx.body.slatePublicToolCallId;
  if (!slatePublicToolCallId) throw new Error('Slate Public Tool Call ID is required');

  let slatePublicToolCall = await slatePublicToolCallService.getPublicToolCallById({
    id: slatePublicToolCallId,
    tenant: ctx.tenant
  });

  return { slatePublicToolCall };
});

export let slatePublicToolCallController = app.controller({
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
      let paginator = await slatePublicToolCallService.listPublicToolCalls({
        tenant: ctx.tenant,
        slateIds: ctx.input.slateIds
      });

      let list = await paginator.run(ctx.input);

      return await Paginator.presentLight(list, slatePublicToolCallPresenter);
    }),

  call: app
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateId: v.string(),
        slateVersionId: v.optional(v.string()),
        toolId: v.string(),
        enclaveId: v.optional(v.string()),
        egressPolicy: v.optional(
          v.object({
            direction: v.literal('egress'),
            entries: v.array(
              v.object({
                cidr: v.string(),
                portRange: v.optional(
                  v.object({
                    from: v.number(),
                    to: v.number()
                  })
                )
              })
            )
          })
        ),
        input: v.record(v.any()),
        participants: v.array(
          v.object({
            type: v.enumOf(['consumer', 'hub']),
            id: v.string(),
            name: v.string(),
            description: v.optional(v.string()),
            metadata: v.optional(v.record(v.any()))
          })
        ),
        downloadUrlAttachments: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let res = await slatePublicToolCallService.createPublicToolCall({
        input: {
          tenantId: ctx.input.tenantId,
          slateId: ctx.input.slateId,
          slateVersionId: ctx.input.slateVersionId,
          toolId: ctx.input.toolId,
          enclaveId: ctx.input.enclaveId,
          egressPolicy: ctx.input.egressPolicy,
          input: ctx.input.input,
          participants: ctx.input.participants,
          downloadUrlAttachments: ctx.input.downloadUrlAttachments
        }
      });

      return {
        ...res,
        call: undefined,
        toolCallId: res.call.id,
        invocationId: res.invocationId
      };
    }),

  get: slatePublicToolCallApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slatePublicToolCallId: v.string()
      })
    )
    .do(async ctx => await slatePublicToolCallPresenter(ctx.slatePublicToolCall)),

  getLogs: slatePublicToolCallApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slatePublicToolCallId: v.string()
      })
    )
    .do(async ctx => slatePublicToolCallLogsPresenter(ctx.slatePublicToolCall)),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slatePublicToolCallIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let slatePublicToolCalls = await slatePublicToolCallService.getManyPublicToolCallsByIds({
        ids: ctx.input.slatePublicToolCallIds,
        tenant: ctx.tenant
      });

      return await Promise.all(slatePublicToolCalls.map(slatePublicToolCallPresenter));
    })
});
