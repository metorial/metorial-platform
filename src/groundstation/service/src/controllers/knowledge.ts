import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  knowledgeAgentService,
  knowledgeChangeService,
  knowledgeFamilyService,
  knowledgeLabService,
  knowledgeModelService,
  knowledgeOfferingService,
  knowledgeOfferingSorts,
  knowledgePriceService,
  knowledgeResolutionService,
  knowledgeSnapshotService,
  knowledgeVendorService
} from '../knowledge/api';
import {
  acceptKnowledgeSnapshot,
  importKnowledgeSnapshot,
  syncKnowledge
} from '../knowledge/ingest';
import {
  knowledgeAgentPresenter,
  knowledgeChangePresenter,
  knowledgeFamilyDetailsPresenter,
  knowledgeFamilyPresenter,
  knowledgeLabPresenter,
  knowledgeModelDetailsPresenter,
  knowledgeModelPresenter,
  knowledgeOfferingPresenter,
  knowledgePriceAtPresenter,
  knowledgePricePeriodPresenter,
  knowledgeResolutionPresenter,
  knowledgeSnapshotPresenter,
  knowledgeVendorPresenter
} from '../presenters';
import { app } from './_app';
import { knowledgePriceCorrectionRoutes } from './knowledgeCorrections';

let maxArchiveBase64Length = 90 * 1024 * 1024;

let entities = [
  'organization',
  'family',
  'model',
  'release',
  'pointer',
  'vendor',
  'endpoint',
  'offering',
  'name',
  'agent'
] as const;

let changeTypes = ['added', 'changed', 'removed'] as const;

let snapshotStatuses = ['current', 'superseded', 'rejected'] as const;

let ids = () => v.optional(v.array(v.string()));

let includeRemoved = () => v.optional(v.boolean());

let modelRequestSchema = v.object({
  raw: v.string({ modifiers: [v.minLength(1), v.maxLength(500)] }),
  provider: v.optional(v.string()),
  agent: v.optional(v.string()),
  baseUrl: v.optional(v.string()),
  subscription: v.optional(v.boolean()),
  at: v.optional(v.date())
});

export let knowledgeController = app.controller({
  sync: app
    .handler()
    .input(v.object({}))
    .do(async () => await syncKnowledge()),

  resolve: app
    .handler()
    .input(modelRequestSchema)
    .do(async ctx =>
      knowledgeResolutionPresenter(await knowledgeResolutionService.resolve(ctx.input))
    ),

  labs: app.controller({
    list: app
      .handler()
      .input(
        Paginator.validate(v.object({ statuses: ids(), includeRemoved: includeRemoved() }))
      )
      .do(async ctx => {
        let paginator = await knowledgeLabService.listLabs({
          statuses: ctx.input.statuses,
          includeRemoved: ctx.input.includeRemoved
        });

        let list = await paginator.run(ctx.input);

        return Paginator.presentLight(list, knowledgeLabPresenter);
      }),

    get: app
      .handler()
      .input(v.object({ labId: v.string() }))
      .do(async ctx =>
        knowledgeLabPresenter(await knowledgeLabService.getLabById({ labId: ctx.input.labId }))
      )
  }),

  families: app.controller({
    list: app
      .handler()
      .input(
        Paginator.validate(
          v.object({
            labIds: ids(),
            kinds: ids(),
            statuses: ids(),
            includeRemoved: includeRemoved()
          })
        )
      )
      .do(async ctx => {
        let paginator = await knowledgeFamilyService.listFamilies({
          labIds: ctx.input.labIds,
          kinds: ctx.input.kinds,
          statuses: ctx.input.statuses,
          includeRemoved: ctx.input.includeRemoved
        });

        let list = await paginator.run(ctx.input);

        return Paginator.presentLight(list, knowledgeFamilyPresenter);
      }),

    get: app
      .handler()
      .input(v.object({ familyId: v.string() }))
      .do(async ctx =>
        knowledgeFamilyDetailsPresenter(
          await knowledgeFamilyService.getFamilyById({ familyId: ctx.input.familyId })
        )
      )
  }),

  models: app.controller({
    list: app
      .handler()
      .input(
        Paginator.validate(
          v.object({
            labIds: ids(),
            familyIds: ids(),
            kinds: ids(),
            statuses: ids(),
            openWeights: v.optional(v.boolean()),
            inputModalities: ids(),
            outputModalities: ids(),
            capabilities: ids(),
            minContextTokens: v.optional(v.number({ modifiers: [v.minValue(0)] })),
            search: v.optional(v.string({ modifiers: [v.maxLength(200)] })),
            includeRemoved: includeRemoved()
          })
        )
      )
      .do(async ctx => {
        let paginator = await knowledgeModelService.listModels({
          labIds: ctx.input.labIds,
          familyIds: ctx.input.familyIds,
          kinds: ctx.input.kinds,
          statuses: ctx.input.statuses,
          openWeights: ctx.input.openWeights,
          inputModalities: ctx.input.inputModalities,
          outputModalities: ctx.input.outputModalities,
          capabilities: ctx.input.capabilities,
          minContextTokens: ctx.input.minContextTokens,
          search: ctx.input.search,
          includeRemoved: ctx.input.includeRemoved
        });

        let list = await paginator.run(ctx.input);

        return Paginator.presentLight(list, knowledgeModelPresenter);
      }),

    get: app
      .handler()
      .input(v.object({ modelId: v.string() }))
      .do(async ctx =>
        knowledgeModelDetailsPresenter(
          await knowledgeModelService.getModelById({ modelId: ctx.input.modelId })
        )
      )
  }),

  vendors: app.controller({
    list: app
      .handler()
      .input(
        Paginator.validate(
          v.object({
            kinds: ids(),
            organizationIds: ids(),
            statuses: ids(),
            includeRemoved: includeRemoved()
          })
        )
      )
      .do(async ctx => {
        let paginator = await knowledgeVendorService.listVendors({
          kinds: ctx.input.kinds,
          organizationIds: ctx.input.organizationIds,
          statuses: ctx.input.statuses,
          includeRemoved: ctx.input.includeRemoved
        });

        let list = await paginator.run(ctx.input);

        return Paginator.presentLight(list, knowledgeVendorPresenter);
      }),

    get: app
      .handler()
      .input(v.object({ vendorId: v.string() }))
      .do(async ctx =>
        knowledgeVendorPresenter(
          await knowledgeVendorService.getVendorById({ vendorId: ctx.input.vendorId })
        )
      )
  }),

  offerings: app.controller({
    list: app
      .handler()
      .input(
        Paginator.validate(
          v.object({
            modelIds: ids(),
            familyIds: ids(),
            labIds: ids(),
            vendorIds: ids(),
            variantKeys: ids(),
            free: v.optional(v.boolean()),
            kinds: ids(),
            statuses: ids(),
            priced: v.optional(v.boolean()),
            includeRemoved: includeRemoved(),
            sort: v.optional(v.enumOf(knowledgeOfferingSorts))
          })
        )
      )
      .do(async ctx => {
        let paginator = await knowledgeOfferingService.listOfferings({
          modelIds: ctx.input.modelIds,
          familyIds: ctx.input.familyIds,
          labIds: ctx.input.labIds,
          vendorIds: ctx.input.vendorIds,
          variantKeys: ctx.input.variantKeys,
          free: ctx.input.free,
          kinds: ctx.input.kinds,
          statuses: ctx.input.statuses,
          priced: ctx.input.priced,
          includeRemoved: ctx.input.includeRemoved,
          sort: ctx.input.sort
        });

        let list = await paginator.run(ctx.input);

        return Paginator.presentLight(list, knowledgeOfferingPresenter);
      })
  }),

  agents: app.controller({
    list: app
      .handler()
      .input(
        Paginator.validate(
          v.object({
            makerIds: ids(),
            surfaces: ids(),
            vendorIds: ids(),
            openSource: v.optional(v.boolean()),
            statuses: ids(),
            includeRemoved: includeRemoved()
          })
        )
      )
      .do(async ctx => {
        let paginator = await knowledgeAgentService.listAgents({
          makerIds: ctx.input.makerIds,
          surfaces: ctx.input.surfaces,
          vendorIds: ctx.input.vendorIds,
          openSource: ctx.input.openSource,
          statuses: ctx.input.statuses,
          includeRemoved: ctx.input.includeRemoved
        });

        let list = await paginator.run(ctx.input);

        return Paginator.presentLight(list, knowledgeAgentPresenter);
      }),

    get: app
      .handler()
      .input(v.object({ agentId: v.string() }))
      .do(async ctx =>
        knowledgeAgentPresenter(
          await knowledgeAgentService.getAgentById({ agentId: ctx.input.agentId })
        )
      )
  }),

  prices: app.controller({
    history: app
      .handler()
      .input(
        Paginator.validate(
          v.object({
            offeringId: v.optional(v.string()),
            modelId: v.optional(v.string()),
            familyId: v.optional(v.string()),
            vendorId: v.optional(v.string()),
            from: v.optional(v.date()),
            to: v.optional(v.date())
          })
        )
      )
      .do(async ctx => {
        let paginator = await knowledgePriceService.listPriceHistory({
          offeringId: ctx.input.offeringId,
          modelId: ctx.input.modelId,
          familyId: ctx.input.familyId,
          vendorId: ctx.input.vendorId,
          from: ctx.input.from,
          to: ctx.input.to
        });

        let list = await paginator.run(ctx.input);

        return Paginator.presentLight(list, knowledgePricePeriodPresenter);
      }),

    at: app
      .handler()
      .input(
        v.union([
          v.object({ offeringId: v.string(), at: v.optional(v.date()) }),
          modelRequestSchema
        ])
      )
      .do(async ctx =>
        knowledgePriceAtPresenter(await knowledgeResolutionService.priceAt(ctx.input))
      ),

    ...knowledgePriceCorrectionRoutes
  }),

  changes: app.controller({
    list: app
      .handler()
      .input(
        Paginator.validate(
          v.object({
            entities: v.optional(v.array(v.enumOf(entities))),
            entityIds: ids(),
            changes: v.optional(v.array(v.enumOf(changeTypes))),
            snapshotId: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await knowledgeChangeService.listChanges({
          entities: ctx.input.entities,
          entityIds: ctx.input.entityIds,
          changes: ctx.input.changes,
          snapshotId: ctx.input.snapshotId
        });

        let list = await paginator.run(ctx.input);

        return Paginator.presentLight(list, knowledgeChangePresenter);
      })
  }),

  snapshots: app.controller({
    list: app
      .handler()
      .input(
        Paginator.validate(
          v.object({ statuses: v.optional(v.array(v.enumOf(snapshotStatuses))) })
        )
      )
      .do(async ctx => {
        let paginator = await knowledgeSnapshotService.listSnapshots({
          statuses: ctx.input.statuses
        });

        let list = await paginator.run(ctx.input);

        return Paginator.presentLight(list, knowledgeSnapshotPresenter);
      }),

    get: app
      .handler()
      .input(v.object({ snapshotId: v.string() }))
      .do(async ctx =>
        knowledgeSnapshotPresenter(
          await knowledgeSnapshotService.getSnapshotById({ snapshotId: ctx.input.snapshotId })
        )
      ),

    current: app
      .handler()
      .input(v.object({}))
      .do(async () => {
        let snapshot = await knowledgeSnapshotService.getCurrentSnapshot();

        return snapshot ? knowledgeSnapshotPresenter(snapshot) : null;
      }),

    accept: app
      .handler()
      .input(v.object({ snapshotId: v.string() }))
      .do(async ctx => await acceptKnowledgeSnapshot({ snapshotId: ctx.input.snapshotId })),

    import: app
      .handler()
      .input(
        v.object({
          archive: v.string({
            modifiers: [v.minLength(1), v.maxLength(maxArchiveBase64Length)]
          }),
          guardrails: v.optional(v.boolean())
        })
      )
      .do(
        async ctx =>
          await importKnowledgeSnapshot({
            archive: Buffer.from(ctx.input.archive, 'base64'),
            guardrails: ctx.input.guardrails
          })
      )
  })
});
