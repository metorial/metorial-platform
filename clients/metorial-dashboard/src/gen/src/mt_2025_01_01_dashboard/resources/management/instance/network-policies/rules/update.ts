import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceNetworkPoliciesRulesUpdateOutput = {
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

export let mapManagementInstanceNetworkPoliciesRulesUpdateOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceNetworkPoliciesRulesUpdateOutput>(
    0
  );

export type ManagementInstanceNetworkPoliciesRulesUpdateBody = {
  effect: 'allow' | 'deny';
  direction: 'ingress' | 'egress';
  cidrs: string[];
  description?: string | undefined;
  enabled: boolean;
  priority: number;
  ports?: { from: number; to: number }[] | undefined;
};

export let mapManagementInstanceNetworkPoliciesRulesUpdateBody =
  /* @__PURE__ */ createMapper<ManagementInstanceNetworkPoliciesRulesUpdateBody>(
    0
  );
