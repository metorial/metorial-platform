import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceIntegrationFirewallAssignmentsCreateOutput = {
  object: 'integration.firewall_assignment';
  id: string;
  targetType: 'enclave' | 'provider' | 'internet_gateway';
  firewall: {
    object: 'networking.firewall#preview';
    id: string;
    slug: string;
    name: string;
  };
  target: {
    object: 'integration.firewall_assignment.target#preview';
    type: 'enclave' | 'provider' | 'internet_gateway';
    id: string;
    name: string;
  } | null;
  createdAt: Date;
};

export let mapManagementInstanceIntegrationFirewallAssignmentsCreateOutput =
  mtMap.object<ManagementInstanceIntegrationFirewallAssignmentsCreateOutput>({
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

export type ManagementInstanceIntegrationFirewallAssignmentsCreateBody = {
  firewallId: string;
} & {
  targetType: 'enclave' | 'provider' | 'internet_gateway';
  enclaveId?: string | undefined;
  providerId?: string | undefined;
};

export let mapManagementInstanceIntegrationFirewallAssignmentsCreateBody =
  mtMap.union([
    mtMap.unionOption(
      'object',
      mtMap.object({
        firewallId: mtMap.objectField('firewall_id', mtMap.passthrough()),
        targetType: mtMap.objectField('target_type', mtMap.passthrough()),
        enclaveId: mtMap.objectField('enclave_id', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough())
      })
    )
  ]);

