import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentTrackingSettingsGetOutput = {
  object: 'agent_tracking.instance_settings';
  organizationId: string;
  projectId: string;
  instanceId: string;
  serviceStatus: 'applied' | 'pending' | 'unknown';
  content: { mode: 'basic' | 'shape' | 'full' };
  classification: { deterministicEnabled: boolean; aiEnabled: boolean };
  privacy: { hideIndividuals: boolean; minGroupUsers: number };
};

export let mapDashboardInstanceAgentTrackingSettingsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingSettingsGetOutput>([
    'organization_id',
    'project_id',
    'instance_id',
    'service_status',
    ['classification', 0, [1, ['deterministic_enabled', 'ai_enabled']]],
    ['privacy', 0, [1, ['hide_individuals', 'min_group_users']]]
  ]);
