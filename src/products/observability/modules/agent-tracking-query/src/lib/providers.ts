import { providerService } from '@metorial-subspace/module-catalog';
import type { Instance } from '@metorial/db';
import { unique } from './entities';
import { failSoft } from './service';
import type { AgentTrackingProvider } from './types';

export type ProviderReadScope = { instance: Instance; canReadProviders?: boolean };

export let lookupProviders = async (d: {
  scope: ProviderReadScope;
  ids: (string | null | undefined)[];
}) => {
  let ids = unique(d.ids);
  if (!ids.length || !d.scope.canReadProviders || !d.scope.instance.subspaceEnvironmentId) {
    return new Map<string, AgentTrackingProvider>();
  }

  let providers = await failSoft(
    () => providerService.getManyProvidersByIds({ instance: d.scope.instance, ids }),
    []
  );

  return new Map<string, AgentTrackingProvider>(
    providers.map(provider => [provider.id, { id: provider.id, name: provider.name }])
  );
};

export let providersOf = (
  ids: (string | null | undefined)[],
  found: Map<string, AgentTrackingProvider>
): AgentTrackingProvider[] => unique(ids).map(id => found.get(id) ?? { id, name: null });
