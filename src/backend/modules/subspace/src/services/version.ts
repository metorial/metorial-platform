import { subspace } from '../lib/subspace';
import { normalizeFilters } from '../lib/subspaceService';

export let subspaceVersionService = {
  get: (d: { providerVersionId: string }) => subspace.providerVersion.get(d),

  list: (d: { provider_id?: string | string[] }) => {
    let filters = normalizeFilters({
      providerIds: d.provider_id
    });
    return subspace.providerVersion.list(filters);
  }
};
