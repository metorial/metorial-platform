// import { createMetorialDashboardSDK, MetorialDashboardSDK } from '@metorial/dashboard-sdk';
import { awaitConfig } from '@metorial/frontend-config';
import {
  createMetorialDashboardSDK,
  MetorialDashboardSDK
} from '../../../../clients/metorial-dashboard/dist/index';

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

export let withDashboardSDK = async <T>(cb: (sdk: MetorialDashboardSDK) => Promise<T>) => {
  return await cb(await ensureSdk());
};
