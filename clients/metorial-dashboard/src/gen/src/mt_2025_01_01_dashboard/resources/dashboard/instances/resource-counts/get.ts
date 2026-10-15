import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstancesResourceCountsGetOutput = {
  object: 'resource_counts';
  resources: {
    resource:
      | 'provider_deployments'
      | 'provider_configs'
      | 'provider_config_vaults'
      | 'provider_auth_configs'
      | 'provider_auth_credentials'
      | 'session_templates'
      | 'integration_internet_gateways'
      | 'firewalls'
      | 'integration_enclaves'
      | 'accounts'
      | 'agents'
      | 'identity_actors'
      | 'identities'
      | 'identity_delegations'
      | 'identity_delegation_configs';
    count: number;
  }[];
};

export let mapDashboardInstancesResourceCountsGetOutput =
  /* @__PURE__ */ createMapper<DashboardInstancesResourceCountsGetOutput>(0);

export type DashboardInstancesResourceCountsGetQuery = {
  resource:
    | 'provider_deployments'
    | 'provider_configs'
    | 'provider_config_vaults'
    | 'provider_auth_configs'
    | 'provider_auth_credentials'
    | 'session_templates'
    | 'integration_internet_gateways'
    | 'firewalls'
    | 'integration_enclaves'
    | 'accounts'
    | 'agents'
    | 'identity_actors'
    | 'identities'
    | 'identity_delegations'
    | 'identity_delegation_configs'
    | (
        | 'provider_deployments'
        | 'provider_configs'
        | 'provider_config_vaults'
        | 'provider_auth_configs'
        | 'provider_auth_credentials'
        | 'session_templates'
        | 'integration_internet_gateways'
        | 'firewalls'
        | 'integration_enclaves'
        | 'accounts'
        | 'agents'
        | 'identity_actors'
        | 'identities'
        | 'identity_delegations'
        | 'identity_delegation_configs'
      )[];
};

export let mapDashboardInstancesResourceCountsGetQuery =
  /* @__PURE__ */ createMapper<DashboardInstancesResourceCountsGetQuery>(0);
