import type {
  DashboardInstanceProvidersGetOutput,
  DashboardInstanceProvidersListOutput,
  ProviderListingsGetOutput,
  ProviderListingsListOutput
} from '@metorial/dashboard-sdk';

type ProviderOAuthAutoRegistrationSource =
  | DashboardInstanceProvidersGetOutput
  | DashboardInstanceProvidersListOutput['items'][number]
  | ProviderListingsGetOutput['provider']
  | ProviderListingsListOutput['items'][number]['provider'];

type ProviderOAuthAutoRegistrationStatus = 'supported' | 'unsupported' | undefined;

let getProviderTypeOAuthAutoRegistrationStatus = (
  provider: ProviderOAuthAutoRegistrationSource | null | undefined
): ProviderOAuthAutoRegistrationStatus => {
  if (!provider || !('type' in provider)) return undefined;
  if (provider.type.auth.status !== 'enabled') return undefined;
  if (provider.type.auth.oauth.status !== 'enabled') return undefined;
  return provider.type.auth.oauth.oauthAutoRegistration.status;
};

export let getProviderOAuthAutoRegistrationStatus = (
  provider: ProviderOAuthAutoRegistrationSource | null | undefined
) : ProviderOAuthAutoRegistrationStatus => {
  let providerAutoRegistrationStatus =
    provider?.oauth?.status === 'enabled'
      ? provider?.oauth?.autoRegistration?.status
      : undefined;
  return providerAutoRegistrationStatus ?? getProviderTypeOAuthAutoRegistrationStatus(provider);
};

export let getProviderOAuthAutoRegistrationEnabled = (
  provider: ProviderOAuthAutoRegistrationSource | null | undefined
) => {
  let status = getProviderOAuthAutoRegistrationStatus(provider);
  return status === 'supported';
};
