import { subspace } from '../lib/subspace';
import { normalizeFilters } from '../lib/subspaceService';

export let subspaceAuthCredentialsService = {
  get: (d: { providerAuthCredentialsId: string }) =>
    subspace.providerAuthCredentials.get(d),

  list: (d: {
    provider_id?: string | string[];
    provider_auth_method_id?: string | string[];
  }) => {
    let filters = normalizeFilters({
      providerIds: d.provider_id,
      providerAuthMethodIds: d.provider_auth_method_id
    });
    return subspace.providerAuthCredentials.list(filters);
  },

  create: (d: Parameters<typeof subspace.providerAuthCredentials.create>[0]) =>
    subspace.providerAuthCredentials.create(d),

  update: (d: Parameters<typeof subspace.providerAuthCredentials.update>[0]) =>
    subspace.providerAuthCredentials.update(d),

  delete: (d: { providerAuthCredentialsId: string }) =>
    subspace.providerAuthCredentials.delete(d)
};
