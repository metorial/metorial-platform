import {
  authClients,
  connectSession,
  createProviderSession,
  expectOk,
  metorialEndpoints,
  rest,
  uniqueId,
  type BootstrappedOrganization,
  type RestClient
} from '@metorial/e2e';

export type CredentialName =
  | 'none'
  | 'session'
  | 'management'
  | 'instance'
  | 'otherSession'
  | 'otherManagement'
  | 'otherInstance';

export let instancePathFor = (org: BootstrappedOrganization, name: string, path: string) => {
  if (name === 'session' || name === 'otherSession') {
    return `/dashboard/instances/${org.ids.instanceId}${path}`;
  }
  if (name === 'management' || name === 'otherManagement') {
    return `/instances/${org.ids.instanceId}${path}`;
  }
  return path;
};

export let crossTenantClients = (
  org: BootstrappedOrganization,
  otherOrg: BootstrappedOrganization
): Record<CredentialName, RestClient> =>
  authClients(org, {
    otherSession: rest(metorialEndpoints().api, { session: otherOrg.session }),
    otherManagement: otherOrg.clients.management,
    otherInstance: otherOrg.clients.instance
  });

export let createProviderDeployment = async (client: RestClient, providerId: string) =>
  expectOk(
    await client.post('/provider-deployments', {
      provider_id: providerId,
      name: uniqueId('e2e-deployment')
    })
  );

export let createProviderConfig = async (
  client: RestClient,
  input: { providerId: string; deploymentId?: string; value?: Record<string, unknown> }
) =>
  expectOk(
    await client.post('/provider-configs', {
      provider_id: input.providerId,
      provider_deployment_id: input.deploymentId,
      name: uniqueId('e2e-config'),
      value: input.value ?? {}
    })
  );

export let ids = (items: { id: string }[]) => items.map(item => item.id);

export let discoverProviderTools = async (
  org: BootstrappedOrganization,
  providerId: string
) => {
  let session = await createProviderSession(org.clients.instance, [providerId]);
  let client = connectSession(session.id, org.keys.instanceSecret);
  let init = await client.initialize();
  if (init.status !== 200) throw new Error(`initialize responded ${init.status}`);
  await client.listTools();
};

export let providerToolKeys = ['tool_echo', 'tool_add'];
