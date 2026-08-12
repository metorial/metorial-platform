import { createClient } from '@lowerdeck/rpc-client';
import type { IntegrationsClient } from '@metorial/api-integrations';

export type IntegrationsApiUrls = Record<string, string>;
export type IntegrationsRpcClient = ReturnType<typeof createClient<IntegrationsClient>>;

export let parseIntegrationsApiUrls = (value: string): IntegrationsApiUrls => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('VITE_INTEGRATIONS_API_URLS must be valid JSON');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('VITE_INTEGRATIONS_API_URLS must be an object');
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([region, value]) => {
      if (!/^[a-z0-9-]+$/.test(region) || typeof value !== 'string') {
        throw new Error(`Invalid integrations API configuration for region ${region}`);
      }

      let url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`Invalid integrations API URL for region ${region}`);
      }

      return [region, value.replace(/\/+$/, '')];
    })
  );
};

export let getClientSecretRegion = (clientSecret: string) => {
  let match = clientSecret.match(/^(?:pas|iss)_secret_.+_([a-z0-9-]+)$/);
  if (!match?.[1]) throw new Error('Setup session client secret does not include a region');
  return match[1];
};

export let resolveIntegrationsApiUrl = (
  clientSecret: string,
  apiUrls: IntegrationsApiUrls
) => {
  let region = getClientSecretRegion(clientSecret);
  let apiUrl = apiUrls[region];
  if (!apiUrl) throw new Error(`No integrations API configured for region ${region}`);
  return apiUrl;
};

let clients = new Map<string, IntegrationsRpcClient>();
let configuredApiUrls: IntegrationsApiUrls | undefined;

let getConfiguredApiUrls = () => {
  configuredApiUrls ??= parseIntegrationsApiUrls(import.meta.env.VITE_INTEGRATIONS_API_URLS);
  return configuredApiUrls;
};

export let getIntegrationsClient = (clientSecret: string) => {
  let apiUrl = resolveIntegrationsApiUrl(clientSecret, getConfiguredApiUrls());
  let existing = clients.get(apiUrl);
  if (existing) return existing;

  let client = createClient<IntegrationsClient>({
    endpoint: `${apiUrl}/subspace-public/internal-api`,
    disableBatching: true,
    useDirectMethodRoute: true
  });
  clients.set(apiUrl, client);
  return client;
};
