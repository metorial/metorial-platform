import { subspace } from '../lib/subspace';
import { normalizeFilters } from '../lib/subspaceService';

export let subspaceSpecificationService = {
  get: (d: { providerSpecificationId: string }) =>
    subspace.providerSpecification.get(d),

  list: (d: { provider_id?: string | string[] }) => {
    let filters = normalizeFilters({
      providerIds: d.provider_id
    });
    return subspace.providerSpecification.list(filters);
  }
};
