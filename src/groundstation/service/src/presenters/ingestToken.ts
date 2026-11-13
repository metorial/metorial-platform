import type {
  Entity,
  IngestToken,
  Instance,
  Organization,
  Project
} from '../../prisma/generated/client';

export let ingestTokenPresenter = (
  ingestToken: IngestToken & {
    organization: Organization;
    instance: Instance & { project: Project };
    userEntity: Entity;
    deviceEntity: Entity | null;
    agentEntity: Entity | null;
  }
) => ({
  object: 'groundstation#ingest_token',

  id: ingestToken.id,
  prefix: ingestToken.prefix,
  name: ingestToken.name,

  organizationId: ingestToken.organization.id,
  instance: {
    id: ingestToken.instance.id,
    ref: ingestToken.instance.ref,
    projectId: ingestToken.instance.project.id
  },

  userRef: ingestToken.userRef,
  deviceRef: ingestToken.deviceRef,
  deviceMode: ingestToken.deviceMode,
  agentRef: ingestToken.agentRef,

  userEntityId: ingestToken.userEntity.id,
  deviceEntityId: ingestToken.deviceEntity?.id ?? null,
  agentEntityId: ingestToken.agentEntity?.id ?? null,

  tags: ingestToken.tags,

  contentPolicy: ingestToken.contentPolicy,
  limits: ingestToken.limits,
  allowedClients: ingestToken.allowedClients,
  allowedChannels: ingestToken.allowedChannels,

  lastUsedAt: ingestToken.lastUsedAt,
  expiresAt: ingestToken.expiresAt,
  revokedAt: ingestToken.revokedAt,
  createdAt: ingestToken.createdAt
});
