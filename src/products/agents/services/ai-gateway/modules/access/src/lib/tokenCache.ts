import { createCachedFunction } from '@lowerdeck/cache';
import { db } from '@mtsrc/ai-gateway-db';
import type { GatewayPrincipal } from '@mtsrc/ai-gateway-spec';
import { env } from '../env';
import { isTokenScopeArchived, tokenPrincipal } from './buildPrincipal';

let cacheTtlSeconds = 300;
let negativeCacheTtlSeconds = 30;

export type CachedGatewayToken = {
  id: string;
  secretHash: string;

  expiresAt: Date | null;
  revokedAt: Date | null;

  principal: GatewayPrincipal;
};

export let organizationCacheTag = (organizationId: string) => `organization:${organizationId}`;

export let instanceCacheTag = (instanceId: string) => `instance:${instanceId}`;

export let getCachedGatewayToken = createCachedFunction<
  { prefix: string },
  CachedGatewayToken | null
>({
  name: 'ai-gateway/gateway-token',
  redisUrl: env.service.REDIS_URL,
  ttlSeconds: cacheTtlSeconds,
  getHash: i => i.prefix,
  getTags: o =>
    o
      ? [
          organizationCacheTag(o.principal.organization.id),
          instanceCacheTag(o.principal.instance.id)
        ]
      : [],

  provider: async (i, { setTTL }) => {
    let gatewayToken = await db.gatewayToken.findUnique({
      where: { prefix: i.prefix },
      include: { organization: true, instance: { include: { project: true } } }
    });
    if (!gatewayToken || isTokenScopeArchived(gatewayToken)) {
      setTTL(negativeCacheTtlSeconds);
      return null;
    }

    return {
      id: gatewayToken.id,
      secretHash: gatewayToken.secretHash,

      expiresAt: gatewayToken.expiresAt,
      revokedAt: gatewayToken.revokedAt,

      principal: tokenPrincipal(gatewayToken)
    };
  }
});

export let clearCachedTokenScope = async (d: {
  organizationId?: string;
  instanceIds?: string[];
}) => {
  if (d.organizationId) {
    await getCachedGatewayToken.clearByTagAndWait(organizationCacheTag(d.organizationId));
  }

  for (let instanceId of d.instanceIds ?? []) {
    await getCachedGatewayToken.clearByTagAndWait(instanceCacheTag(instanceId));
  }
};
