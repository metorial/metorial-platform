import { createHash } from 'node:crypto';
import { createRedisClient } from '@lowerdeck/redis';
import { deriveBoundRpcSignatureToken, rpcSignatureHeader } from '@lowerdeck/rpc-signature';

export let coreCallbackSecurityContextHeader = 'metorial-core-callback-security-context';
export let coreCallbackSecurityKeyIdHeader = 'metorial-core-callback-security-key-id';

export type CoreCallbackSecurityContext = {
  version: 1;
  audience: 'subspace_callback_security';
  serviceActorId: 'metorial_core';
  trustedActorId: string;
  sourceRequestId: string;
  sourceRequestIp?: string;
  sourceRequestUserAgent?: string;
};

let bounded = (value: unknown, max: number) =>
  typeof value == 'string' && value.length > 0 && value.length <= max;

export let parseCoreCallbackSecurityContext = (
  encoded: string | null
): CoreCallbackSecurityContext => {
  if (!encoded || encoded.length > 2048) {
    throw new Error('Core callback-security context is missing or oversized');
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Core callback-security context is malformed');
  }
  if (!value || typeof value != 'object' || Array.isArray(value)) {
    throw new Error('Core callback-security context is malformed');
  }
  let context = value as Record<string, unknown>;
  let allowed = new Set([
    'version',
    'audience',
    'serviceActorId',
    'trustedActorId',
    'sourceRequestId',
    'sourceRequestIp',
    'sourceRequestUserAgent'
  ]);
  if (Object.keys(context).some(key => !allowed.has(key))) {
    throw new Error('Core callback-security context has unknown fields');
  }
  if (
    context.version !== 1 ||
    context.audience !== 'subspace_callback_security' ||
    context.serviceActorId !== 'metorial_core' ||
    !bounded(context.trustedActorId, 160) ||
    !bounded(context.sourceRequestId, 160) ||
    (context.sourceRequestIp !== undefined && !bounded(context.sourceRequestIp, 128)) ||
    (context.sourceRequestUserAgent !== undefined &&
      !bounded(context.sourceRequestUserAgent, 512))
  ) {
    throw new Error('Core callback-security context is invalid');
  }
  return context as CoreCallbackSecurityContext;
};

let tokenForKeyId = (keyId: string | null) => {
  if (keyId === 'current') return process.env.SUBSPACE_CORE_RPC_TOKEN_CURRENT;
  if (keyId === 'previous') return process.env.SUBSPACE_CORE_RPC_TOKEN_PREVIOUS;
  return undefined;
};

export let getCoreCallbackSecuritySignatureToken = async (request: Request) => {
  let encoded = request.headers.get(coreCallbackSecurityContextHeader);
  let context = parseCoreCallbackSecurityContext(encoded);
  let rootToken = tokenForKeyId(request.headers.get(coreCallbackSecurityKeyIdHeader));
  if (!rootToken) throw new Error('Core callback-security credential is unavailable');
  return {
    secret: await deriveBoundRpcSignatureToken(rootToken, encoded!),
    context: { coreCallbackSecurity: context }
  };
};

export type CoreCallbackSecurityReplayStore = {
  claim: (key: string, ttlMs: number) => Promise<boolean>;
};

let replayStoreOverride: CoreCallbackSecurityReplayStore | null = null;
let getRedis = createRedisClient({
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379/0'
}).lazy();

export let configureCoreCallbackSecurityReplayStoreForTest = (
  store: CoreCallbackSecurityReplayStore | null
) => {
  replayStoreOverride = store;
};

let productionReplayStore: CoreCallbackSecurityReplayStore = {
  async claim(key, ttlMs) {
    if (!process.env.REDIS_URL) {
      throw new Error('Core callback-security replay store is unavailable');
    }
    let redis = await getRedis();
    return (await redis.set(key, '1', { NX: true, PX: ttlMs })) === 'OK';
  }
};

export let claimCoreCallbackSecurityRequest = async (
  request: Request,
  context: Record<string, unknown> | undefined
) => {
  if (!context?.coreCallbackSecurity) {
    throw new Error('Core callback-security signature context is missing');
  }
  let signature = request.headers.get(rpcSignatureHeader);
  if (!signature) throw new Error('Core callback-security signature is missing');
  let replayKey = `subspace:core-callback-security:replay:${createHash('sha256')
    .update(signature)
    .digest('hex')}`;
  let claimed = await (replayStoreOverride ?? productionReplayStore).claim(replayKey, 120_000);
  if (!claimed) throw new Error('Core callback-security request was replayed');
};
