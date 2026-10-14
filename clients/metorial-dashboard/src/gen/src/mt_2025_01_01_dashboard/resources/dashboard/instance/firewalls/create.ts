import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceFirewallsCreateOutput = {
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
};

export let mapDashboardInstanceFirewallsCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceFirewallsCreateOutput>(
    ['network_policies', 'created_at', 'updated_at', 'archived_at'],
    1
  );

export type DashboardInstanceFirewallsCreateBody = {
  name: string;
  description?: string | undefined;
  slug?: string | undefined;
  networkPolicyIds?: string[] | undefined;
};

export let mapDashboardInstanceFirewallsCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceFirewallsCreateBody>([
    'network_policy_ids'
  ]);
