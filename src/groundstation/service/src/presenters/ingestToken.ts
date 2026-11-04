import type { IngestToken, Tenant } from '../../prisma/generated/client';

export let ingestTokenPresenter = (ingestToken: IngestToken & { tenant: Tenant }) => ({
  object: 'groundstation#ingest_token',

  id: ingestToken.id,
  tenantRef: ingestToken.tenant.ref,
  prefix: ingestToken.prefix,

  name: ingestToken.name,
  principalRef: ingestToken.principalRef,

  contentPolicy: ingestToken.contentPolicy,
  limits: ingestToken.limits,
  allowedClients: ingestToken.allowedClients,
  allowedChannels: ingestToken.allowedChannels,

  lastUsedAt: ingestToken.lastUsedAt,
  expiresAt: ingestToken.expiresAt,
  revokedAt: ingestToken.revokedAt,
  createdAt: ingestToken.createdAt
});
