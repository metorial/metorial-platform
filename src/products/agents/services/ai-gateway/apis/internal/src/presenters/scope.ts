import type { Instance, Organization, Project } from '@mtsrc/ai-gateway-db';
import { resolveInstanceSettings } from '@mtsrc/ai-gateway-spec';

export let organizationPresenter = (organization: Organization) => ({
  object: 'ai_gateway#organization',

  id: organization.id,
  ref: organization.ref,
  name: organization.name,

  archivedAt: organization.archivedAt,
  createdAt: organization.createdAt,
  updatedAt: organization.updatedAt
});

export let projectRestrictionsPresenter = (project: Project) => ({
  disabled: project.disabledAt
    ? { reason: project.disabledReason, since: project.disabledAt }
    : null,
  billingRestriction: project.billingRestrictedAt
    ? { reason: project.billingRestrictionReason, since: project.billingRestrictedAt }
    : null
});

export let projectPresenter = (project: Project, organization: Organization) => ({
  object: 'ai_gateway#project',

  id: project.id,
  ref: project.ref,
  name: project.name,

  organizationId: organization.id,

  platformLimits: project.platformLimits,
  platformLimitsSyncedAt: project.platformLimitsSyncedAt,
  ...projectRestrictionsPresenter(project),

  archivedAt: project.archivedAt,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt
});

export let instancePresenter = (
  instance: Instance & { project: Project },
  organization: Organization
) => ({
  object: 'ai_gateway#instance',

  id: instance.id,
  ref: instance.ref,
  name: instance.name,

  organizationId: organization.id,
  project: { id: instance.project.id, ref: instance.project.ref },

  logRetentionDays: instance.logRetentionDays,
  settings: resolveInstanceSettings(instance.settings),
  limits: instance.limits,

  archivedAt: instance.archivedAt,
  createdAt: instance.createdAt,
  updatedAt: instance.updatedAt
});
