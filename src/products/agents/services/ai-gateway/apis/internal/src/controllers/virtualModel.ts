import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import type { Instance, Organization } from '@mtsrc/ai-gateway-db';
import {
  virtualModelService,
  virtualModelToolsService,
  type VirtualModelScope
} from '@mtsrc/ai-gateway-module-virtual-models';
import {
  requestMetadataSchema,
  virtualModelDefinitionSchema,
  virtualModelLimits
} from '@mtsrc/ai-gateway-spec';
import {
  virtualModelPresenter,
  virtualModelTemplatePresenter,
  virtualModelTestPresenter,
  virtualModelVersionPresenter
} from '../presenters/virtualModel';
import { app, instanceApp } from './_app';

let scopeIds = { organizationId: v.string(), instanceId: v.string() };

let slug = v.string({
  modifiers: [v.minLength(1), v.maxLength(virtualModelLimits.slugLength)]
});
let name = v.string({ modifiers: [v.minLength(1), v.maxLength(200)] });
let description = v.optional(v.nullable(v.string({ modifiers: [v.maxLength(2000)] })));

let dialects = ['openai_chat', 'anthropic_messages', 'open_responses'] as const;

let customerScope = (ctx: {
  organization: Organization;
  instance: Instance;
}): VirtualModelScope => ({
  organization: ctx.organization,
  instance: ctx.instance
});

let getVirtualModel = async (
  ctx: { organization: Organization; instance: Instance },
  virtualModelId: string
) =>
  await virtualModelService.getVirtualModelById({
    scope: customerScope(ctx),
    virtualModelId
  });

export let virtualModelController = app.controller({
  create: instanceApp
    .handler()
    .input(
      v.object({
        ...scopeIds,
        slug,
        name,
        description,
        definition: virtualModelDefinitionSchema
      })
    )
    .do(async ctx => {
      let { virtualModel, warnings } = await virtualModelService.createVirtualModel({
        scope: customerScope(ctx),
        input: ctx.input
      });

      return virtualModelPresenter(virtualModel, warnings);
    }),

  get: instanceApp
    .handler()
    .input(v.object({ ...scopeIds, virtualModelId: v.string() }))
    .do(async ctx =>
      virtualModelPresenter(await getVirtualModel(ctx, ctx.input.virtualModelId))
    ),

  list: instanceApp
    .handler()
    .input(Paginator.validate(v.object(scopeIds)))
    .do(async ctx => {
      let paginator = await virtualModelService.listVirtualModels({
        scope: customerScope(ctx)
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, virtualModel => virtualModelPresenter(virtualModel));
    }),

  update: instanceApp
    .handler()
    .input(
      v.object({
        ...scopeIds,
        virtualModelId: v.string(),
        name: v.optional(name),
        description,
        definition: v.optional(virtualModelDefinitionSchema)
      })
    )
    .do(async ctx => {
      let { virtualModel, warnings } = await virtualModelService.updateVirtualModel({
        scope: customerScope(ctx),
        virtualModel: await getVirtualModel(ctx, ctx.input.virtualModelId),
        input: ctx.input
      });

      return virtualModelPresenter(virtualModel, warnings);
    }),

  archive: instanceApp
    .handler()
    .input(v.object({ ...scopeIds, virtualModelId: v.string() }))
    .do(async ctx =>
      virtualModelPresenter(
        await virtualModelService.archiveVirtualModel({
          virtualModel: await getVirtualModel(ctx, ctx.input.virtualModelId)
        })
      )
    ),

  listVersions: instanceApp
    .handler()
    .input(Paginator.validate(v.object({ ...scopeIds, virtualModelId: v.string() })))
    .do(async ctx => {
      let paginator = await virtualModelService.listVersions({
        virtualModel: await getVirtualModel(ctx, ctx.input.virtualModelId)
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, virtualModelVersionPresenter);
    }),

  getVersion: instanceApp
    .handler()
    .input(v.object({ ...scopeIds, virtualModelId: v.string(), versionId: v.string() }))
    .do(async ctx =>
      virtualModelVersionPresenter(
        await virtualModelService.getVersion({
          virtualModel: await getVirtualModel(ctx, ctx.input.virtualModelId),
          versionId: ctx.input.versionId
        })
      )
    ),

  rollback: instanceApp
    .handler()
    .input(v.object({ ...scopeIds, virtualModelId: v.string(), versionId: v.string() }))
    .do(async ctx => {
      let { virtualModel, warnings } = await virtualModelService.rollbackVirtualModel({
        scope: customerScope(ctx),
        virtualModel: await getVirtualModel(ctx, ctx.input.virtualModelId),
        versionId: ctx.input.versionId
      });

      return virtualModelPresenter(virtualModel, warnings);
    }),

  listTemplates: instanceApp
    .handler()
    .input(v.object(scopeIds))
    .do(async () => ({
      items: virtualModelToolsService.listTemplates().map(virtualModelTemplatePresenter)
    })),

  createFromTemplate: instanceApp
    .handler()
    .input(
      v.object({
        ...scopeIds,
        templateSlug: v.string(),
        slug,
        name,
        description,
        models: v.record(v.string({ modifiers: [v.minLength(1), v.maxLength(200)] })),
        decisionConnectionId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let { virtualModel, warnings } = await virtualModelToolsService.createFromTemplate({
        scope: customerScope(ctx),
        input: ctx.input
      });

      return virtualModelPresenter(virtualModel, warnings);
    }),

  // Without a virtualModelId the definition is tested as an unsaved draft.
  test: instanceApp
    .handler()
    .input(
      v.object({
        ...scopeIds,
        virtualModelId: v.optional(v.string()),
        definition: v.optional(virtualModelDefinitionSchema),
        gatewayTokenId: v.optional(v.string()),
        dialect: v.enumOf(dialects),
        body: v.record(v.any()),
        metadata: v.optional(requestMetadataSchema)
      })
    )
    .do(async ctx =>
      virtualModelTestPresenter(
        await virtualModelToolsService.testRequest({
          scope: customerScope(ctx),
          virtualModel: ctx.input.virtualModelId
            ? await getVirtualModel(ctx, ctx.input.virtualModelId)
            : undefined,
          definition: ctx.input.definition,
          tokenId: ctx.input.gatewayTokenId,
          dialect: ctx.input.dialect,
          body: ctx.input.body,
          metadata: ctx.input.metadata
        })
      )
    ),

  replay: instanceApp
    .handler()
    .input(
      v.object({
        ...scopeIds,
        virtualModelId: v.string(),
        definition: v.optional(virtualModelDefinitionSchema),
        limit: v.optional(
          v.number({ modifiers: [v.integer(), v.minValue(1), v.maxValue(50)] })
        )
      })
    )
    .do(async ctx => ({
      object: 'ai_gateway#virtual_model_replay',
      ...(await virtualModelToolsService.replay({
        scope: customerScope(ctx),
        virtualModel: await getVirtualModel(ctx, ctx.input.virtualModelId),
        definition: ctx.input.definition,
        limit: ctx.input.limit
      }))
    })),

  insights: instanceApp
    .handler()
    .input(
      v.object({
        ...scopeIds,
        virtualModelId: v.string(),
        days: v.optional(
          v.number({ modifiers: [v.integer(), v.minValue(1), v.maxValue(90)] })
        ),
        baselineModel: v.optional(v.string())
      })
    )
    .do(async ctx => ({
      object: 'ai_gateway#virtual_model_insights',
      ...(await virtualModelToolsService.insights({
        scope: customerScope(ctx),
        virtualModel: await getVirtualModel(ctx, ctx.input.virtualModelId),
        days: ctx.input.days,
        baselineModel: ctx.input.baselineModel
      }))
    }))
});
