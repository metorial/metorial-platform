import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceNetworkPoliciesRulesCreateOutput = {
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

export let mapManagementInstanceNetworkPoliciesRulesCreateOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceNetworkPoliciesRulesCreateOutput>(
    0
  );

export type ManagementInstanceNetworkPoliciesRulesCreateBody = {
  effect: 'allow' | 'deny';
  direction: 'ingress' | 'egress';
  cidrs: string[];
  description?: string | undefined;
  enabled: boolean;
  priority: number;
  ports?: { from: number; to: number }[] | undefined;
};

export let mapManagementInstanceNetworkPoliciesRulesCreateBody =
  /* @__PURE__ */ createMapper<ManagementInstanceNetworkPoliciesRulesCreateBody>(
    0
  );
