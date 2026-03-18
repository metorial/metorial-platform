import { createMetorialDashboardSDK, MetorialDashboardSDK } from '@metorial/dashboard-sdk';
import { awaitConfig } from '@metorial/frontend-config';

let sdks = new Map<string, MetorialDashboardSDK>();

export let ensureDashboardSDKForApi = (apiUrl: string): MetorialDashboardSDK => {
  let url = new URL(apiUrl);

  let sdk = sdks.get(apiUrl);
  if (sdk) return sdk;

  let sdkUrl = `${url.protocol}//${url.host}${url.pathname}`;

  sdk = createMetorialDashboardSDK({
    apiHost: sdkUrl,
    enableDebugLogging: true,
    metorialInstance: url.searchParams.get('_metorial_instance') || 'external'
  });

  sdks.set(apiUrl, sdk);

  return sdk;
};

let ensureSdk = async () => {
  let config = await awaitConfig();
  return ensureDashboardSDKForApi(config.apiUrl);
};

export let withDashboardSDK = async <T>(cb: (sdk: MetorialDashboardSDK) => Promise<T>) => {
  return await cb(await ensureSdk());
};
