import { subspace } from '../lib/subspace';
import { normalizeFilters } from '../lib/subspaceService';

export let subspaceDeploymentService = {
  get: (d: { providerDeploymentId: string }) =>
    subspace.providerDeployment.get(d),

  list: (d: {
    provider_id?: string | string[];
    provider_version_id?: string | string[];
    status?: string | string[];
  }) => {
    let filters = normalizeFilters({
      providerIds: d.provider_id,
      providerVersionIds: d.provider_version_id,
      status: d.status
    });
    return subspace.providerDeployment.list(filters);
  },

  create: (d: Parameters<typeof subspace.providerDeployment.create>[0]) =>
    subspace.providerDeployment.create(d),

  update: (d: Parameters<typeof subspace.providerDeployment.update>[0]) =>
    subspace.providerDeployment.update(d),

  delete: (d: { providerDeploymentId: string }) =>
    subspace.providerDeployment.delete(d)
};
