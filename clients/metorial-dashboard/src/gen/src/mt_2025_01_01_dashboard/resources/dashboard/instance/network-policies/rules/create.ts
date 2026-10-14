import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceNetworkPoliciesRulesCreateOutput = {
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
};

export let mapDashboardInstanceNetworkPoliciesRulesCreateOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceNetworkPoliciesRulesCreateOutput>(
    0
  );

export type DashboardInstanceNetworkPoliciesRulesCreateBody = {
  effect: 'allow' | 'deny';
  direction: 'ingress' | 'egress';
  cidrs: string[];
  description?: string | undefined;
  enabled: boolean;
  priority: number;
  ports?: { from: number; to: number }[] | undefined;
};

export let mapDashboardInstanceNetworkPoliciesRulesCreateBody =
  /* @__PURE__ */ createMapper<DashboardInstanceNetworkPoliciesRulesCreateBody>(
    0
  );
