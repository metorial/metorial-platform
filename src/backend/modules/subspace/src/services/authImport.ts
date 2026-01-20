import { subspace } from '../lib/subspace';
import { normalizeFilters } from '../lib/subspaceService';

export let subspaceAuthImportService = {
  get: (d: { providerAuthImportId: string }) =>
    subspace.providerAuthImport.get(d),

  list: (d: {
    provider_id?: string | string[];
    provider_auth_config_id?: string | string[];
    provider_deployment_id?: string | string[];
  }) => {
    let filters = normalizeFilters({
      providerIds: d.provider_id,
      providerAuthConfigIds: d.provider_auth_config_id,
      providerDeploymentIds: d.provider_deployment_id
    });
    return subspace.providerAuthImport.list(filters);
  },

  create: (d: Parameters<typeof subspace.providerAuthImport.create>[0]) =>
    subspace.providerAuthImport.create(d)
};
