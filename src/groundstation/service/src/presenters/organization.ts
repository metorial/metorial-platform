import type { Organization } from '../../prisma/generated/client';

export let organizationPresenter = (organization: Organization) => ({
  object: 'groundstation#organization',

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
