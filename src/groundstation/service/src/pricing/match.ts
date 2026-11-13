import type { Pricing } from '@metorial/model-catalog/src/types';
import type { PriceOverrideKind, PriceOverrideTarget } from '../../prisma/generated/client';

export let overrideSpecificity: PriceOverrideTarget[] = [
  'offering',
  'model',
  'family',
  'lab',
  'agent',
  'vendor',
  'all'
];

export type MatchableOverride = {
  id: string;
  organizationId: string;
  projectId: string | null;
  target: PriceOverrideTarget;
  targetId: string | null;
  vendorId: string | null;
  kind: PriceOverrideKind;
  multiplier: string | null;
  rates: Pricing | null;
  priority: number;
  validFrom: Date;
  validTo: Date | null;
  archivedAt: Date | null;
};

export type OverrideRequest = {
  at: Date;
  organizationId: string;
  projectId: string | null;
  offeringId?: string;
  modelId?: string;
  familyId?: string;
  labId?: string;
  agentId?: string;
  vendorId?: string;
};

let requestTargetId = (request: OverrideRequest, target: PriceOverrideTarget) => {
  if (target == 'offering') return request.offeringId;
  if (target == 'model') return request.modelId;
  if (target == 'family') return request.familyId;
  if (target == 'lab') return request.labId;
  if (target == 'agent') return request.agentId;
  if (target == 'vendor') return request.vendorId;

  return undefined;
};

export let isOverrideActiveAt = (override: MatchableOverride, at: Date) =>
  !override.archivedAt &&
  override.validFrom.getTime() <= at.getTime() &&
  (!override.validTo || at.getTime() < override.validTo.getTime());

export let overrideMatches = (override: MatchableOverride, request: OverrideRequest) => {
  if (override.organizationId != request.organizationId) return false;
  if (override.projectId && override.projectId != request.projectId) return false;
  if (!isOverrideActiveAt(override, request.at)) return false;
  if (override.vendorId && override.vendorId != request.vendorId) return false;
  if (override.target == 'all') return true;

  let targetId = requestTargetId(request, override.target);
  return !!targetId && targetId == override.targetId;
};

let compareOverrides = (a: MatchableOverride, b: MatchableOverride) =>
  overrideSpecificity.indexOf(a.target) - overrideSpecificity.indexOf(b.target) ||
  Number(!a.projectId) - Number(!b.projectId) ||
  b.priority - a.priority ||
  b.validFrom.getTime() - a.validFrom.getTime() ||
  (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

// One override per request, never stacked (08 §7): the most specific target wins, then a
// project-scoped one, then the higher priority, the later validFrom and finally the newer id.
export let matchOverride = <T extends MatchableOverride>(
  overrides: T[],
  request: OverrideRequest
): T | undefined =>
  overrides.filter(override => overrideMatches(override, request)).sort(compareOverrides)[0];
