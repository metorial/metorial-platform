import { createCachedFunction } from '@lowerdeck/cache';
import type { ContentPolicy, IngestTokenLimits } from '@metorial/groundstation-spec';
import { db } from '../db';
import { env } from '../env';

let cacheTtlSeconds = 300;
let negativeCacheTtlSeconds = 30;

export type CachedIngestToken = {
  id: string;
  secretHash: string;

  principalRef: string | null;
  contentPolicy: ContentPolicy;
  limits: IngestTokenLimits;
  allowedClients: string[];
  allowedChannels: string[];

  expiresAt: Date | null;
  revokedAt: Date | null;

  tenant: {
    id: string;
    ref: string;
    skewBoundSeconds: number;
    backfillMaxAgeDays: number | null;
    hashKeyVersion: number;
    recordRetentionDays: number;
    contentRetentionDays: number;
    contentKeyVersion: number;
  };
};

export let tenantCacheTag = (tenantId: string) => `tenant:${tenantId}`;

export let getCachedIngestToken = createCachedFunction<
  { prefix: string },
  CachedIngestToken | null
>({
  name: 'groundstation/ingest-token',
  redisUrl: env.service.REDIS_URL,
  ttlSeconds: cacheTtlSeconds,
  getHash: i => i.prefix,
  getTags: o => (o ? [tenantCacheTag(o.tenant.id)] : []),

  provider: async (i, { setTTL }) => {
    let ingestToken = await db.ingestToken.findUnique({
      where: { prefix: i.prefix },
      include: { tenant: true }
    });

    if (!ingestToken) {
      setTTL(negativeCacheTtlSeconds);
      return null;
    }

    return {
      id: ingestToken.id,
      secretHash: ingestToken.secretHash,

      principalRef: ingestToken.principalRef,
      contentPolicy: ingestToken.contentPolicy,
      limits: ingestToken.limits,
      allowedClients: ingestToken.allowedClients,
      allowedChannels: ingestToken.allowedChannels,

      expiresAt: ingestToken.expiresAt,
      revokedAt: ingestToken.revokedAt,

      tenant: {
        id: ingestToken.tenant.id,
        ref: ingestToken.tenant.ref,
        skewBoundSeconds: ingestToken.tenant.skewBoundSeconds,
        backfillMaxAgeDays: ingestToken.tenant.backfillMaxAgeDays,
        hashKeyVersion: ingestToken.tenant.hashKeyVersion,
        recordRetentionDays: ingestToken.tenant.recordRetentionDays,
        contentRetentionDays: ingestToken.tenant.contentRetentionDays,
        contentKeyVersion: ingestToken.tenant.contentKeyVersion
      }
    };
  }
});
