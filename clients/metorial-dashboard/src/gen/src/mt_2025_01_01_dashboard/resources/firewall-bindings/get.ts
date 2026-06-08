import { mtMap } from '@metorial/util-resource-mapper';

export type FirewallBindingsGetOutput = {
  object: 'network.firewall.binding';
  id: string;
  targetType: 'enclave' | 'provider' | 'network';
  firewall: {
    object: 'network.firewall#preview';
    id: string;
    slug: string;
    name: string;
  };
  target: {
    object: 'network.firewall.binding.target#preview';
    type: 'enclave' | 'provider' | 'network';
    id: string;
    name: string;
  } | null;
  createdAt: Date;
};

export let mapFirewallBindingsGetOutput =
  mtMap.object<FirewallBindingsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    targetType: mtMap.objectField('target_type', mtMap.passthrough()),
    firewall: mtMap.objectField(
      'firewall',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough())
      })
    ),
    target: mtMap.objectField(
      'target',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

