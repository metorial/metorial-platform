import type {
  DashboardInstanceProvidersGetOutput,
  DashboardInstanceProvidersListOutput,
  ProviderListingsGetOutput
} from '@metorial/dashboard-sdk';

type ProviderOAuthAutoRegistrationSource =
  | DashboardInstanceProvidersGetOutput
  | DashboardInstanceProvidersListOutput['items'][number]
  | ProviderListingsGetOutput['provider'];

export let getProviderOAuthAutoRegistrationStatus = (
  provider: ProviderOAuthAutoRegistrationSource | null | undefined
) => {
  let providerAutoRegistrationStatus =
    provider?.oauth?.status === 'enabled'
      ? provider?.oauth?.autoRegistration?.status
      : undefined;
  let providerTypeSupportsAutoRegistration =
    provider?.type?.auth?.status === 'enabled' &&
    provider?.type?.auth?.oauth?.status === 'enabled' &&
    provider?.type?.auth?.oauth?.oauthAutoRegistration?.status === 'supported';

  if (providerAutoRegistrationStatus === 'enabled') {
    return 'enabled';
  }

  if (providerTypeSupportsAutoRegistration) {
    return 'supported';
  }

  return providerAutoRegistrationStatus;
};

export let getProviderOAuthAutoRegistrationEnabled = (
  provider: ProviderOAuthAutoRegistrationSource | null | undefined
) => {
  let status = getProviderOAuthAutoRegistrationStatus(provider);
  return status === 'enabled' || status === 'supported';
};
