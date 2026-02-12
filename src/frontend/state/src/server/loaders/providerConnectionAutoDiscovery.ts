/*
import { ProviderOauthDiscoverBody } from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { useMutation } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let useAutoDiscoverProviderConnection = () =>
  useMutation(
    (i: ProviderOauthDiscoverBody) => withAuth(sdk => sdk.providerOauth.discover(i)),
    { disableToast: true }
  );
*/

// Placeholder export to prevent import errors in consuming code
export const useAutoDiscoverProviderConnection = () => {
  throw new Error('providerOauth.discover API has been removed in the new Provider API');
};
