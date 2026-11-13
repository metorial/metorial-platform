import { randomUUID } from 'node:crypto';
import { LRUCache } from 'lru-cache';
import { db } from '../db';
import { tryRedis } from '../sessions/redis';
import type { MatchableOverride } from './match';

let versionCheckMs = 15_000;
let fallbackCheckMs = 60_000;
let maxOrganizations = 10_000;

type CachedOverrides = {
  version: string | null;
  overrides: MatchableOverride[];
  checkedAt: number;
  interval: number;
};

let cache = new LRUCache<string, CachedOverrides>({ max: maxOrganizations });
let refreshing = new Map<string, Promise<MatchableOverride[]>>();

export let priceOverrideVersionKey = (organizationId: string) =>
  `gs:pricing:version:${organizationId}`;

export let publishPriceOverrideVersion = async (organizationId: string) => {
  await tryRedis(redis =>
    redis.set(priceOverrideVersionKey(organizationId), `${Date.now()}.${randomUUID()}`)
  );
};

let readPublishedVersion = async (organizationId: string) =>
  await tryRedis(async redis => ({
    version: await redis.get(priceOverrideVersionKey(organizationId))
  }));

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
    kind: row.kind,
    multiplier: row.multiplier?.toString() ?? null,
    rates: row.rates,
    priority: row.priority,
    validFrom: row.validFrom,
    validTo: row.validTo,
    archivedAt: row.archivedAt
  }));
};

// The version is read before loading, so a change that commits mid-load leaves a newer
// published version behind and the next check reloads.
let refresh = async (organizationId: string, cached: CachedOverrides | undefined) => {
  let published = await readPublishedVersion(organizationId);
  let interval = published ? versionCheckMs : fallbackCheckMs;

  if (cached && published && published.version === cached.version) {
    cache.set(organizationId, { ...cached, checkedAt: Date.now(), interval });
    return cached.overrides;
  }

  try {
    let overrides = await loadOrganizationOverrides(organizationId);
    cache.set(organizationId, {
      version: published?.version ?? null,
      overrides,
      checkedAt: Date.now(),
      interval
    });

    return overrides;
  } catch (error) {
    if (!cached) throw error;

    console.warn('[groundstation] price overrides could not be refreshed', error);
    return cached.overrides;
  }
};

export let getOrganizationOverrides = async (
  organizationId: string
): Promise<MatchableOverride[]> => {
  let cached = cache.get(organizationId);
  if (cached && Date.now() - cached.checkedAt < cached.interval) return cached.overrides;

  let pending = refreshing.get(organizationId);
  if (pending) return await pending;

  let promise = refresh(organizationId, cached).finally(() => {
    refreshing.delete(organizationId);
  });
  refreshing.set(organizationId, promise);

  return await promise;
};

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
