import type { SlateAdapterAdvertisedCapability } from '@slates/adapter';
import { db, type Session } from '@metorial-subspace/db';
import { LRUCache } from 'lru-cache';

let versionAdapterCapabilitiesCache = new LRUCache<string, SlateAdapterAdvertisedCapability[]>({
  max: 500
});

let cacheKey = (versionOid: bigint, adapterId: string) => `${versionOid}:${adapterId}`;

export let resetAdvertisedAdapterCapabilitiesCache = () => {
  versionAdapterCapabilitiesCache.clear();
};

export let normalizeAdvertisedCapabilities = (
  value: unknown
): SlateAdapterAdvertisedCapability[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap(item => {
    if (!item || typeof item !== 'object' || typeof (item as { id?: unknown }).id !== 'string') {
      return [];
    }

    return [{ id: (item as { id: string; value?: unknown }).id, value: (item as { value?: unknown }).value }];
  });
};

export let mergeAdvertisedCapabilities = (
  groups: SlateAdapterAdvertisedCapability[][]
): SlateAdapterAdvertisedCapability[] => {
  let merged = new Map<string, SlateAdapterAdvertisedCapability>();

  for (let group of groups) {
    for (let capability of group) {
      let existing = merged.get(capability.id);
      if (!existing || capability.value === true) {
        merged.set(capability.id, capability);
      }
    }
  }

  return [...merged.values()];
};

export let loadAdvertisedAdapterCapabilities = async (d: {
  session: Pick<Session, 'oid'>;
  adapterId: string;
}): Promise<SlateAdapterAdvertisedCapability[]> => {
  let sessionProviders = await db.sessionProvider.findMany({
    where: { sessionOid: d.session.oid, status: 'active' },
    include: {
      deployment: {
        include: {
          currentVersion: true,
          providerVariant: true
        }
      }
    }
  });

  let versionOids = [
    ...new Set(
      sessionProviders
        .map(
          provider =>
            provider.deployment.currentVersion?.lockedVersionOid ??
            provider.deployment.providerVariant.currentVersionOid
        )
        .filter((oid): oid is bigint => oid != null)
    )
  ];

  let groups: SlateAdapterAdvertisedCapability[][] = [];
  let missing: bigint[] = [];

  for (let versionOid of versionOids) {
    let cached = versionAdapterCapabilitiesCache.get(cacheKey(versionOid, d.adapterId));
    if (cached) {
      groups.push(cached);
    } else {
      missing.push(versionOid);
    }
  }

  if (missing.length > 0) {
    let rows = await db.providerVersionAdapter.findMany({
      where: {
        providerVersionOid: { in: missing },
        adapter: { global: { identifier: d.adapterId } }
      },
      select: {
        providerVersionOid: true,
        capabilities: true
      }
    });

    let byVersion = new Map<bigint, SlateAdapterAdvertisedCapability[]>();
    for (let row of rows) {
      let capabilities = normalizeAdvertisedCapabilities(row.capabilities);
      byVersion.set(row.providerVersionOid, capabilities);
      versionAdapterCapabilitiesCache.set(
        cacheKey(row.providerVersionOid, d.adapterId),
        capabilities
      );
    }

    for (let versionOid of missing) {
      let capabilities = byVersion.get(versionOid) ?? [];
      if (!byVersion.has(versionOid)) {
        versionAdapterCapabilitiesCache.set(cacheKey(versionOid, d.adapterId), capabilities);
      }
      groups.push(capabilities);
    }
  }

  return mergeAdvertisedCapabilities(groups);
};
