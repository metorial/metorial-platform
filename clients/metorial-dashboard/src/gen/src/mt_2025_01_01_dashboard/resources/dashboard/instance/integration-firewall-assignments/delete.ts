import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceIntegrationFirewallAssignmentsDeleteOutput = {
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

export let mapDashboardInstanceIntegrationFirewallAssignmentsDeleteOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceIntegrationFirewallAssignmentsDeleteOutput>(
    ['target_type', 'created_at'],
    1
  );
