import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceNetworkPoliciesUpdateOutput = {
  object: 'network.policy';
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived' | 'deleted';
  version: number;
  rules: {
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
  }[];
  firewallIds: string[] | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export let mapManagementInstanceNetworkPoliciesUpdateOutput =
  mtMap.object<ManagementInstanceNetworkPoliciesUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    version: mtMap.objectField('version', mtMap.passthrough()),
    rules: mtMap.objectField(
      'rules',
      mtMap.array(
        mtMap.object({
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
        })
      )
    ),
    firewallIds: mtMap.objectField(
      'firewall_ids',
      mtMap.array(mtMap.passthrough())
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    archivedAt: mtMap.objectField('archived_at', mtMap.date())
  });

export type ManagementInstanceNetworkPoliciesUpdateBody = {
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

export let mapManagementInstanceNetworkPoliciesUpdateBody =
  mtMap.object<ManagementInstanceNetworkPoliciesUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    rules: mtMap.objectField(
      'rules',
      mtMap.array(
        mtMap.object({
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
        })
      )
    )
  });

