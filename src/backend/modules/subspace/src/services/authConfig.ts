import { subspace } from '../lib/subspace';
import { normalizeFilters } from '../lib/subspaceService';

export let subspaceAuthConfigService = {
  get: (d: { providerAuthConfigId: string }) =>
    subspace.providerAuthConfig.get(d),

  list: (d: {
    provider_id?: string | string[];
    provider_deployment_id?: string | string[];
    provider_auth_method_id?: string | string[];
    provider_auth_credentials_id?: string | string[];
    status?: string | string[];
  }) => {
    let filters = normalizeFilters({
      providerIds: d.provider_id,
      providerDeploymentIds: d.provider_deployment_id,
      providerAuthMethodIds: d.provider_auth_method_id,
      providerAuthCredentialsIds: d.provider_auth_credentials_id,
      status: d.status
    });
    return subspace.providerAuthConfig.list(filters);
  },

  create: (d: Parameters<typeof subspace.providerAuthConfig.create>[0]) =>
    subspace.providerAuthConfig.create(d),

  update: (d: Parameters<typeof subspace.providerAuthConfig.update>[0]) =>
    subspace.providerAuthConfig.update(d),

  delete: (d: { providerAuthConfigId: string }) =>
    subspace.providerAuthConfig.delete(d)
};
