import type {
  EffectivePrice,
  PriceOverrideWithRelations
} from '@mtsrc/agent-tracking-module-pricing';
import { knowledgePriceAtPresenter } from './knowledgeResolution';

export let priceOverridePresenter = (override: PriceOverrideWithRelations) => ({
  object: 'agent_tracking#price_override',

  id: override.id,
  name: override.name,
  reason: override.reason,
  projectId: override.project?.id ?? null,

  target: override.target,
  targetId: override.targetId,
  vendorId: override.vendorId,
  billingModes: override.billingModes,

  kind: override.kind,
  multiplier: override.multiplier?.toString() ?? null,
  rates: override.rates,
  priority: override.priority,

  validFrom: override.validFrom,
  validTo: override.validTo,

  createdBy: override.createdBy,
  archivedAt: override.archivedAt,
  createdAt: override.createdAt,
  updatedAt: override.updatedAt
});

export let pricingEffectivePresenter = (price: EffectivePrice) => ({
  object: 'agent_tracking#pricing_effective',

  at: price.at,
  projectId: price.projectId,
  modelId: price.modelId,
  agentId: price.agentId,
  billingMode: price.billingMode,

  list: knowledgePriceAtPresenter(price.list),
  override: price.override ? priceOverridePresenter(price.override) : null,
  effective: {
    basis: price.effective.basis,
    pricing: price.effective.pricing
  }
});
