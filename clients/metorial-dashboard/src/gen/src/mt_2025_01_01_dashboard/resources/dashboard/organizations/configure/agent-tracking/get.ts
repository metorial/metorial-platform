import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsConfigureAgentTrackingGetOutput = {
  object: 'agent_tracking.organization_settings';
  organizationId: string;
  serviceStatus: 'applied' | 'pending' | 'unknown';
  privacy: { hideIndividuals: boolean; minGroupUsers: number };
  desktop: {
    toolDetails: boolean;
    sessionContext: boolean;
    sessionTitles: boolean;
    historyImport: boolean;
  };
  links: { ticketUrlTemplate: string | null };
};

export let mapDashboardOrganizationsConfigureAgentTrackingGetOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsConfigureAgentTrackingGetOutput>([
    'organization_id',
    'service_status',
    ['privacy', 0, [1, ['hide_individuals', 'min_group_users']]],
    [
      'desktop',
      0,
      [1, ['tool_details', 'session_context', 'session_titles', 'history_import']]
    ],
    ['links', 0, [1, ['ticket_url_template']]]
  ]);
