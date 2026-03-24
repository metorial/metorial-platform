import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { sessionService, toolCallService } from '@metorial-subspace/module-session';
import { toolCallPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let toolCallApp = tenantApp.use(async ctx => {
  let toolCallId = ctx.body.toolCallId;
  if (!toolCallId) throw new Error('ToolCall ID is required');

  let toolCall = await toolCallService.getToolCallById({
    toolCallId,
    tenant: ctx.tenant,
    environment: ctx.environment,
    solution: ctx.solution,
    allowDeleted: ctx.body.allowDeleted
  });

  return { toolCall };
});

export let toolCallController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          status: v.optional(v.array(v.enumOf(['active', 'archived']))),
          allowDeleted: v.optional(v.boolean()),

          ids: v.optional(v.array(v.string())),
          sessionTemplateIds: v.optional(v.array(v.string())),
          sessionProviderIds: v.optional(v.array(v.string())),
          providerIds: v.optional(v.array(v.string())),
          providerDeploymentIds: v.optional(v.array(v.string())),
          providerConfigIds: v.optional(v.array(v.string())),
          providerAuthConfigIds: v.optional(v.array(v.string())),
          toolIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await toolCallService.listToolCalls({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        allowDeleted: ctx.input.allowDeleted,

        ids: ctx.input.ids,
        sessionTemplateIds: ctx.input.sessionTemplateIds,
        sessionProviderIds: ctx.input.sessionProviderIds,
        providerIds: ctx.input.providerIds,
        providerDeploymentIds: ctx.input.providerDeploymentIds,
        providerConfigIds: ctx.input.providerConfigIds,
        providerAuthConfigIds: ctx.input.providerAuthConfigIds,
        toolIds: ctx.input.toolIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, toolCallPresenter);
    }),

  get: toolCallApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        toolCallId: v.string(),
        allowDeleted: v.optional(v.boolean())
      })
    )
    .do(async ctx => toolCallPresenter(ctx.toolCall)),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),

        sessionId: v.string(),

        metadata: v.optional(v.record(v.any())),
        input: v.record(v.any()),
        toolId: v.string()
      })
    )
    .do(async ctx => {
      let session = await sessionService.getSessionById({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,
        sessionId: ctx.input.sessionId
      });

      let toolCall = await toolCallService.createToolCall({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        session,

        input: {
          metadata: ctx.input.metadata,
          input: ctx.input.input,
          toolId: ctx.input.toolId
        }
      });

      return toolCallPresenter(toolCall);
    })
});
