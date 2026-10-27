import { ServiceError, tooManyRequestsError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { createLocallyCachedFunction } from '@metorial/cache';
import { db, type Instance } from '@metorial/db';
import {
  allowAllRateLimitProvider,
  getRateLimitProvider,
  getRateLimitUsageType,
  type RateLimitProviderParams,
  type RateLimitResult,
  type RateLimitScope,
  type RateLimitUsageInput
} from '../definitions';

let SCOPE_CACHE_TTL_SECONDS = 60 * 10;

export type RateLimitTarget =
  RateLimitScope | { instance: Pick<Instance, 'oid'> } | { projectOid: bigint };

export type RateLimitServiceParams = RateLimitTarget & { usages: RateLimitUsageInput[] };

let ALLOWED: RateLimitResult = { allowed: true };

let getProjectScope = createLocallyCachedFunction({
  getHash: (d: { projectOid: bigint }) => d.projectOid.toString(),
  ttlSeconds: SCOPE_CACHE_TTL_SECONDS,
  provider: async (d): Promise<RateLimitScope> => {
    let project = await db.project.findUniqueOrThrow({
      where: { oid: d.projectOid },
      select: { id: true, oid: true, organization: { select: { id: true, oid: true } } }
    });

    return {
      organization: project.organization,
      project: { id: project.id, oid: project.oid }
    };
  }
});

let getInstanceProjectOid = createLocallyCachedFunction({
  getHash: (d: { instanceOid: bigint }) => d.instanceOid.toString(),
  ttlSeconds: SCOPE_CACHE_TTL_SECONDS,
  provider: async d => {
    let instance = await db.instance.findUniqueOrThrow({
      where: { oid: d.instanceOid },
      select: { projectOid: true }
    });

    return instance.projectOid;
  }
});

let resolveScope = async (d: RateLimitTarget): Promise<RateLimitScope> => {
  if ('instance' in d) {
    let projectOid = await getInstanceProjectOid({ instanceOid: d.instance.oid });
    return await getProjectScope({ projectOid });
  }

  if ('projectOid' in d) return await getProjectScope({ projectOid: d.projectOid });

  return { organization: d.organization, project: d.project };
};

let resolveParams = async (d: RateLimitServiceParams): Promise<RateLimitProviderParams> => ({
  ...(await resolveScope(d)),
  usages: d.usages
});

let isActive = (d: RateLimitServiceParams) =>
  d.usages.length > 0 && getRateLimitProvider() !== allowAllRateLimitProvider;

export let rateLimitExceededError = (result: Extract<RateLimitResult, { allowed: false }>) => {
  let usage = getRateLimitUsageType(result.key);
  let retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));

  return new ServiceError(
    tooManyRequestsError({
      code: 'rate_limit_exceeded',
      message: `The ${usage?.name.toLowerCase() ?? result.key} rate limit for this project has been reached.`,
      hint: `Try again in ${retryAfterSeconds} second${retryAfterSeconds == 1 ? '' : 's'}, or contact support to raise your limits.`,
      usageType: result.key,
      window: result.window,
      retryAfterMs: result.retryAfterMs,
      limit: result.limit
    })
  );
};

class RateLimitServiceImpl {
  async consume(d: RateLimitServiceParams) {
    let result = await this.tryConsume(d);
    if (!result.allowed) throw rateLimitExceededError(result);
  }

  async tryConsume(d: RateLimitServiceParams) {
    if (!isActive(d)) return ALLOWED;

    return await getRateLimitProvider().consume(await resolveParams(d));
  }

  async check(d: RateLimitServiceParams) {
    if (!isActive(d)) return ALLOWED;

    return await getRateLimitProvider().check(await resolveParams(d));
  }

  async refund(d: RateLimitServiceParams) {
    if (!isActive(d)) return;

    await getRateLimitProvider().refund(await resolveParams(d));
  }
}

export let rateLimitService = Service.create(
  'rateLimit',
  () => new RateLimitServiceImpl()
).build();
