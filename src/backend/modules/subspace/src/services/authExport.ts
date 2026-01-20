import { subspace } from '../lib/subspace';
import { normalizeFilters } from '../lib/subspaceService';

export let subspaceAuthExportService = {
  get: (d: { providerAuthExportId: string }) =>
    subspace.providerAuthExport.get(d),

  list: (d: {
    provider_id?: string | string[];
    provider_auth_config_id?: string | string[];
  }) => {
    let filters = normalizeFilters({
      providerIds: d.provider_id,
      providerAuthConfigIds: d.provider_auth_config_id
    });
    return subspace.providerAuthExport.list(filters);
  },

  create: (d: Parameters<typeof subspace.providerAuthExport.create>[0]) =>
    subspace.providerAuthExport.create(d)
};
