import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { billingModes } from '@metorial/groundstation-spec';
import type { Organization } from '../../prisma/generated/client';
import { effectivePriceService, priceOverrideService } from '../pricing';
import { priceOverridePresenter, pricingEffectivePresenter } from '../presenters';
import { organizationApp } from './_app';
import { pricingInput } from './_pricing';

let targets = ['all', 'lab', 'family', 'model', 'offering', 'vendor', 'agent'] as const;

let kinds = ['multiplier', 'rates', 'included'] as const;

let nameSchema = v.string({ modifiers: [v.minLength(1), v.maxLength(200)] });

let reasonSchema = v.nullable(v.string({ modifiers: [v.maxLength(1000)] }));

let idSchema = v.string({ modifiers: [v.minLength(1), v.maxLength(500)] });

let prioritySchema = v.number({
  modifiers: [v.integer(), v.minValue(-1000), v.maxValue(1000)]
});

let billingModesSchema = v.array(v.enumOf(billingModes), {
  modifiers: [v.maxLength(billingModes.length)]
});

let effectiveScope = {
  organizationId: v.string(),
  projectId: v.optional(v.string()),
  vendorId: v.optional(v.string()),
  agent: v.optional(v.string()),
  billingMode: v.optional(v.enumOf(billingModes)),
  at: v.optional(v.date())
};

let loadOverride = (organization: Organization, priceOverrideId: string) =>
  priceOverrideService.getPriceOverrideById({ organization, priceOverrideId });

export let pricingController = organizationApp.controller({
  overrides: organizationApp.controller({
    create: organizationApp
      .handler()
      .input(
        v.object({
          organizationId: v.string(),

          name: nameSchema,
          reason: v.optional(reasonSchema),
          projectId: v.optional(v.nullable(v.string())),
          target: v.enumOf(targets),
          targetId: v.optional(v.nullable(idSchema)),
          vendorId: v.optional(v.nullable(idSchema)),
          billingModes: v.optional(billingModesSchema),
          kind: v.enumOf(kinds),
          multiplier: v.optional(v.nullable(v.number())),
          rates: v.optional(v.nullable(pricingInput)),
          priority: v.optional(prioritySchema),
          createdBy: v.optional(v.nullable(v.string({ modifiers: [v.maxLength(200)] }))),
          validFrom: v.optional(v.date()),
          validTo: v.optional(v.nullable(v.date()))
        })
      )
      .do(async ctx => {
        let override = await priceOverrideService.createPriceOverride({
          organization: ctx.organization,
          input: {
            name: ctx.input.name,
            reason: ctx.input.reason,
            projectId: ctx.input.projectId,
            target: ctx.input.target,
            targetId: ctx.input.targetId,
            vendorId: ctx.input.vendorId,
            billingModes: ctx.input.billingModes,
            kind: ctx.input.kind,
            multiplier: ctx.input.multiplier,
            rates: ctx.input.rates,
            priority: ctx.input.priority,
            createdBy: ctx.input.createdBy,
            validFrom: ctx.input.validFrom,
            validTo: ctx.input.validTo
          }
        });

        return priceOverridePresenter(override);
      }),

    update: organizationApp
      .handler()
      .input(
        v.object({
          organizationId: v.string(),
          priceOverrideId: v.string(),

          name: v.optional(nameSchema),
          reason: v.optional(reasonSchema),
          projectId: v.optional(v.nullable(v.string())),
          target: v.optional(v.enumOf(targets)),
          targetId: v.optional(v.nullable(idSchema)),
          vendorId: v.optional(v.nullable(idSchema)),
          billingModes: v.optional(billingModesSchema),
          kind: v.optional(v.enumOf(kinds)),
          multiplier: v.optional(v.nullable(v.number())),
          rates: v.optional(v.nullable(pricingInput)),
          priority: v.optional(prioritySchema),
          validFrom: v.optional(v.date()),
          validTo: v.optional(v.nullable(v.date()))
        })
      )
      .do(async ctx => {
        let override = await loadOverride(ctx.organization, ctx.input.priceOverrideId);

        override = await priceOverrideService.updatePriceOverride({
          organization: ctx.organization,
          priceOverride: override,
          input: {
            name: ctx.input.name,
            reason: ctx.input.reason,
            projectId: ctx.input.projectId,
            target: ctx.input.target,
            targetId: ctx.input.targetId,
            vendorId: ctx.input.vendorId,
            billingModes: ctx.input.billingModes,
            kind: ctx.input.kind,
            multiplier: ctx.input.multiplier,
            rates: ctx.input.rates,
            priority: ctx.input.priority,
            validFrom: ctx.input.validFrom,
            validTo: ctx.input.validTo
          }
        });

        return priceOverridePresenter(override);
      }),

    archive: organizationApp
      .handler()
      .input(v.object({ organizationId: v.string(), priceOverrideId: v.string() }))
      .do(async ctx => {
        let override = await loadOverride(ctx.organization, ctx.input.priceOverrideId);

        override = await priceOverrideService.archivePriceOverride({
          organization: ctx.organization,
          priceOverride: override
        });

        return priceOverridePresenter(override);
      }),

    get: organizationApp
      .handler()
      .input(v.object({ organizationId: v.string(), priceOverrideId: v.string() }))
      .do(async ctx =>
        priceOverridePresenter(await loadOverride(ctx.organization, ctx.input.priceOverrideId))
      ),

    list: organizationApp
      .handler()
      .input(
        Paginator.validate(
          v.object({
            organizationId: v.string(),

            projectIds: v.optional(v.array(v.string())),
            targets: v.optional(v.array(v.enumOf(targets))),
            targetIds: v.optional(v.array(v.string())),
            kinds: v.optional(v.array(v.enumOf(kinds))),
            includeArchived: v.optional(v.boolean())
          })
        )
      )
      .do(async ctx => {
        let paginator = await priceOverrideService.listPriceOverrides({
          organization: ctx.organization,
          projectIds: ctx.input.projectIds,
          targets: ctx.input.targets,
          targetIds: ctx.input.targetIds,
          kinds: ctx.input.kinds,
          includeArchived: ctx.input.includeArchived
        });

        let list = await paginator.run(ctx.input);

        return Paginator.presentLight(list, priceOverridePresenter);
      })
  }),

  effective: organizationApp
    .handler()
    .input(
      v.union([
        v.object({ ...effectiveScope, offeringId: v.string() }),
        v.object({ ...effectiveScope, modelId: v.string() }),
        v.object({
          ...effectiveScope,
          raw: v.string({ modifiers: [v.minLength(1), v.maxLength(500)] }),
          provider: v.optional(v.string()),
          baseUrl: v.optional(v.string()),
          subscription: v.optional(v.boolean())
        })
      ])
    )
    .do(async ctx => {
      let { organizationId, ...input } = ctx.input;

      return pricingEffectivePresenter(
        await effectivePriceService.getEffectivePrice({
          organization: ctx.organization,
          input
        })
      );
    })
});
