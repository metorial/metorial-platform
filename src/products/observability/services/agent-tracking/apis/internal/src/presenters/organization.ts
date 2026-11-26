import type { Organization } from '@mtsrc/agent-tracking-db';
import { desktopSettingsOf } from '@mtsrc/agent-tracking-spec';

export let organizationPresenter = (organization: Organization) => ({
  object: 'agent_tracking#organization',

  id: organization.id,
  ref: organization.ref,
  name: organization.name,

  hashKeyVersion: organization.hashKeyVersion,
  contentKeyVersion: organization.contentKeyVersion,

  settings: {
    allowedEmailDomains: organization.settings.allowedEmailDomains ?? [],
    sliceErasureMode: organization.settings.sliceErasureMode ?? null,
    privacy: {
      hideIndividuals: organization.settings.privacy?.hideIndividuals ?? false,
      minGroupUsers: organization.settings.privacy?.minGroupUsers ?? 5
    },
    desktop: desktopSettingsOf(organization.settings)
  },

  archivedAt: organization.archivedAt,
  createdAt: organization.createdAt,
  updatedAt: organization.updatedAt
});
