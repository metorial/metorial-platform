import type { MatchableOverride, OverrideRequest } from '../match';

let counter = 0;

export let validFrom = new Date('2026-01-01T00:00:00Z');

export let override = (input: Partial<MatchableOverride> = {}): MatchableOverride => ({
  id: `gpo_${String(++counter).padStart(4, '0')}`,
  organizationId: 'gor_a',
  projectId: null,
  target: 'all',
  targetId: null,
  vendorId: null,
  kind: 'multiplier',
  multiplier: '0.5',
  rates: null,
  priority: 0,
  validFrom,
  validTo: null,
  archivedAt: null,
  ...input
});

export let overrideRequest = (input: Partial<OverrideRequest> = {}): OverrideRequest => ({
  at: new Date('2026-03-04T10:00:00Z'),
  organizationId: 'gor_a',
  projectId: 'gpr_a',
  offeringId: 'anthropic:claude-sonnet-4-5',
  modelId: 'claude-sonnet-4-5',
  familyId: 'claude-sonnet',
  labId: 'anthropic',
  agentId: 'claude-code',
  vendorId: 'anthropic',
  ...input
});
