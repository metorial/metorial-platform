import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceNetworkPoliciesRulesCreateOutput = {
  object: 'network.policy.rule';
  id: string;
  effect: 'allow' | 'deny';
  direction: 'ingress' | 'egress';
  cidrs: string[];
  description: string | null;
  enabled: boolean;
  priority: number;
  ports:
    | { object: 'network.policy.port_range'; from: number; to: number }[]
    | null;
};

export let mapManagementInstanceNetworkPoliciesRulesCreateOutput =
  mtMap.object<ManagementInstanceNetworkPoliciesRulesCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    effect: mtMap.objectField('effect', mtMap.passthrough()),
    direction: mtMap.objectField('direction', mtMap.passthrough()),
    cidrs: mtMap.objectField('cidrs', mtMap.array(mtMap.passthrough())),
    description: mtMap.objectField('description', mtMap.passthrough()),
    enabled: mtMap.objectField('enabled', mtMap.passthrough()),
    priority: mtMap.objectField('priority', mtMap.passthrough()),
    ports: mtMap.objectField(
      'ports',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          from: mtMap.objectField('from', mtMap.passthrough()),
          to: mtMap.objectField('to', mtMap.passthrough())
        })
      )
    )
  });

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
  mtMap.object<ManagementInstanceNetworkPoliciesRulesCreateBody>({
    effect: mtMap.objectField('effect', mtMap.passthrough()),
    direction: mtMap.objectField('direction', mtMap.passthrough()),
    cidrs: mtMap.objectField('cidrs', mtMap.array(mtMap.passthrough())),
    description: mtMap.objectField('description', mtMap.passthrough()),
    enabled: mtMap.objectField('enabled', mtMap.passthrough()),
    priority: mtMap.objectField('priority', mtMap.passthrough()),
    ports: mtMap.objectField(
      'ports',
      mtMap.array(
        mtMap.object({
          from: mtMap.objectField('from', mtMap.passthrough()),
          to: mtMap.objectField('to', mtMap.passthrough())
        })
      )
    )
  });

