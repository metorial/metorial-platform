// import { createMetorialDashboardSDK, MetorialDashboardSDK } from '@metorial/dashboard-sdk';
import { createPrivateClient, PrivateClient } from '@metorial/api-private/client';
import { createMetorialDashboardSDK, MetorialDashboardSDK } from '@metorial/dashboard-sdk';
import { awaitConfig } from '@metorial/frontend-config';

let sdk: MetorialDashboardSDK | null = null;

let ensureSdk = async () => {
  if (sdk) return sdk;

  let config = await awaitConfig();

  sdk = createMetorialDashboardSDK({
    apiHost: config.apiUrl,
    enableDebugLogging: true
  });

  return sdk;
};

let privateClients = new Map<string, PrivateClient>();

let ensurePrivateClient = async (organizationId: string) => {
  let privateClient = privateClients.get(organizationId);
  // if (privateClient) return privateClient;

  let config = await awaitConfig();

  privateClient = createPrivateClient({
    address: `${config.privateApiUrl}/dashboard/organizations/${organizationId}/graphql`
  });
  privateClients.set(organizationId, privateClient);

  return privateClient;
};

export let withDashboardSDK = async <T>(cb: (sdk: MetorialDashboardSDK) => Promise<T>) => {
  return await cb(await ensureSdk());
};

export let withPrivateClient = async <T>(
  opts: { organizationId: string },
  cb: (client: PrivateClient) => Promise<T>
) => {
  return await cb(await ensurePrivateClient(opts.organizationId));
};
