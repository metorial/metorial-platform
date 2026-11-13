import type { TargetPeriod } from '@metorial/model-catalog/src/types';
import type { KnowledgeName, KnowledgePointer } from '../../prisma/generated/client';
import { targetAt } from '../catalog';
import type { KnowledgePriceAt, KnowledgeResolution } from '../knowledge/api';
import {
  knowledgeAgentPresenter,
  knowledgeModelPresenter,
  knowledgeOfferingPresenter,
  knowledgePointerPresenter,
  knowledgeReleasePresenter,
  knowledgeVendorSummaryPresenter
} from './knowledgeCatalog';
import { knowledgePricePeriodPresenter } from './knowledgeHistory';

// Mirrors `targetAt`: the history period covering `at`, or the first one when `at` precedes it.
let historyPeriodAt = (history: TargetPeriod[], at: Date) => {
  let time = at.getTime();
  let covering = history.find(
    period => Date.parse(period.from) <= time && (!period.to || time < Date.parse(period.to))
  );
  let first = history[0];
  let period = covering ?? (first && time < Date.parse(first.from) ? first : null);

  return period
    ? {
        target: period.target,
        from: new Date(period.from),
        to: period.to ? new Date(period.to) : null,
        evidence: period.evidence
      }
    : null;
};

let matchedNamePresenter = (name: KnowledgeName, at: Date) => ({
  object: 'groundstation#knowledge_name',

  id: name.id,
  namespace: name.namespace,
  raw: name.raw,
  key: name.key,
  status: name.status,
  currentTargetModelId: name.targetModelId,
  targetAt: targetAt(name.data, at),
  periodAt: historyPeriodAt(name.data.history ?? [], at),

  removedAt: name.removedAt
});

let matchedPointerPresenter = (pointer: KnowledgePointer, at: Date) => ({
  ...knowledgePointerPresenter(pointer),
  targetAt: targetAt(pointer.data, at),
  periodAt: historyPeriodAt(pointer.data.history ?? [], at)
});

let priceFields = (price: KnowledgePriceAt) => ({
  at: price.at,
  snapshotId: price.snapshotId,

  modelId: price.modelId,
  vendorId: price.vendorId,
  vendorSource: price.vendorSource,

  offering: price.offering ? knowledgeOfferingPresenter(price.offering) : null,
  pricePeriod: price.pricePeriod ? knowledgePricePeriodPresenter(price.pricePeriod) : null,
  priceAssumed: price.priceAssumed
});

export let knowledgePriceAtPresenter = (price: KnowledgePriceAt) => ({
  object: 'groundstation#knowledge_price_at',
  ...priceFields(price)
});

export let knowledgeResolutionPresenter = (resolution: KnowledgeResolution) => ({
  object: 'groundstation#knowledge_resolution',
  ...priceFields(resolution),

  request: {
    raw: resolution.request.raw,
    provider: resolution.request.provider ?? null,
    agent: resolution.request.agent ?? null,
    baseUrl: resolution.request.baseUrl ?? null,
    subscription: resolution.request.subscription ?? null
  },
  resolved: resolution.modelId != null,
  matchedBy: resolution.matchedBy,
  names: resolution.names.map(name => matchedNamePresenter(name, resolution.at)),
  pointers: resolution.pointers.map(pointer =>
    matchedPointerPresenter(pointer, resolution.at)
  ),

  model: resolution.model ? knowledgeModelPresenter(resolution.model) : null,
  release: resolution.release ? knowledgeReleasePresenter(resolution.release) : null,
  agent: resolution.agent ? knowledgeAgentPresenter(resolution.agent) : null,
  vendor: resolution.vendor ? knowledgeVendorSummaryPresenter(resolution.vendor) : null
});
