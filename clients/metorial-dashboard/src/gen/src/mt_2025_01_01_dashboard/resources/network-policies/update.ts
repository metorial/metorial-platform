import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type NetworkPoliciesUpdateOutput = {
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
};

export let mapNetworkPoliciesUpdateOutput =
  /* @__PURE__ */ mapObject<NetworkPoliciesUpdateOutput>(
    ['firewall_ids', 'created_at', 'updated_at', 'archived_at'],
    1
  );

export type NetworkPoliciesUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  rules?:
    | {
        effect: 'allow' | 'deny';
        direction: 'ingress' | 'egress';
        cidrs: string[];
        description?: string | undefined;
        enabled: boolean;
        priority: number;
        ports?: { from: number; to: number }[] | undefined;
      }[]
    | undefined;
};

export let mapNetworkPoliciesUpdateBody =
  /* @__PURE__ */ createMapper<NetworkPoliciesUpdateBody>(0);
