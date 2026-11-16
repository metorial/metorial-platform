import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { BillingMode } from '@mtsrc/agent-tracking-spec';
import type { Offering, Pricing } from '@metorial/model-catalog/src/types';
import type { Organization, PriceOverrideKind } from '@mtsrc/agent-tracking-db';
import { db } from '@mtsrc/agent-tracking-db';
import {
  knowledgeResolutionService,
  type KnowledgePriceAt,
  type KnowledgeRequestInput
} from '@mtsrc/agent-tracking-module-knowledge';
import { knowledgeCacheService } from '@mtsrc/agent-tracking-module-knowledge';
import { pricePeriodAt, pricePeriodTimeline } from '@mtsrc/agent-tracking-model-resolver';
import { loadOrganizationOverrides } from '../lib/cache';
import { effectivePricing } from '../lib/contract';
import { matchOverride } from '../lib/match';
import { priceOverrideInclude, type PriceOverrideWithRelations } from './priceOverride';

let lifecycleRank: Record<string, number> = {
  active: 0,
  preview: 1,
  deprecated: 2,
  retired: 3
};

export type EffectivePrice = {
  at: Date;
  projectId: string | null;
  modelId: string | null;
  agentId: string | null;
  billingMode: BillingMode;
  list: KnowledgePriceAt;
  override: PriceOverrideWithRelations | null;
  effective: { basis: 'list' | PriceOverrideKind; pricing: Pricing | null };
};

export type EffectivePriceInput = {
  projectId?: string;
  vendorId?: string;
  agent?: string;
  billingMode?: BillingMode;
  at?: Date;
} & (
  { offeringId: string } | { modelId: string } | Omit<KnowledgeRequestInput, 'agent' | 'at'>
);

let isDefaultVariant = (offering: Offering) =>
  !offering.variant.serving &&
  !offering.variant.region &&
  !offering.variant.quantization &&
  !offering.variant.free;

class EffectivePriceServiceImpl {
  async getEffectivePrice(d: {
    organization: Organization;
    input: EffectivePriceInput;
  }): Promise<EffectivePrice> {
    let at = d.input.at ?? new Date();
    let billingMode = d.input.billingMode ?? 'unknown';

    let [project, index, overrides] = await Promise.all([
      this.resolveProject({ organization: d.organization, projectId: d.input.projectId }),
      knowledgeCacheService.getKnowledge(),
      loadOrganizationOverrides(d.organization.id)
    ]);

    let agent = d.input.agent ? index?.vendors.agent(d.input.agent) : undefined;
    let list = await this.listPrice({
      input: d.input,
      at,
      agentVendorId: agent?.defaultVendorId ?? undefined
    });

    let modelId = list.modelId;
    let info = modelId ? index?.modelInfo(modelId) : undefined;
    let vendorId = list.vendorId ?? d.input.vendorId;

    let matched = matchOverride(overrides, {
      at,
      organizationId: d.organization.id,
      projectId: project?.id ?? null,
      ...(list.offering ? { offeringId: list.offering.id } : {}),
      ...(modelId ? { modelId } : {}),
      ...(info?.familyId ? { familyId: info.familyId } : {}),
      ...(info ? { labId: info.labId } : {}),
      ...(agent ? { agentId: agent.id } : {}),
      ...(vendorId ? { vendorId } : {}),
      billingMode
    });

    let override = matched
      ? await db.priceOverride.findUniqueOrThrow({
          where: { id: matched.id },
          include: priceOverrideInclude
        })
      : null;
    let listPricing = list.pricePeriod?.pricing ?? null;

    return {
      at,
      projectId: project?.id ?? null,
      modelId,
      agentId: agent?.id ?? null,
      billingMode,
      list,
      override,
      effective: {
        basis: matched?.kind ?? 'list',
        pricing: effectivePricing({ list: listPricing, override: matched ?? null })
      }
    };
  }

  private async listPrice(d: {
    input: EffectivePriceInput;
    at: Date;
    agentVendorId: string | undefined;
  }): Promise<KnowledgePriceAt> {
    if ('offeringId' in d.input) {
      return await knowledgeResolutionService.priceAt({
        offeringId: d.input.offeringId,
        at: d.at
      });
    }

    if ('modelId' in d.input) {
      let offeringId = await this.modelOffering({
        modelId: d.input.modelId,
        vendorId: d.input.vendorId ?? d.agentVendorId,
        at: d.at
      });
      if (offeringId)
        return await knowledgeResolutionService.priceAt({ offeringId, at: d.at });

      return {
        at: d.at,
        snapshotId: (await knowledgeCacheService.getKnowledge())?.version ?? null,
        modelId: d.input.modelId,
        vendorId: d.input.vendorId ?? null,
        vendorSource: null,
        offering: null,
        pricePeriod: null,
        priceAssumed: null
      };
    }

    if (!d.input.raw) {
      throw new ServiceError(
        badRequestError({ message: 'Pass an offeringId, a modelId or a raw model name.' })
      );
    }

    return await knowledgeResolutionService.priceAt({
      raw: d.input.raw,
      provider: d.input.provider ?? d.input.vendorId,
      agent: d.input.agent,
      baseUrl: d.input.baseUrl,
      subscription: d.input.subscription,
      at: d.at
    });
  }

  // Settle prices a model through the requested vendor, falling back to the lab's first-party
  // vendor; this picks the same vendor order for a bare model id.
  private async modelOffering(d: { modelId: string; vendorId: string | undefined; at: Date }) {
    let model = await db.knowledgeModel.findUnique({ where: { id: d.modelId } });
    if (!model) throw new ServiceError(notFoundError('knowledge_model', d.modelId));

    let index = await knowledgeCacheService.getKnowledge();
    let vendorIds = [
      ...new Set(
        [d.vendorId, index?.vendors.firstPartyVendor(model.labId)].filter(
          (vendorId): vendorId is string => !!vendorId
        )
      )
    ];

    let offerings = await db.knowledgeOffering.findMany({
      where: { modelId: d.modelId, vendorId: { in: vendorIds } },
      include: { pricePeriods: true }
    });

    for (let vendorId of vendorIds) {
      let [best] = offerings
        .filter(offering => offering.vendorId == vendorId)
        .filter(
          offering =>
            pricePeriodAt(pricePeriodTimeline(offering.pricePeriods), d.at)?.period.pricing
              .text
        )
        .sort(
          (a, b) =>
            Number(!!a.removedAt) - Number(!!b.removedAt) ||
            Number(!isDefaultVariant(a.data)) - Number(!isDefaultVariant(b.data)) ||
            (lifecycleRank[a.status] ?? 4) - (lifecycleRank[b.status] ?? 4) ||
            (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
        );

      if (best) return best.id;
    }

    return null;
  }

  private async resolveProject(d: { organization: Organization; projectId?: string }) {
    if (!d.projectId) return null;

    let project = await db.project.findFirst({
      where: {
        OR: [{ id: d.projectId }, { ref: d.projectId }],
        organizationOid: d.organization.oid
      }
    });
    if (!project) throw new ServiceError(notFoundError('project', d.projectId));

    return project;
  }
}

export let effectivePriceService = Service.create(
  'effectivePriceService',
  () => new EffectivePriceServiceImpl()
).build();
