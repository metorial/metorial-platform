import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceIntegrationEnclavesGetLastUsedOutput = {
  items: {
    object: 'integration.enclave';
    id: string;
    slug: string;
    name: string;
    description: string | null;
    internetGatewayId: string;
    providerDeploymentId: string;
    enclaveEnvironment: {
      object: 'integration.enclave.environment#preview';
      id: string;
      name: string;
      type: 'metorial' | 'outpost';
      createdAt: Date;
    };
    createdAt: Date;
    lastUsedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceIntegrationEnclavesGetLastUsedOutput =
  mtMap.object<DashboardInstanceIntegrationEnclavesGetLastUsedOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          slug: mtMap.objectField('slug', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          internetGatewayId: mtMap.objectField(
            'internet_gateway_id',
            mtMap.passthrough()
          ),
          providerDeploymentId: mtMap.objectField(
            'provider_deployment_id',
            mtMap.passthrough()
          ),
          enclaveEnvironment: mtMap.objectField(
            'enclave_environment',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              type: mtMap.objectField('type', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date())
            })
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          lastUsedAt: mtMap.objectField('last_used_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type DashboardInstanceIntegrationEnclavesGetLastUsedQuery = {
  limit?: number | undefined;
};

export let mapDashboardInstanceIntegrationEnclavesGetLastUsedQuery =
  mtMap.object<DashboardInstanceIntegrationEnclavesGetLastUsedQuery>({
    limit: mtMap.objectField('limit', mtMap.passthrough())
  });

