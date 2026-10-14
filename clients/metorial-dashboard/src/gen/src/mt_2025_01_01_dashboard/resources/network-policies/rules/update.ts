import { createMapper } from '@metorial/util-resource-mapper/compact';

export type NetworkPoliciesRulesUpdateOutput = {
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

export let mapNetworkPoliciesRulesUpdateOutput =
  /* @__PURE__ */ createMapper<NetworkPoliciesRulesUpdateOutput>(0);

export type NetworkPoliciesRulesUpdateBody = {
  effect: 'allow' | 'deny';
  direction: 'ingress' | 'egress';
  cidrs: string[];
  description?: string | undefined;
  enabled: boolean;
  priority: number;
  ports?: { from: number; to: number }[] | undefined;
};

export let mapNetworkPoliciesRulesUpdateBody =
  /* @__PURE__ */ createMapper<NetworkPoliciesRulesUpdateBody>(0);
