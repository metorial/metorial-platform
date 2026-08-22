import { createCategory } from '@metorial/rest';

let indexCounter = 0;
let getIndexHint = () => {
  indexCounter += 10;
  return indexCounter;
};

export let providerDocsCategory = createCategory({
  id: 'provider',
  name: 'Providers',
  indexHint: getIndexHint()
});

export let integrationDocsCategory = createCategory({
  id: 'integration',
  name: 'Integrations',
  indexHint: getIndexHint()
});

export let sessionDocsCategory = createCategory({
  id: 'session',
  name: 'Sessions',
  indexHint: getIndexHint()
});

export let monitoringDocsCategory = createCategory({
  id: 'monitoring',
  name: 'Monitoring',
  indexHint: getIndexHint()
});

export let configurationDocsCategory = createCategory({
  id: 'configuration',
  name: 'Configurations',
  indexHint: getIndexHint()
});

export let skillDocsCategory = createCategory({
  id: 'skill',
  name: 'Magic Skills',
  indexHint: getIndexHint()
});

export let magicMcpDocsCategory = createCategory({
  id: 'magic-mcp',
  name: 'Magic MCP',
  indexHint: getIndexHint()
});

export let callbackDocsCategory = createCategory({
  id: 'callback',
  name: 'Callbacks',
  indexHint: getIndexHint()
});

export let networkDocsCategory = createCategory({
  id: 'network',
  name: 'Network Access',
  indexHint: getIndexHint()
});

export let portalDocsCategory = createCategory({
  id: 'portal',
  name: 'Portals',
  indexHint: getIndexHint()
});

export let identityDocsCategory = createCategory({
  id: 'identity',
  name: 'Identity',
  indexHint: getIndexHint()
});

export let customProviderDocsCategory = createCategory({
  id: 'custom-provider',
  name: 'Custom Providers',
  indexHint: getIndexHint()
});

export let fileCollectionDocsCategory = createCategory({
  id: 'file-collection',
  name: 'File Collections',
  indexHint: getIndexHint()
});
