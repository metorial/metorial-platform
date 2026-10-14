import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceFirewallsNetworkPoliciesAttachOutput = {
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

export let mapManagementInstanceFirewallsNetworkPoliciesAttachOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceFirewallsNetworkPoliciesAttachOutput>(
    ['network_policies', 'created_at', 'updated_at', 'archived_at'],
    1
  );

export type ManagementInstanceFirewallsNetworkPoliciesAttachBody = {
  networkPolicyId: string;
  position?: number | undefined;
};

export let mapManagementInstanceFirewallsNetworkPoliciesAttachBody =
  /* @__PURE__ */ mapObject<ManagementInstanceFirewallsNetworkPoliciesAttachBody>(
    ['network_policy_id']
  );
