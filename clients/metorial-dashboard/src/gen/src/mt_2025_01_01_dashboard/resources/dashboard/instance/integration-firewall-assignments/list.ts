import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceIntegrationFirewallAssignmentsListOutput = {
  items: {
    object: 'integration.firewall_assignment';
    id: string;
    targetType: 'enclave' | 'provider' | 'internet_gateway';
    firewall: {
      object: 'networking.firewall#preview';
      id: string;
      slug: string;
      name: string;
    };
    target: {
      object: 'integration.firewall_assignment.target#preview';
      type: 'enclave' | 'provider' | 'internet_gateway';
      id: string;
      name: string;
    } | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceIntegrationFirewallAssignmentsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceIntegrationFirewallAssignmentsListOutput>(
    [7, [1, ['target_type', 'created_at']]],
    1
  );

export type DashboardInstanceIntegrationFirewallAssignmentsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  firewallId?: string | string[] | undefined;
  enclaveId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  internetGatewayId?: string | string[] | undefined;
  targetType?:
    | 'enclave'
    | 'provider'
    | 'internet_gateway'
    | ('enclave' | 'provider' | 'internet_gateway')[]
    | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceIntegrationFirewallAssignmentsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceIntegrationFirewallAssignmentsListQuery>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'firewall_id',
              'enclave_id',
              'provider_id',
              'internet_gateway_id',
              'target_type',
              ['created_at', 1, 5]
            ]
          ]
        ]
      ]
    ]
  );
