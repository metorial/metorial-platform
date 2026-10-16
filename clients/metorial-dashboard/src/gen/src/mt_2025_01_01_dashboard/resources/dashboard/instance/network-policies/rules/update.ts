import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceNetworkPoliciesRulesUpdateOutput = {
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

export let mapDashboardInstanceNetworkPoliciesRulesUpdateOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceNetworkPoliciesRulesUpdateOutput>(
    0
  );

export type DashboardInstanceNetworkPoliciesRulesUpdateBody = {
  effect: 'allow' | 'deny';
  direction: 'ingress' | 'egress';
  cidrs: string[];
  description?: string | undefined;
  enabled: boolean;
  priority: number;
  ports?: { from: number; to: number }[] | undefined;
};

export let mapDashboardInstanceNetworkPoliciesRulesUpdateBody =
  /* @__PURE__ */ createMapper<DashboardInstanceNetworkPoliciesRulesUpdateBody>(
    0
  );
