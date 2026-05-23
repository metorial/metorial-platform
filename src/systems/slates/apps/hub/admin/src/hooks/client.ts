import { isServiceError } from '@mtsrc/error';
import { createClient } from '@mtsrc/rpc-client';
import type { SlatesHubAdminClient } from '../../../src/apis/admin/controllers';

let endpoint = `${window.location.origin}/slates-hub-admin`;

export let adminClient = createClient<SlatesHubAdminClient>({
  endpoint,
  getHeaders: () => ({})
});

export let withAuthRedirect = async <T>(cb: () => Promise<T>): Promise<T> => {
  try {
    return await cb();
  } catch (err) {
    if (isServiceError(err) && err.data.status === 401) {
      let { enabled } = await adminClient.auth.authEnabled({});
      if (!enabled) throw err;

      let { authUrl } = await adminClient.auth.getAuthUrl({
        redirectUri: `${window.location.origin}/auth/callback`
      });

      window.location.href = authUrl;

      return new Promise<T>(() => {}); // never resolve
    }

    throw err;
  }
};
