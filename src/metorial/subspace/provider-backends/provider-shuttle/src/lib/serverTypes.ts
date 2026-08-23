import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { db, type ProviderVersion } from '@metorial-subspace/db';
import type { ConnectionSpecificationBehavior } from '@metorial-subspace/provider-utils';

let CONNECTION_SCOPED_SERVER_TYPES = new Set(['remote', 'container']);

let getServerType = createLocallyCachedFunction({
  getHash: (shuttleServerOid: bigint) => shuttleServerOid.toString(),
  ttlSeconds: 300,
  provider: async (shuttleServerOid: bigint) => {
    let server = await db.shuttleServer.findUnique({ where: { oid: shuttleServerOid } });
    return server?.type ?? null;
  }
});

export let getShuttleServerTypeForProviderVersion = async (
  providerVersion: ProviderVersion
) => {
  if (!providerVersion.shuttleServerOid) return null;
  return await getServerType(providerVersion.shuttleServerOid);
};

export let resolveConnectionSpecificationBehavior = async (
  providerVersion: ProviderVersion
): Promise<ConnectionSpecificationBehavior> => {
  let type = await getShuttleServerTypeForProviderVersion(providerVersion);
  let discoverPerConnection = type != null && CONNECTION_SCOPED_SERVER_TYPES.has(type);

  return {
    discoverPerConnection,
    mergeDiscoveredToolsIntoVersionSpecification: discoverPerConnection,
    preserveExistingSpecificationOnEmptyDiscovery: type === 'remote'
  };
};
