import { mtMap } from '@metorial/util-resource-mapper';

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
      | 'networks'
      | 'firewalls'
      | 'enclaves'
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
  mtMap.object<DashboardInstancesResourceCountsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    resources: mtMap.objectField(
      'resources',
      mtMap.array(
        mtMap.object({
          resource: mtMap.objectField('resource', mtMap.passthrough()),
          count: mtMap.objectField('count', mtMap.passthrough())
        })
      )
    )
  });

export type DashboardInstancesResourceCountsGetQuery = {
  resource:
    | 'provider_deployments'
    | 'provider_configs'
    | 'provider_config_vaults'
    | 'provider_auth_configs'
    | 'provider_auth_credentials'
    | 'session_templates'
    | 'networks'
    | 'firewalls'
    | 'enclaves'
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
        | 'networks'
        | 'firewalls'
        | 'enclaves'
        | 'accounts'
        | 'agents'
        | 'identity_actors'
        | 'identities'
        | 'identity_delegations'
        | 'identity_delegation_configs'
      )[];
};

export let mapDashboardInstancesResourceCountsGetQuery =
  mtMap.object<DashboardInstancesResourceCountsGetQuery>({
    resource: mtMap.objectField(
      'resource',
      mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
    )
  });

