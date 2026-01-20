import { subspace } from '../lib/subspace';
import { normalizeFilters } from '../lib/subspaceService';

export let subspaceAuthMethodService = {
  get: (d: { providerAuthMethodId: string }) =>
    subspace.providerAuthMethod.get(d),

  list: (d: {
    provider_id?: string | string[];
    provider_specification_id?: string | string[];
  }) => {
    let filters = normalizeFilters({
      providerIds: d.provider_id,
      providerSpecificationIds: d.provider_specification_id
    });
    return subspace.providerAuthMethod.list(filters);
  }
};
