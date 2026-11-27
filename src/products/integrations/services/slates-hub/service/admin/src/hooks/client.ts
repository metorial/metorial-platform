import { isServiceError } from '@lowerdeck/error';
import { createClient } from '@lowerdeck/rpc-client';
import type { SlatesHubAdminClient } from '@mtsrc/slates-hub-api-admin';

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
