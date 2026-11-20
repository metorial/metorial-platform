import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsConfigureAgentTrackingUpdateOutput = {
  object: 'agent_tracking.organization_settings';
  organizationId: string;
  serviceStatus: 'applied' | 'pending' | 'unknown';
  privacy: { hideIndividuals: boolean; minGroupUsers: number };
};

export let mapDashboardOrganizationsConfigureAgentTrackingUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsConfigureAgentTrackingUpdateOutput>([
    'organization_id',
    'service_status',
    ['privacy', 0, [1, ['hide_individuals', 'min_group_users']]]
  ]);

export type DashboardOrganizationsConfigureAgentTrackingUpdateBody = {
  privacy: {
    hideIndividuals?: boolean | undefined;
    minGroupUsers?: number | undefined;
  };
};

export let mapDashboardOrganizationsConfigureAgentTrackingUpdateBody =
  /* @__PURE__ */ mapObject<DashboardOrganizationsConfigureAgentTrackingUpdateBody>([
    ['privacy', 0, [1, ['hide_individuals', 'min_group_users']]]
  ]);
