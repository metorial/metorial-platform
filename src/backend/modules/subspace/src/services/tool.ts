import { subspace } from '../lib/subspace';
import { normalizeFilters } from '../lib/subspaceService';

export let subspaceToolService = {
  get: (d: { providerToolId: string }) => subspace.providerTool.get(d),

  list: (d: {
    provider_id?: string | string[];
    provider_specification_id?: string | string[];
  }) => {
    let filters = normalizeFilters({
      providerIds: d.provider_id,
      providerSpecificationIds: d.provider_specification_id
    });
    return subspace.providerTool.list(filters);
  }
};
