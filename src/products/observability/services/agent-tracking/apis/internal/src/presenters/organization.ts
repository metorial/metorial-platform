import type { Organization } from '@mtsrc/agent-tracking-db';

export let organizationPresenter = (organization: Organization) => ({
  object: 'agent_tracking#organization',

  id: organization.id,
  ref: organization.ref,
  name: organization.name,

  hashKeyVersion: organization.hashKeyVersion,
  contentKeyVersion: organization.contentKeyVersion,

  settings: {
    allowedEmailDomains: organization.settings.allowedEmailDomains ?? [],
    sliceErasureMode: organization.settings.sliceErasureMode ?? null
  },

  archivedAt: organization.archivedAt,
  createdAt: organization.createdAt,
  updatedAt: organization.updatedAt
});
