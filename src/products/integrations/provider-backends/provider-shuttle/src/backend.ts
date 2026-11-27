import { ensureProviderBackend } from '@metorial-subspace/provider-utils';

export let backend = await ensureProviderBackend({
  name: 'Slates',
  type: 'shuttle',
  identifier: 'shuttle'
});
