import type {
  Entity,
  IngestSource,
  IngestToken,
  Instance,
  Organization,
  Project
} from '@mtsrc/agent-tracking-db';
import type { IngestChannel } from '@mtsrc/agent-tracking-spec';
import type { IngestPrincipal } from '@mtsrc/agent-tracking-records-model';

type ScopedInstance = Instance & { project: Project };

export type IngestTokenForPrincipal = IngestToken & {
  organization: Organization;
  instance: ScopedInstance;
  userEntity: Entity;
  deviceEntity: Entity | null;
  agentEntity: Entity | null;
};

export type IngestSourceForPrincipal = IngestSource & {
  organization: Organization;
  instance: ScopedInstance;
};

export let isIngestScopeArchived = (d: {
  organization: Pick<Organization, 'archivedAt'>;
  instance: Pick<Instance, 'archivedAt'> & { project: Pick<Project, 'archivedAt'> };
}) => !!(d.organization.archivedAt || d.instance.project.archivedAt || d.instance.archivedAt);

let scopePrincipal = (d: { organization: Organization; instance: ScopedInstance }) => ({
  organization: {
    id: d.organization.id,
    ref: d.organization.ref,
    hashKeyVersion: d.organization.hashKeyVersion,
    contentKeyVersion: d.organization.contentKeyVersion,
    settings: d.organization.settings
  },

  project: { id: d.instance.project.id, ref: d.instance.project.ref },

  instance: {
    id: d.instance.id,
    ref: d.instance.ref,
    skewBoundSeconds: d.instance.skewBoundSeconds,
    backfillMaxAgeDays: d.instance.backfillMaxAgeDays,
    recordRetentionDays: d.instance.recordRetentionDays,
    contentRetentionDays: d.instance.contentRetentionDays,
    usageRetentionDays: d.instance.usageRetentionDays,
    settings: d.instance.settings
  }
});

export let tokenPrincipal = (ingestToken: IngestTokenForPrincipal): IngestPrincipal => ({
  credential: { kind: 'token', id: ingestToken.id },

  contentPolicy: ingestToken.contentPolicy,
  limits: ingestToken.limits,
  allowedClients: ingestToken.allowedClients,
  allowedChannels: ingestToken.allowedChannels as IngestChannel[],

  tags: ingestToken.tags,

  binding: {
    userId: ingestToken.userEntity.id,
    deviceId: ingestToken.deviceEntity?.id,
    deviceMode: ingestToken.deviceMode,
    agentId: ingestToken.agentEntity?.id
  },

  ...scopePrincipal(ingestToken)
});

export let sourcePrincipal = (ingestSource: IngestSourceForPrincipal): IngestPrincipal => ({
  credential: { kind: 'source', id: ingestSource.id, family: ingestSource.family },

  contentPolicy: ingestSource.contentPolicy,
  limits: ingestSource.limits,
  allowedClients: [],
  allowedChannels: ingestSource.allowedChannels as IngestChannel[],

  tags: ingestSource.tags,

  binding: { deviceMode: 'vendor' },

  ...scopePrincipal(ingestSource),

  newUserLimitPerDay: ingestSource.newUserLimitPerDay
});
