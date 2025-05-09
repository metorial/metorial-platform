import { createMetorialDashboardSDK, MetorialDashboardSDK } from '@metorial/dashboard-sdk';
import { getConfig } from '@metorial/frontend-config';

let sdk: MetorialDashboardSDK | null = null;

export let withDashboardSDK = async <T>(cb: (sdk: MetorialDashboardSDK) => Promise<T>) => {
  sdk =
    sdk ??
    createMetorialDashboardSDK({
      apiHost: getConfig().apiUrl
    });

  return await cb(sdk);
};
