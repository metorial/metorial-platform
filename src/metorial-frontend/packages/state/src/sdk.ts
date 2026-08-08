import { createMetorialDashboardSDK, MetorialDashboardSDK } from '@metorial/dashboard-sdk';
import { awaitConfig } from '@metorial/frontend-config';

let sdks = new Map<string, MetorialDashboardSDK>();

let normalizeMetorialApiUrl = (value: string) => {
  if (typeof window === 'undefined') return value;

  let url = new URL(value);
  if (url.hostname !== 'platform.metorial.com') return value;

  url.host = window.location.host;
  return url.toString();
};

export interface ConsumerSetup {
  apiKey: string;
  consumerToken: string;
  instanceId: string;
  projectId: string;
  organizationId: string;
  portalId: string;
}
let consumerSetup: {
  current: ConsumerSetup | null;
  required: boolean;
  index: number;
} = {
  current: null,
  required: false,
  index: 0
};
export let requireConsumerSetup = () => {
  consumerSetup.required = true;
};

let getConsumerSetup = async () => {
  if (consumerSetup.required && !consumerSetup.current) {
    while (!consumerSetup.current) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  return consumerSetup;
};
export let getConsumerSetupSync = () => consumerSetup.current ?? undefined;

export let setConsumerSetup = (setup: ConsumerSetup | null) => {
  consumerSetup.current = setup;
  consumerSetup.index++;

  console.log('setConsumerSetup', setup, consumerSetup);
};

export let ensureDashboardSDKForApi = async (
  apiUrl: string
): Promise<MetorialDashboardSDK> => {
  apiUrl = normalizeMetorialApiUrl(apiUrl);
  let url = new URL(apiUrl);

  let consumer = await getConsumerSetup();

  let sdk = sdks.get(`${consumer.index}$$${apiUrl}`);
  if (sdk) return sdk;

  let sdkUrl = `${url.protocol}//${url.host}${url.pathname}`;

  sdk = createMetorialDashboardSDK({
    apiHost: sdkUrl,
    enableDebugLogging: true,
    metorialInstance: url.searchParams.get('_metorial_instance') || 'external',
    consumer: consumer.current ?? undefined
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
