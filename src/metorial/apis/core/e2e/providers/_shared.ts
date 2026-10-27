import {
  API_VERSIONS,
  authClients,
  connectSession,
  createProviderSession,
  eventually,
  expectOk,
  listAll,
  metorialEndpoints,
  rest,
  uniqueId,
  type BootstrappedOrganization,
  type RestClient
} from '@metorial/e2e';

let dashboardCredentials = ['session', 'member', 'otherSession'];
let managementCredentials = ['management', 'otherManagement'];
let jsonSchemaKeys = ['schema', 'config_schema', 'input_schema', 'output_schema'];

export let ownInstanceStatuses = {
  none: 401,
  session: 200,
  management: 200,
  instance: 200,
  otherSession: 404,
  otherManagement: 404
};

export let ownResourceStatuses = { ...ownInstanceStatuses, otherInstance: 404 };

export let dashboardOnlyStatuses = {
  none: 401,
  session: 200,
  management: 200,
  instance: 404,
  otherSession: 404,
  otherManagement: 404
};

/** Session credentials use the dashboard alias, management keys the `/instances/:id` alias. */
export let instanceRoute = (instanceId: string) => (credential: string, path: string) => {
  if (dashboardCredentials.includes(credential)) {
    return `/dashboard/instances/${instanceId}${path}`;
  }
  if (managementCredentials.includes(credential)) return `/instances/${instanceId}${path}`;
  return path;
};

export let tenantClients = <Extra extends Record<string, RestClient> = {}>(
  org: BootstrappedOrganization,
  otherOrg: BootstrappedOrganization,
  extra: Extra = {} as Extra
) =>
  authClients(org, {
    otherSession: rest(metorialEndpoints().api, { session: otherOrg.session }),
    otherManagement: otherOrg.clients.management,
    otherInstance: otherOrg.clients.instance,
    ...extra
  });

export let ids = (items: { id: string }[]) => items.map(item => item.id);

/** JSON schemas are user data whose keys (`additionalProperties`, ...) aren't presenter fields. */
export let withoutJsonSchemas = (value: any): any => {
  if (Array.isArray(value)) return value.map(withoutJsonSchemas);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      jsonSchemaKeys.includes(key) ? null : withoutJsonSchemas(child)
    ])
  );
};

export let createPublishableClient = async (org: BootstrappedOrganization) => {
  let key = expectOk(
    await org.clients.rest.post(
      `/dashboard/organizations/${org.ids.organizationId}/api-keys`,
      {
        type: 'instance_access_token_publishable',
        instance_id: org.ids.instanceId,
        name: uniqueId('e2e-publishable')
      }
    )
  );

  return rest(metorialEndpoints().api, {
    apiKey: key.secret,
    version: API_VERSIONS.magnetar
  });
};

export let waitForCustomProviderDeployment = (client: RestClient, customProviderId: string) =>
  eventually(
    async () => {
      let list = expectOk(
        await client.get('/custom-provider-deployments', {
          query: { custom_provider_id: customProviderId }
        })
      );
      let deployment = list.items[0];
      if (deployment?.status === 'failed') {
        throw new Error(
          `Deployment of ${customProviderId} failed: ${JSON.stringify(deployment)}`
        );
      }
      if (deployment?.status !== 'succeeded') {
        throw new Error(
          `Deployment of ${customProviderId} is ${deployment?.status ?? 'missing'}`
        );
      }

      let customProvider = expectOk(await client.get(`/custom-providers/${customProviderId}`));
      if (!customProvider.provider?.id) {
        throw new Error(`Custom provider ${customProviderId} has no provider`);
      }
      return { customProvider, deployment, providerId: customProvider.provider.id as string };
    },
    { timeoutMs: 60_000, intervalMs: 500 }
  );

/** Waits until the provider's current version has a discovered specification. */
export let waitForSpecification = (client: RestClient, providerId: string) =>
  eventually(
    async () => {
      let provider = expectOk(await client.get(`/providers/${providerId}`));
      if (!provider.current_version?.specification_id) {
        throw new Error(`Provider ${providerId} has no discovered specification yet`);
      }
      return { provider, version: provider.current_version };
    },
    { timeoutMs: 60_000, intervalMs: 500 }
  );

/**
 * A remote provider version only has a preliminary specification without tools until a
 * deployment/config pair is discovered, which a session listing its tools triggers.
 */
export let discoverTools = async (org: BootstrappedOrganization, providerId: string) => {
  let session = await createProviderSession(org.clients.instance, [providerId]);
  let client = connectSession(session.id, org.keys.instanceSecret);
  await client.initialize();
  await client.listTools();

  return eventually(
    async () => {
      let { provider, version } = await waitForSpecification(org.clients.instance, providerId);
      let tools = await listAll(org.clients.instance, '/provider-tools', {
        query: { provider_version_id: version.id }
      });
      if (!tools.length) throw new Error(`Provider ${providerId} has no discovered tools yet`);
      return { provider, version, tools };
    },
    { timeoutMs: 90_000, intervalMs: 1000 }
  );
};
