import { subspace } from '../lib/subspace';
import { normalizeFilters } from '../lib/subspaceService';

export let subspaceConfigVaultService = {
  get: (d: { providerConfigVaultId: string }) =>
    subspace.providerConfigVault.get(d),

  list: (d: {
    provider_id?: string | string[];
    provider_deployment_id?: string | string[];
    provider_config_id?: string | string[];
  }) => {
    let filters = normalizeFilters({
      providerIds: d.provider_id,
      providerDeploymentIds: d.provider_deployment_id,
      providerConfigIds: d.provider_config_id
    });
    return subspace.providerConfigVault.list(filters);
  },

  create: (d: Parameters<typeof subspace.providerConfigVault.create>[0]) =>
    subspace.providerConfigVault.create(d),

  update: (d: Parameters<typeof subspace.providerConfigVault.update>[0]) =>
    subspace.providerConfigVault.update(d),

  delete: (d: { providerConfigVaultId: string }) =>
    subspace.providerConfigVault.delete(d)
};
