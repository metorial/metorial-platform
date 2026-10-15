import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceNetworkPoliciesListOutput = {
  items: {
    object: 'networking.network_policy';
    id: string;
    name: string;
    description: string | null;
    status: 'active' | 'archived' | 'deleted';
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
    firewallIds: string[] | null;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceNetworkPoliciesListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceNetworkPoliciesListOutput>(
    [7, [1, ['firewall_ids', 'created_at', 'updated_at', 'archived_at']]],
    1
  );

export type DashboardInstanceNetworkPoliciesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  firewallId?: string | string[] | undefined;
  search?: string | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceNetworkPoliciesListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceNetworkPoliciesListQuery>([
    3,
    [[0, [1, ['firewall_id', ['created_at', 1, 5], ['updated_at', 1, 5]]]]]
  ]);
