import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { Provider } from '@metorial-subspace/db';

export let checkProviderMatch = (
  provider: Provider,
  entity: { providerOid: bigint } | undefined | null
) => {
  if (!entity) return;

  if (provider.oid !== entity.providerOid) {
    throw new ServiceError(
      badRequestError({
        message: 'All entities must belong to the same provider',
        code: 'provider_mismatch'
      })
    );
  }
};
