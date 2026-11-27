import { createLoader } from '@metorial/data-hooks';
import { extractRequiredSchema } from '../lib/jsonSchema';
import { getIntegrationsClient } from './client';
import type { SessionCredentials } from './types';

export type ProviderSearchInput = SessionCredentials & {
  search?: string;
  limit?: number;
  after?: string;
  before?: string;
};

export let setupSessionLoader = createLoader({
  name: 'setupSession',
  fetch: (i: SessionCredentials) =>
    getIntegrationsClient(i.clientSecret).setupSession.get({ ...i, autoStartOauth: true }),
  mutators: {}
});

export let authConfigSchemaLoader = createLoader({
  name: 'authConfigSchema',
  fetch: async (i: SessionCredentials) => {
    let res = await getIntegrationsClient(i.clientSecret).setupSession.getAuthConfigSchema(i);
    return { schema: extractRequiredSchema(res.schema) };
  },
  mutators: {}
});

export let configSchemaLoader = createLoader({
  name: 'configSchema',
  fetch: async (i: SessionCredentials) => {
    let res = await getIntegrationsClient(i.clientSecret).setupSession.getConfigSchema(i);
    return { schema: extractRequiredSchema(res.schema) };
  },
  mutators: {}
});

export let setupSessionToolsLoader = createLoader({
  name: 'setupSessionTools',
  fetch: (i: SessionCredentials) =>
    getIntegrationsClient(i.clientSecret).setupSession.listTools(i),
  mutators: {}
});

export let providerSearchLoader = createLoader({
  name: 'providerSearch',
  fetch: (i: ProviderSearchInput) =>
    getIntegrationsClient(i.clientSecret).setupSession.listProviders(i),
  mutators: {}
});

export let integrationSetupSessionLoader = createLoader({
  name: 'integrationSetupSession',
  fetch: (i: SessionCredentials) =>
    getIntegrationsClient(i.clientSecret).integrationSetupSession.get(i),
  mutators: {}
});

export let useSetupSession = (credentials: SessionCredentials | null) =>
  setupSessionLoader.use(credentials);

export let useAuthConfigSchema = (credentials: SessionCredentials | null) =>
  authConfigSchemaLoader.use(credentials);

export let useConfigSchema = (credentials: SessionCredentials | null) =>
  configSchemaLoader.use(credentials);

export let useSetupSessionTools = (credentials: SessionCredentials | null) =>
  setupSessionToolsLoader.use(credentials);

export let useIntegrationSetupSession = (credentials: SessionCredentials | null) =>
  integrationSetupSessionLoader.use(credentials);
