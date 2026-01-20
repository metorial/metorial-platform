import { subspace } from '../lib/subspace';
import { normalizeFilters } from '../lib/subspaceService';

export let subspaceConfigService = {
  get: (d: { providerConfigId: string }) => subspace.providerConfig.get(d),

  list: (d: {
    provider_id?: string | string[];
    provider_deployment_id?: string | string[];
  }) => {
    let filters = normalizeFilters({
      providerIds: d.provider_id,
      providerDeploymentIds: d.provider_deployment_id
    });
    return subspace.providerConfig.list(filters);
  },

  create: (d: Parameters<typeof subspace.providerConfig.create>[0]) =>
    subspace.providerConfig.create(d),

  update: (d: Parameters<typeof subspace.providerConfig.update>[0]) =>
    subspace.providerConfig.update(d),

  delete: (d: { providerConfigId: string }) =>
    subspace.providerConfig.delete(d)
};
