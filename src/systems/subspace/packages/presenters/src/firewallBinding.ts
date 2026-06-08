import type { Enclave, Firewall, FirewallBinding, Network, Provider } from '@metorial-subspace/db';
import { firewallPreviewPresenter } from './firewall';

let enclaveTargetPreviewPresenter = (enclave: Pick<Enclave, 'id' | 'slug' | 'name'>) => ({
  object: 'enclave#preview',

  id: enclave.id,
  slug: enclave.slug,
  name: enclave.name
});

let providerTargetPreviewPresenter = (
  provider: Pick<Provider, 'id' | 'slug' | 'name' | 'prettySlug'>
) => ({
  object: 'provider#preview',

  id: provider.id,
  slug: provider.prettySlug ?? provider.slug,
  name: provider.name
});

let networkTargetPreviewPresenter = (network: Pick<Network, 'id' | 'name'>) => ({
  object: 'network#preview',

  id: network.id,
  name: network.name
});

export let firewallBindingPresenter = (
  binding: FirewallBinding & {
    firewall: Pick<Firewall, 'id' | 'slug' | 'name'>;
    enclave?: Pick<Enclave, 'id' | 'slug' | 'name'> | null;
    provider?: Pick<Provider, 'id' | 'slug' | 'name' | 'prettySlug'> | null;
    network?: Pick<Network, 'id' | 'name'> | null;
  }
) => ({
  object: 'firewall.binding',

  id: binding.id,
  targetType: binding.targetType,

  firewall: firewallPreviewPresenter(binding.firewall),
  target:
    binding.targetType === 'enclave' && binding.enclave
      ? enclaveTargetPreviewPresenter(binding.enclave)
      : binding.targetType === 'provider' && binding.provider
        ? providerTargetPreviewPresenter(binding.provider)
        : binding.targetType === 'network' && binding.network
          ? networkTargetPreviewPresenter(binding.network)
          : null,

  createdAt: binding.createdAt
});
