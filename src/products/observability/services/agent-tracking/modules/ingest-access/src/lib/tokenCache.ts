import { createCachedFunction } from '@lowerdeck/cache';
import type { CredentialKind } from '@mtsrc/agent-tracking-spec';
import { db } from '@mtsrc/agent-tracking-db';
import { env } from '../env';
import { isIngestScopeArchived, sourcePrincipal, tokenPrincipal } from './buildPrincipal';
import type { IngestPrincipal } from '@mtsrc/agent-tracking-records-model';

let cacheTtlSeconds = 300;
let negativeCacheTtlSeconds = 30;

let scopeInclude = {
  organization: true,
  instance: { include: { project: true } }
} as const;

export type CachedIngestCredential = {
  kind: CredentialKind;
  id: string;
  secretHash: string;

  expiresAt: Date | null;
  revokedAt: Date | null;

  principal: IngestPrincipal;
};

export let organizationCacheTag = (organizationId: string) => `organization:${organizationId}`;

export let instanceCacheTag = (instanceId: string) => `instance:${instanceId}`;

let loadToken = async (prefix: string): Promise<CachedIngestCredential | null> => {
  let ingestToken = await db.ingestToken.findUnique({
    where: { prefix },
    include: { ...scopeInclude, userEntity: true, deviceEntity: true, agentEntity: true }
  });
  if (!ingestToken || isIngestScopeArchived(ingestToken)) return null;

  return {
    kind: 'token',
    id: ingestToken.id,
    secretHash: ingestToken.secretHash,

    expiresAt: ingestToken.expiresAt,
    revokedAt: ingestToken.revokedAt,

    principal: tokenPrincipal(ingestToken)
  };
};

let loadSource = async (prefix: string): Promise<CachedIngestCredential | null> => {
  let ingestSource = await db.ingestSource.findUnique({
    where: { prefix },
    include: scopeInclude
  });
  if (!ingestSource || isIngestScopeArchived(ingestSource)) return null;

  return {
    kind: 'source',
    id: ingestSource.id,
    secretHash: ingestSource.secretHash,

    expiresAt: null,
    revokedAt: ingestSource.revokedAt,

    principal: sourcePrincipal(ingestSource)
  };
};

export let getCachedIngestCredential = createCachedFunction<
  { kind: CredentialKind; prefix: string },
  CachedIngestCredential | null
>({
  name: 'agent-tracking/ingest-credential',
  redisUrl: env.service.REDIS_URL,
  ttlSeconds: cacheTtlSeconds,
  getHash: i => `${i.kind}:${i.prefix}`,
  getTags: o =>
    o
      ? [
          organizationCacheTag(o.principal.organization.id),
          instanceCacheTag(o.principal.instance.id)
        ]
      : [],

  provider: async (i, { setTTL }) => {
    let credential =
      i.kind == 'source' ? await loadSource(i.prefix) : await loadToken(i.prefix);
    if (!credential) setTTL(negativeCacheTtlSeconds);

    return credential;
  }
});

export let clearCachedIngestScope = async (d: {
  organizationId?: string;
  instanceIds?: string[];
}) => {
  if (d.organizationId) {
    await getCachedIngestCredential.clearByTagAndWait(organizationCacheTag(d.organizationId));
  }

  for (let instanceId of d.instanceIds ?? []) {
    await getCachedIngestCredential.clearByTagAndWait(instanceCacheTag(instanceId));
  }
};
