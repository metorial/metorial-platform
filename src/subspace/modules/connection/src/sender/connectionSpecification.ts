import type { ConduitListToolsResult } from '@metorial-subspace/connection-utils';
import { db, type ProviderVersion } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import { getConnectionProviderSpecification } from '../shared/connectionSpecification';

// A failed discovery is retried on the next tools/list instead of poisoning the
// connection, but not more often than this.
let FAILED_DISCOVERY_RETRY_MS = 30_000;

export type ConnectionScopedSpecification = {
  specificationOid: bigint | null;
  error: PrismaJson.ProviderConnectionDiscoveryError;
};

export let isConnectionScopedProviderVersion = async (providerVersion: ProviderVersion) => {
  let backend = await getBackend({ entity: providerVersion });
  let behavior = await backend.capabilities.getConnectionSpecificationBehavior({
    providerVersion
  });

  return behavior.discoverPerConnection;
};

export let resolveConnectionScopedSpecification = async (d: {
  connectionOid: bigint;
  sessionProviderOid: bigint;
  discover: () => Promise<ConduitListToolsResult>;
}): Promise<ConnectionScopedSpecification | null> => {
  let existing = await getConnectionProviderSpecification(d);

  if (existing?.status === 'discovered' && existing.specificationOid) {
    return { specificationOid: existing.specificationOid, error: null };
  }

  if (
    existing?.status === 'failed' &&
    Date.now() - existing.updatedAt.getTime() < FAILED_DISCOVERY_RETRY_MS
  ) {
    return { specificationOid: null, error: existing.error };
  }

  let res = await d.discover();
  if (res.status === 'not_supported') return null;

  if (res.status === 'failure') {
    return { specificationOid: null, error: res.error };
  }

  let specification = await db.providerSpecification.findFirst({
    where: { id: res.specificationId },
    select: { oid: true }
  });
  if (!specification) {
    return {
      specificationOid: null,
      error: {
        code: 'provider_error',
        message: 'The discovered tool specification could not be resolved.'
      }
    };
  }

  return { specificationOid: specification.oid, error: null };
};
