import { subspace } from '../lib/subspace';
import { normalizeFilters } from '../lib/subspaceService';

export let subspaceSetupSessionService = {
  get: (d: { providerSetupSessionId: string }) =>
    subspace.providerSetupSession.get(d),

  list: (d: {
    provider_id?: string | string[];
    provider_auth_method_id?: string | string[];
    status?: string | string[];
  }) => {
    let filters = normalizeFilters({
      providerIds: d.provider_id,
      providerAuthMethodIds: d.provider_auth_method_id,
      status: d.status
    });
    return subspace.providerSetupSession.list(filters);
  },

  create: (d: Parameters<typeof subspace.providerSetupSession.create>[0]) =>
    subspace.providerSetupSession.create(d),

  update: (d: Parameters<typeof subspace.providerSetupSession.update>[0]) =>
    subspace.providerSetupSession.update(d),

  delete: (d: { providerSetupSessionId: string }) =>
    subspace.providerSetupSession.delete(d)
};
