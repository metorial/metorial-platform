import { randomUUID } from 'node:crypto';
import { LRUCache } from 'lru-cache';
import type { DeclaredBillingMode, MatchableDeclaration } from './billing/match';
import { db } from '@mtsrc/agent-tracking-db';
import { entityResolutionService } from '@mtsrc/agent-tracking-module-entities';
import { createVersionKey, redisKey } from '@mtsrc/agent-tracking-redis';
import type { MatchableOverride } from './match';

let versionCheckMs = 15_000;
let fallbackCheckMs = 60_000;
let maxOrganizations = 10_000;

export type OrganizationPricing = {
  overrides: MatchableOverride[];
  declarations: MatchableDeclaration[];
};

type CachedPricing = OrganizationPricing & {
  version: string | null;
  checkedAt: number;
  interval: number;
};

let cache = new LRUCache<string, CachedPricing>({ max: maxOrganizations });
let refreshing = new Map<string, Promise<OrganizationPricing>>();

let versionKeyOf = (organizationId: string) =>
  createVersionKey(redisKey('pricing', 'version', organizationId));

export let priceOverrideVersionKey = (organizationId: string) =>
  versionKeyOf(organizationId).key;

export let publishPriceOverrideVersion = async (organizationId: string) => {
  await versionKeyOf(organizationId).publish(`${Date.now()}.${randomUUID()}`);
};

let readPublishedVersion = (organizationId: string) => versionKeyOf(organizationId).read();

// Archived overrides never apply, not even to rebuilt history; expired ones still price the
// requests inside their validity, so they stay loaded.
export let loadOrganizationOverrides = async (
  organizationId: string
): Promise<MatchableOverride[]> => {
  let rows = await db.priceOverride.findMany({
    where: { organization: { id: organizationId }, archivedAt: null },
    include: { project: { select: { id: true } } }
  });

  return rows.map(row => ({
    id: row.id,
    organizationId,
    projectId: row.project?.id ?? null,
    target: row.target,
    targetId: row.targetId,
    vendorId: row.vendorId,
    billingModes: row.billingModes,
    kind: row.kind,
    multiplier: row.multiplier?.toString() ?? null,
    rates: row.rates,
    priority: row.priority,
    validFrom: row.validFrom,
    validTo: row.validTo,
    archivedAt: row.archivedAt
  }));
};

// A user merged after the declaration was made is matched as the entity it was merged into,
// which is the user its sessions resolve to.
export let loadOrganizationDeclarations = async (
  organizationId: string
): Promise<MatchableDeclaration[]> => {
  let rows = await db.billingDeclaration.findMany({
    where: {
      organization: { id: organizationId },
      archivedAt: null,
      mode: { not: 'unknown' }
    },
    include: { project: { select: { id: true } }, user: true }
  });

  return await Promise.all(
    rows.map(async row => ({
      id: row.id,
      organizationId,
      projectId: row.project?.id ?? null,
      userId: row.user
        ? (await entityResolutionService.followMerged({ entity: row.user })).id
        : null,
      agentId: row.agentId,
      mode: row.mode as DeclaredBillingMode,
      plan: row.plan,
      validFrom: row.validFrom,
      validTo: row.validTo,
      archivedAt: row.archivedAt
    }))
  );
};

export let loadOrganizationPricing = async (
  organizationId: string
): Promise<OrganizationPricing> => {
  let [overrides, declarations] = await Promise.all([
    loadOrganizationOverrides(organizationId),
    loadOrganizationDeclarations(organizationId)
  ]);

  return { overrides, declarations };
};

// The version is read before loading, so a change that commits mid-load leaves a newer
// published version behind and the next check reloads.
let refresh = async (
  organizationId: string,
  cached: CachedPricing | undefined
): Promise<OrganizationPricing> => {
  let published = await readPublishedVersion(organizationId);
  let interval = published ? versionCheckMs : fallbackCheckMs;

  if (cached && published && published.version === cached.version) {
    cache.set(organizationId, { ...cached, checkedAt: Date.now(), interval });
    return cached;
  }

  try {
    let pricing = await loadOrganizationPricing(organizationId);
    cache.set(organizationId, {
      ...pricing,
      version: published?.version ?? null,
      checkedAt: Date.now(),
      interval
    });

    return pricing;
  } catch (error) {
    if (!cached) throw error;

    console.warn('[agent-tracking] price overrides could not be refreshed', error);
    return cached;
  }
};

export let getOrganizationPricing = async (
  organizationId: string
): Promise<OrganizationPricing> => {
  let cached = cache.get(organizationId);
  if (cached && Date.now() - cached.checkedAt < cached.interval) return cached;

  let pending = refreshing.get(organizationId);
  if (pending) return await pending;

  let promise = refresh(organizationId, cached).finally(() => {
    refreshing.delete(organizationId);
  });
  refreshing.set(organizationId, promise);

  return await promise;
};

export let getOrganizationOverrides = async (
  organizationId: string
): Promise<MatchableOverride[]> => (await getOrganizationPricing(organizationId)).overrides;

export let expireOverrideCheck = (organizationId: string) => {
  let cached = cache.get(organizationId);
  if (cached) cache.set(organizationId, { ...cached, checkedAt: -Infinity });
};

export let dropOrganizationOverrides = (organizationId: string) => {
  cache.delete(organizationId);
};

export let resetOverrideCache = () => {
  cache.clear();
  refreshing.clear();
};
