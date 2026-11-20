import { v } from '@lowerdeck/validation';
import { inferenceLogService } from '@mtsrc/ai-gateway-module-logs';
import { inferenceLogPresenter } from '../presenters/inferenceLog';
import { app, organizationApp } from './_app';

export let inferenceLogController = app.controller({
  list: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        instanceId: v.optional(v.string()),
        gatewayTokenId: v.optional(v.string()),
        consumerRef: v.optional(v.string()),
        modelSlug: v.optional(v.string()),
        status: v.optional(v.enumOf(['succeeded', 'failed', 'cancelled'])),
        before: v.optional(v.string()),
        limit: v.optional(
          v.number({ modifiers: [v.integer(), v.minValue(1), v.maxValue(100)] })
        )
      })
    )
    .do(async ctx => {
      let page = await inferenceLogService.listLogs({
        organizationId: ctx.organization.id,
        instanceId: ctx.input.instanceId,
        tokenId: ctx.input.gatewayTokenId,
        consumerRef: ctx.input.consumerRef,
        modelSlug: ctx.input.modelSlug,
        status: ctx.input.status,
        before: ctx.input.before,
        limit: ctx.input.limit
      });

      return {
        items: page.items.map(log => inferenceLogPresenter(log)),
        hasMore: page.hasMore,
        nextCursor: page.nextCursor
      };
    }),

  get: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        inferenceLogId: v.string(),
        includeContent: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let { log, content } = await inferenceLogService.getLog({
        organizationId: ctx.organization.id,
        logId: ctx.input.inferenceLogId,
        includeContent: ctx.input.includeContent
      });

      return inferenceLogPresenter(log, ctx.input.includeContent ? content : undefined);
    })
});
