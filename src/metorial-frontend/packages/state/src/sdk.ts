import { createMetorialDashboardSDK, MetorialDashboardSDK } from '@metorial/dashboard-sdk';
import { awaitConfig } from '@metorial/frontend-config';

let sdks = new Map<string, MetorialDashboardSDK>();

export interface ConsumerSetup {
  apiKey: string;
  consumerToken: string;
  instanceId: string;
  projectId: string;
  organizationId: string;
}
let consumerSetup: {
  current: ConsumerSetup | null;
  required: boolean;
} = {
  current: null,
  required: false
};
export let requireConsumerSetup = () => {
  consumerSetup.required = true;
};

export let getConsumerSetup = async () => {
  if (consumerSetup.required && !consumerSetup.current) {
    while (!consumerSetup.current) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  return consumerSetup.current ?? undefined;
};
export let getConsumerSetupSync = () => consumerSetup.current ?? undefined;

export let setConsumerSetup = (setup: ConsumerSetup | null) => {
  consumerSetup.current = setup;
};

export let ensureDashboardSDKForApi = async (
  apiUrl: string
): Promise<MetorialDashboardSDK> => {
  let url = new URL(apiUrl);

  let sdk = sdks.get(apiUrl);
  if (sdk) return sdk;

  let sdkUrl = `${url.protocol}//${url.host}${url.pathname}`;

  sdk = createMetorialDashboardSDK({
    apiHost: sdkUrl,
    enableDebugLogging: true,
    metorialInstance: url.searchParams.get('_metorial_instance') || 'external',
    consumer: await getConsumerSetup()
  });

  sdks.set(apiUrl, sdk);

  return sdk;
};

let ensureSdk = async () => {
  let config = await awaitConfig();
  return await ensureDashboardSDKForApi(config.apiUrl);
};

export let withDashboardSDK = async <T>(cb: (sdk: MetorialDashboardSDK) => Promise<T>) => {
  return await cb(await ensureSdk());
};
