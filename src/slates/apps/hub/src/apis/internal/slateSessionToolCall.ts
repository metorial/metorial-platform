import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  slateSessionToolCallLogsPresenter,
  slateSessionToolCallPresenter
} from '../../presenters';
import { slateSessionToolCallService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let slateSessionToolCallApp = tenantApp.use(async ctx => {
  let slateSessionToolCallId = ctx.body.slateSessionToolCallId;
  if (!slateSessionToolCallId) throw new Error('Slate SessionToolCall ID is required');

  let slateSessionToolCall = await slateSessionToolCallService.getSlateToolCallById({
    id: slateSessionToolCallId,
    tenant: ctx.tenant
  });

  return { slateSessionToolCall };
});

export let slateSessionToolCallController = app.controller({
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
      let paginator = await slateSessionToolCallService.listSlateToolCalls({
        tenant: ctx.tenant,
        slateIds: ctx.input.slateIds
      });

      let list = await paginator.run(ctx.input);

      return await Paginator.presentLight(list, slateSessionToolCallPresenter);
    }),

  call: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          sessionId: v.string(),
          toolId: v.string(),
          authConfigId: v.optional(v.string()),
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
    )
    .do(async ctx => {
      let res = await slateSessionToolCallService.createSlateToolCall({
        input: {
          tenantId: ctx.input.tenantId,
          sessionId: ctx.input.sessionId,
          toolId: ctx.input.toolId,
          authConfigId: ctx.input.authConfigId,
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

  get: slateSessionToolCallApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateSessionToolCallId: v.string()
      })
    )
    .do(async ctx => await slateSessionToolCallPresenter(ctx.slateSessionToolCall)),

  getLogs: slateSessionToolCallApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateSessionToolCallId: v.string()
      })
    )
    .do(async ctx => slateSessionToolCallLogsPresenter(ctx.slateSessionToolCall)),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        slateSessionToolCallIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let slateSessionToolCalls = await slateSessionToolCallService.getManySlateToolCallsByIds(
        {
          ids: ctx.input.slateSessionToolCallIds,
          tenant: ctx.tenant
        }
      );

      return await Promise.all(slateSessionToolCalls.map(slateSessionToolCallPresenter));
    })
});
