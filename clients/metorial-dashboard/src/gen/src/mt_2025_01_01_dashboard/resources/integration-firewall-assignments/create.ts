import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type IntegrationFirewallAssignmentsCreateOutput = {
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

export let mapIntegrationFirewallAssignmentsCreateOutput =
  /* @__PURE__ */ mapObject<IntegrationFirewallAssignmentsCreateOutput>(
    ['target_type', 'created_at'],
    1
  );

export type IntegrationFirewallAssignmentsCreateBody = {
  firewallId: string;
} & {
  targetType: 'enclave' | 'provider' | 'internet_gateway';
  enclaveId?: string | undefined;
  providerId?: string | undefined;
};

export let mapIntegrationFirewallAssignmentsCreateBody =
  /* @__PURE__ */ createMapper<IntegrationFirewallAssignmentsCreateBody>([
    3,
    [[0, [1, ['firewall_id', 'target_type', 'enclave_id', 'provider_id']]]]
  ]);
