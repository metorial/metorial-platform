import { describe, expect, it } from 'vitest';
import { v1AgentTrackingOrganizationSettingsPresenter } from './agentTrackingSettings';

let context = {
  apiVersion: 'mt_2025_01_01_dashboard',
  accessType: 'user_auth_token'
} as const;

describe('agent tracking organization settings presenter', () => {
  it('presents the Desktop settings and the ticket link', async () => {
    let presented = await v1AgentTrackingOrganizationSettingsPresenter
      .present(
        {
          settings: {
            organizationId: 'org_1',
            privacy: { hideIndividuals: false, minGroupUsers: 5 },
            desktop: {
              toolDetails: false,
              sessionContext: true,
              sessionTitles: true,
              historyImport: false,
              historyImportDays: 180
            },
            links: { ticketUrlTemplate: 'https://linear.app/acme/issue/{key}' }
          },
          serviceStatus: 'applied'
        },
        context
      )
      .run();

    expect(presented).toEqual({
      object: 'agent_tracking.organization_settings',
      organization_id: 'org_1',
      service_status: 'applied',
      privacy: { hide_individuals: false, min_group_users: 5 },
      desktop: {
        tool_details: false,
        session_context: true,
        session_titles: true,
        history_import: false,
        history_import_days: 180
      },
      links: { ticket_url_template: 'https://linear.app/acme/issue/{key}' }
    });
  });
});
