import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceFirewallsDeleteOutput = {
  object: 'network.firewall';
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived' | 'deleted';
  networkId: string;
  networkPolicies: {
    object: 'network.policy#preview';
    id: string;
    name: string;
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
  }[];
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export let mapDashboardInstanceFirewallsDeleteOutput =
  mtMap.object<DashboardInstanceFirewallsDeleteOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    networkId: mtMap.objectField('network_id', mtMap.passthrough()),
    networkPolicies: mtMap.objectField(
      'network_policies',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          version: mtMap.objectField('version', mtMap.passthrough()),
          rules: mtMap.objectField(
            'rules',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                effect: mtMap.objectField('effect', mtMap.passthrough()),
                direction: mtMap.objectField('direction', mtMap.passthrough()),
                cidrs: mtMap.objectField(
                  'cidrs',
                  mtMap.array(mtMap.passthrough())
                ),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
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
          )
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    archivedAt: mtMap.objectField('archived_at', mtMap.date())
  });

