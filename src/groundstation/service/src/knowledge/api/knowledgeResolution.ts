import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  KnowledgeAgent,
  KnowledgeModel,
  KnowledgeName,
  KnowledgePointer,
  KnowledgeRelease,
  KnowledgeVendor
} from '../../../prisma/generated/client';
import type { ModelMatch, ModelRequest, ResolvedModel } from '../../catalog';
import { db } from '../../db';
import { pricePeriodAt, pricePeriodTimeline } from '../periods';
import { getKnowledge } from '../cache';
import type { VendorSource } from '../types';
import { currentSnapshot } from '../version';
import {
  knowledgeOfferingInclude,
  type KnowledgeOfferingWithPrice
} from './knowledgeOffering';
import {
  knowledgePricePeriodInclude,
  type KnowledgePricePeriodWithOffering
} from './knowledgePrice';

export type KnowledgeRequestInput = {
  raw: string;
  provider?: string;
  agent?: string;
  baseUrl?: string;
  subscription?: boolean;
  at?: Date;
};

export type KnowledgePriceAt = {
  at: Date;
  snapshotId: string | null;
  modelId: string | null;
  vendorId: string | null;
  vendorSource: VendorSource | null;
  offering: KnowledgeOfferingWithPrice | null;
  pricePeriod: KnowledgePricePeriodWithOffering | null;
  priceAssumed: boolean | null;
};

export type KnowledgeResolution = KnowledgePriceAt & {
  request: Omit<KnowledgeRequestInput, 'at'>;
  matchedBy: ModelMatch['by'] | null;
  names: KnowledgeName[];
  pointers: KnowledgePointer[];
  model: KnowledgeModel | null;
  release: KnowledgeRelease | null;
  agent: KnowledgeAgent | null;
  vendor: KnowledgeVendor | null;
};

class KnowledgeResolutionServiceImpl {
  async resolve(d: KnowledgeRequestInput): Promise<KnowledgeResolution> {
    let at = d.at ?? new Date();
    let { snapshotId, resolved } = await this.resolveRequest({ ...d, at });
    let match = resolved.match;

    let [names, pointers, model, release, agent, vendor, priced] = await Promise.all([
      match?.nameIds.length
        ? db.knowledgeName.findMany({
            where: { id: { in: match.nameIds } },
            orderBy: { id: 'asc' }
          })
        : [],
      match?.pointerIds.length
        ? db.knowledgePointer.findMany({ where: { id: { in: match.pointerIds } } })
        : [],
      resolved.modelId
        ? db.knowledgeModel.findUnique({ where: { id: resolved.modelId } })
        : null,
      resolved.releaseId
        ? db.knowledgeRelease.findUnique({ where: { id: resolved.releaseId } })
        : null,
      resolved.agentId
        ? db.knowledgeAgent.findUnique({ where: { id: resolved.agentId } })
        : null,
      resolved.vendorId
        ? db.knowledgeVendor.findUnique({ where: { id: resolved.vendorId } })
        : null,
      this.loadPriced({ offeringId: resolved.offering?.id, periodId: resolved.period?.id })
    ]);

    return {
      at,
      snapshotId,
      request: {
        raw: d.raw,
        provider: d.provider,
        agent: d.agent,
        baseUrl: d.baseUrl,
        subscription: d.subscription
      },
      matchedBy: match?.by ?? null,
      names,
      pointers: match
        ? match.pointerIds.flatMap(id => pointers.filter(pointer => pointer.id == id))
        : [],
      model,
      release,
      agent,
      vendor,
      modelId: resolved.modelId ?? null,
      vendorId: resolved.vendorId ?? null,
      vendorSource: resolved.vendorSource ?? null,
      ...priced,
      priceAssumed: priced.pricePeriod ? (resolved.priceAssumed ?? false) : null
    };
  }

  async priceAt(d: { offeringId: string; at?: Date } | KnowledgeRequestInput) {
    if ('offeringId' in d) return await this.priceAtOffering(d);

    let at = d.at ?? new Date();
    let { snapshotId, resolved } = await this.resolveRequest({ ...d, at });
    let priced = await this.loadPriced({
      offeringId: resolved.offering?.id,
      periodId: resolved.period?.id
    });

    return {
      at,
      snapshotId,
      modelId: resolved.modelId ?? null,
      vendorId: resolved.vendorId ?? null,
      vendorSource: resolved.vendorSource ?? null,
      ...priced,
      priceAssumed: priced.pricePeriod ? (resolved.priceAssumed ?? false) : null
    } satisfies KnowledgePriceAt;
  }

  private async priceAtOffering(d: {
    offeringId: string;
    at?: Date;
  }): Promise<KnowledgePriceAt> {
    let at = d.at ?? new Date();

    let offering = await db.knowledgeOffering.findUnique({
      where: { id: d.offeringId },
      include: { ...knowledgeOfferingInclude, pricePeriods: true }
    });
    if (!offering) throw new ServiceError(notFoundError('knowledge_offering', d.offeringId));

    let { pricePeriods, ...rest } = offering;
    let match = pricePeriodAt(pricePeriodTimeline(pricePeriods), at);
    let period = match && pricePeriods.find(candidate => candidate.id == match.period.id);
    let snapshot = await currentSnapshot();

    return {
      at,
      snapshotId: snapshot?.id ?? null,
      modelId: offering.modelId,
      vendorId: offering.vendorId,
      vendorSource: null,
      offering: rest,
      pricePeriod: period ? { ...period, offering: { id: offering.id } } : null,
      priceAssumed: period && match ? match.priceAssumed : null
    };
  }

  private async resolveRequest(d: KnowledgeRequestInput & { at: Date }) {
    let request: ModelRequest = {
      raw: d.raw,
      provider: d.provider,
      family: d.agent,
      baseUrl: d.baseUrl,
      subscription: d.subscription
    };

    let index = await getKnowledge();
    if (!index) return { snapshotId: null, resolved: {} as ResolvedModel };

    let resolver = await index.prepare([request]);

    return {
      snapshotId: index.version,
      resolved: resolver.resolveModel({ ...request, at: d.at })
    };
  }

  private async loadPriced(d: { offeringId?: string; periodId?: string }) {
    let [offering, pricePeriod] = await Promise.all([
      d.offeringId
        ? db.knowledgeOffering.findUnique({
            where: { id: d.offeringId },
            include: knowledgeOfferingInclude
          })
        : null,
      d.periodId
        ? db.knowledgePricePeriod.findUnique({
            where: { id: d.periodId },
            include: knowledgePricePeriodInclude
          })
        : null
    ]);

    return { offering, pricePeriod };
  }
}

export let knowledgeResolutionService = Service.create(
  'knowledgeResolutionService',
  () => new KnowledgeResolutionServiceImpl()
).build();
