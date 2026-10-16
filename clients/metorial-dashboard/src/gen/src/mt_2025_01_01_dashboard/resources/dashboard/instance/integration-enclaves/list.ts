import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceIntegrationEnclavesListOutput = {
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

export let mapDashboardInstanceIntegrationEnclavesListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceIntegrationEnclavesListOutput>(
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

export type DashboardInstanceIntegrationEnclavesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  slug?: string | string[] | undefined;
  internetGatewayId?: string | string[] | undefined;
  providerDeploymentId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  firewallId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceIntegrationEnclavesListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceIntegrationEnclavesListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'internet_gateway_id',
            'provider_deployment_id',
            'provider_id',
            'firewall_id',
            ['created_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
