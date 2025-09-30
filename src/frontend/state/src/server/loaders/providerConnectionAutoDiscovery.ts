import { ProviderOauthDiscoverBody } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { useMutation } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let useAutoDiscoverProviderConnection = () =>
  useMutation(
    (i: ProviderOauthDiscoverBody) => withAuth(sdk => sdk.providerOauth.discover(i)),
    { disableToast: true }
  );
