import { createCategory } from '@metorial/rest';

export let providerDocsCategory = createCategory({
  id: 'provider',
  name: 'Providers',
  indexHint: 10
});

export let customProviderDocsCategory = createCategory({
  id: 'custom-provider',
  name: 'Custom Providers',
  indexHint: 35
});

export let sessionDocsCategory = createCategory({
  id: 'session',
  name: 'Sessions',
  indexHint: 20
});

export let identityDocsCategory = createCategory({
  id: 'identity',
  name: 'Identity',
  indexHint: 45
});

export let configurationDocsCategory = createCategory({
  id: 'configuration',
  name: 'Configurations',
  indexHint: 30
});

export let callbackDocsCategory = createCategory({
  id: 'callback',
  name: 'Callbacks',
  indexHint: 40
});

export let integrationDocsCategory = createCategory({
  id: 'integration',
  name: 'Integrations',
  indexHint: 15
});

export let fileCollectionDocsCategory = createCategory({
  id: 'file-collection',
  name: 'File Collections',
  indexHint: 18
});

export let portalDocsCategory = createCategory({
  id: 'portal',
  name: 'Portals',
  indexHint: 19
});

export let skillDocsCategory = createCategory({
  id: 'skill',
  name: 'Skills',
  indexHint: 25
});
