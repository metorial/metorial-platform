import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

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
  /* @__PURE__ */ mapObject<ManagementInstanceIntegrationFirewallAssignmentsCreateOutput>(
    ['target_type', 'created_at'],
    1
  );

export type ManagementInstanceIntegrationFirewallAssignmentsCreateBody = {
  firewallId: string;
} & {
  targetType: 'enclave' | 'provider' | 'internet_gateway';
  enclaveId?: string | undefined;
  providerId?: string | undefined;
};

export let mapManagementInstanceIntegrationFirewallAssignmentsCreateBody =
  /* @__PURE__ */ createMapper<ManagementInstanceIntegrationFirewallAssignmentsCreateBody>(
    [3, [[0, [1, ['firewall_id', 'target_type', 'enclave_id', 'provider_id']]]]]
  );
