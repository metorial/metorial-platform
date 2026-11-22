import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentTrackingSettingsUpdateOutput = {
  object: 'agent_tracking.instance_settings';
  organizationId: string;
  projectId: string;
  instanceId: string;
  serviceStatus: 'applied' | 'pending' | 'unknown';
  content: { mode: 'basic' | 'shape' | 'full' };
  classification: { deterministicEnabled: boolean; aiEnabled: boolean };
  privacy: { hideIndividuals: boolean; minGroupUsers: number };
};

export let mapDashboardInstanceAgentTrackingSettingsUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingSettingsUpdateOutput>(
    [
      'organization_id',
      'project_id',
      'instance_id',
      'service_status',
      ['classification', 0, [1, ['deterministic_enabled', 'ai_enabled']]],
      ['privacy', 0, [1, ['hide_individuals', 'min_group_users']]]
    ]
  );

export type DashboardInstanceAgentTrackingSettingsUpdateBody = {
  content?: { mode?: 'basic' | 'shape' | 'full' | undefined } | undefined;
  classification?:
    | {
        deterministicEnabled?: boolean | undefined;
        aiEnabled?: boolean | undefined;
      }
    | undefined;
};

export let mapDashboardInstanceAgentTrackingSettingsUpdateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingSettingsUpdateBody>([
    ['classification', 0, [1, ['deterministic_enabled', 'ai_enabled']]]
  ]);
