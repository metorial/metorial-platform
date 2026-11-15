import type { IngestSource, Instance, Organization, Project } from '@mtsrc/agent-tracking-db';

export let ingestSourcePresenter = (
  ingestSource: IngestSource & {
    organization: Organization;
    instance: Instance & { project: Project };
  }
) => ({
  object: 'agent_tracking#ingest_source',

  id: ingestSource.id,
  prefix: ingestSource.prefix,
  name: ingestSource.name,
  family: ingestSource.family,

  organizationId: ingestSource.organization.id,
  instance: {
    id: ingestSource.instance.id,
    ref: ingestSource.instance.ref,
    projectId: ingestSource.instance.project.id
  },

  tags: ingestSource.tags,

  contentPolicy: ingestSource.contentPolicy,
  limits: ingestSource.limits,
  allowedChannels: ingestSource.allowedChannels,
  newUserLimitPerDay: ingestSource.newUserLimitPerDay,

  lastUsedAt: ingestSource.lastUsedAt,
  revokedAt: ingestSource.revokedAt,
  createdAt: ingestSource.createdAt,
  updatedAt: ingestSource.updatedAt
});
