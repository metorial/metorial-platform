import type { Organization, Project } from '@mtsrc/agent-tracking-db';

export let projectPresenter = (project: Project, organization: Organization) => ({
  object: 'agent_tracking#project',

  id: project.id,
  ref: project.ref,
  name: project.name,

  organizationId: organization.id,

  recordRetentionDays: project.recordRetentionDays,
  contentRetentionDays: project.contentRetentionDays,
  usageRetentionDays: project.usageRetentionDays,

  archivedAt: project.archivedAt,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt
});
