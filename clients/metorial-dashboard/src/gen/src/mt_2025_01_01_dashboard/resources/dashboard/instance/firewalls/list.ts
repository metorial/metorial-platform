import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceFirewallsListOutput = {
  items: {
    object: 'networking.firewall';
    id: string;
    slug: string;
    name: string;
    description: string | null;
    status: 'active' | 'archived' | 'deleted';
    networkPolicies: {
      object: 'networking.network_policy#preview';
      id: string;
      name: string;
      version: number;
      rules: {
        object: 'networking.network_policy.rule';
        id: string;
        effect: 'allow' | 'deny';
        direction: 'ingress' | 'egress';
        cidrs: string[];
        description: string | null;
        enabled: boolean;
        priority: number;
        ports:
          | {
              object: 'networking.network_policy.port_range';
              from: number;
              to: number;
            }[]
          | null;
      }[];
    }[];
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceFirewallsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceFirewallsListOutput>(
    [7, [1, ['network_policies', 'created_at', 'updated_at', 'archived_at']]],
    1
  );

export type DashboardInstanceFirewallsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  id?: string | string[] | undefined;
  slug?: string | string[] | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  enclaveId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  networkPolicyId?: string | string[] | undefined;
  machineId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceFirewallsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceFirewallsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'enclave_id',
            'provider_id',
            'network_policy_id',
            'machine_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
