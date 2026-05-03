import { createCategory } from '@metorial/rest';

export let providerDocsCategory = createCategory({
  id: 'provider',
  name: 'Providers',
  indexHint: 10
});

export let customProviderDocsCategory = createCategory({
  id: 'custom-provider',
  name: 'Custom Providers',
  indexHint: 20
});

export let sessionDocsCategory = createCategory({
  id: 'session',
  name: 'Sessions',
  indexHint: 30
});

export let identityDocsCategory = createCategory({
  id: 'identity',
  name: 'Identity',
  indexHint: 40
});

export let configurationDocsCategory = createCategory({
  id: 'configuration',
  name: 'Configurations',
  indexHint: 50
});

export let callbackDocsCategory = createCategory({
  id: 'callback',
  name: 'Callbacks',
  indexHint: 60
});
