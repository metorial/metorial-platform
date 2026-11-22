import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsConfigureAgentTrackingGetOutput = {
  object: 'agent_tracking.organization_settings';
  organizationId: string;
  serviceStatus: 'applied' | 'pending' | 'unknown';
  privacy: { hideIndividuals: boolean; minGroupUsers: number };
};

export let mapDashboardOrganizationsConfigureAgentTrackingGetOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsConfigureAgentTrackingGetOutput>(
    [
      'organization_id',
      'service_status',
      ['privacy', 0, [1, ['hide_individuals', 'min_group_users']]]
    ]
  );
