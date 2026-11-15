import type { Instance, Organization, Project } from '@mtsrc/agent-tracking-db';

export let instancePresenter = (
  instance: Instance & { project: Project },
  organization: Organization
) => ({
  object: 'agent_tracking#instance',

  id: instance.id,
  ref: instance.ref,
  name: instance.name,

  organizationId: organization.id,
  project: { id: instance.project.id, ref: instance.project.ref },

  skewBoundSeconds: instance.skewBoundSeconds,
  backfillMaxAgeDays: instance.backfillMaxAgeDays,

  recordRetentionDays: instance.recordRetentionDays,
  contentRetentionDays: instance.contentRetentionDays,
  usageRetentionDays: instance.usageRetentionDays,

  settings: instance.settings,

  archivedAt: instance.archivedAt,
  createdAt: instance.createdAt,
  updatedAt: instance.updatedAt
});
