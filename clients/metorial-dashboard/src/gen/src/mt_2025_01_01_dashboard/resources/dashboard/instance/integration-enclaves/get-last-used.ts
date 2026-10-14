import { createMapper } from '@metorial/util-resource-mapper/compact';

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
  /* @__PURE__ */ createMapper<DashboardInstanceIntegrationEnclavesGetLastUsedOutput>(
    [
      7,
      [
        1,
        [
          'internet_gateway_id',
          'provider_deployment_id',
          ['enclave_environment', 1, [1, ['created_at']]],
          'created_at',
          'last_used_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceIntegrationEnclavesGetLastUsedQuery = {
  limit?: number | undefined;
};

export let mapDashboardInstanceIntegrationEnclavesGetLastUsedQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceIntegrationEnclavesGetLastUsedQuery>(
    0
  );
