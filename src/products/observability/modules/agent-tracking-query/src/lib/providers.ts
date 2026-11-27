import { getSentry } from '@lowerdeck/sentry';
import { providerService } from '@metorial-subspace/module-catalog';
import type { Instance } from '@metorial/db';
import { unique } from './members';
import type { AgentTrackingProvider } from './types';

export type ProviderReadScope = { instance: Instance; canReadProviders?: boolean };

export let lookupProviders = async (d: {
  scope: ProviderReadScope;
  ids: (string | null | undefined)[];
}) => {
  let found = new Map<string, AgentTrackingProvider>();
  let ids = unique(d.ids);
  if (!ids.length || !d.scope.canReadProviders || !d.scope.instance.subspaceEnvironmentId) {
    return found;
  }

  try {
    let providers = await providerService.getManyProvidersByIds({
      instance: d.scope.instance,
      ids
    });
    for (let provider of providers) {
      found.set(provider.id, { id: provider.id, name: provider.name });
    }
  } catch (error) {
    getSentry().captureException(error);
  }

  return found;
};

export let providersOf = (
  ids: (string | null | undefined)[],
  found: Map<string, AgentTrackingProvider>
): AgentTrackingProvider[] => unique(ids).map(id => found.get(id) ?? { id, name: null });
