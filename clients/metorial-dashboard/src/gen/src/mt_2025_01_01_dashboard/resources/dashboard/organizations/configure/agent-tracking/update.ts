import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsConfigureAgentTrackingUpdateOutput = {
  object: 'agent_tracking.organization_settings';
  organizationId: string;
  serviceStatus: 'applied' | 'pending' | 'unknown';
  privacy: { hideIndividuals: boolean; minGroupUsers: number };
  desktop: {
    toolDetails: boolean;
    sessionContext: boolean;
    sessionTitles: boolean;
    historyImport: boolean;
    historyImportDays: number;
  };
  links: { ticketUrlTemplate: string | null };
};

export let mapDashboardOrganizationsConfigureAgentTrackingUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsConfigureAgentTrackingUpdateOutput>([
    'organization_id',
    'service_status',
    ['privacy', 0, [1, ['hide_individuals', 'min_group_users']]],
    [
      'desktop',
      0,
      [
        1,
        [
          'tool_details',
          'session_context',
          'session_titles',
          'history_import',
          'history_import_days'
        ]
      ]
    ],
    ['links', 0, [1, ['ticket_url_template']]]
  ]);

export type DashboardOrganizationsConfigureAgentTrackingUpdateBody = {
  privacy?:
    | {
        hideIndividuals?: boolean | undefined;
        minGroupUsers?: number | undefined;
      }
    | undefined;
  desktop?:
    | {
        toolDetails?: boolean | undefined;
        sessionContext?: boolean | undefined;
        sessionTitles?: boolean | undefined;
        historyImport?: boolean | undefined;
        historyImportDays?: number | undefined;
      }
    | undefined;
  links?: { ticketUrlTemplate?: string | null | undefined } | undefined;
};

export let mapDashboardOrganizationsConfigureAgentTrackingUpdateBody =
  /* @__PURE__ */ mapObject<DashboardOrganizationsConfigureAgentTrackingUpdateBody>([
    ['privacy', 0, [1, ['hide_individuals', 'min_group_users']]],
    [
      'desktop',
      0,
      [
        1,
        [
          'tool_details',
          'session_context',
          'session_titles',
          'history_import',
          'history_import_days'
        ]
      ]
    ],
    ['links', 0, [1, ['ticket_url_template']]]
  ]);
