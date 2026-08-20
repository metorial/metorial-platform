import { createHash } from 'node:crypto';
import { createRedisClient } from '@lowerdeck/redis';
import { rpcSignatureHeader } from '@lowerdeck/rpc-signature';
import { db } from '../../db';
import { env } from '../../env';
import {
  authenticateStoredSlateRuntimeIdentity,
  SLATES_RUNTIME_IDENTITY_HEADER
} from '../../lib/invocation/runtimeIdentity';

export let slatesHubSecretKeyIdHeader = 'metorial-subspace-secret-key-id';

let subspaceTokenForKeyId = (keyId: string | null) => {
  if (keyId === 'current') {
    return env.slates.SLATES_HUB_SUBSPACE_SECRET_RPC_TOKEN_CURRENT;
  }
  if (keyId === 'previous') {
    return env.slates.SLATES_HUB_SUBSPACE_SECRET_RPC_TOKEN_PREVIOUS;
  }
  return undefined;
};

export let getSlatesHubSecretRpcSignatureToken = async (request: Request) => {
  let runtimeIdentityId = request.headers.get(SLATES_RUNTIME_IDENTITY_HEADER);
  if (runtimeIdentityId) {
    let token = env.slates.SLATES_HUB_SECRET_RPC_TOKEN;
    if (!token) throw new Error('Authenticated runtime secret RPC token is not configured');
    let deployment = await db.slateDeployment.findUnique({
      where: { runtimeIdentityId },
      select: {
        id: true,
        status: true,
        runtimeIdentityId: true,
        runtimeIdentityGeneration: true,
        runtimeIdentityRevokedAt: true
      }
    });
    if (
      !deployment?.runtimeIdentityId ||
      deployment.status !== 'succeeded' ||
      deployment.runtimeIdentityRevokedAt
    ) {
      throw new Error('Slate runtime identity is invalid or revoked');
    }
    return authenticateStoredSlateRuntimeIdentity(token, {
      deploymentId: deployment.id,
      runtimeIdentityId: deployment.runtimeIdentityId,
      runtimeIdentityGeneration: deployment.runtimeIdentityGeneration,
      status: deployment.status,
      runtimeIdentityRevokedAt: deployment.runtimeIdentityRevokedAt
    });
  }
  let keyId = request.headers.get(slatesHubSecretKeyIdHeader);
  let subspaceToken = subspaceTokenForKeyId(keyId);
  if (subspaceToken) {
    return {
      secret: subspaceToken,
      context: { serviceActorId: 'subspace_callback_security' }
    };
  }
  if (keyId === 'hub-internal') {
    let token = env.slates.SLATES_HUB_SECRET_RPC_TOKEN;
    if (!token) throw new Error('Authenticated internal secret RPC token is not configured');
    return { secret: token, context: { serviceActorId: 'slates_hub_internal_service' } };
  }
  throw new Error('Authenticated secret RPC key ID is invalid');
};

export type SlatesHubSecretReplayStore = {
  claim: (key: string, ttlMs: number) => Promise<boolean>;
};

let replayStoreOverride: SlatesHubSecretReplayStore | null = null;
let getRedis = createRedisClient({ redisUrl: env.service.REDIS_URL }).lazy();

export let configureSlatesHubSecretReplayStoreForTest = (
  store: SlatesHubSecretReplayStore | null
) => {
  replayStoreOverride = store;
};

let productionReplayStore: SlatesHubSecretReplayStore = {
  async claim(key, ttlMs) {
    let redis = await getRedis();
    return (await redis.set(key, '1', { NX: true, PX: ttlMs })) === 'OK';
  }
};

export let claimSlatesHubSecretRpcRequest = async (request: Request) => {
  let signature = request.headers.get(rpcSignatureHeader);
  if (!signature) throw new Error('Authenticated secret RPC signature is missing');
  let replayKey = `slates:secret-rpc:replay:${createHash('sha256')
    .update(signature)
    .digest('hex')}`;
  let claimed = await (replayStoreOverride ?? productionReplayStore).claim(replayKey, 120_000);
  if (!claimed) throw new Error('Authenticated secret RPC request was replayed');
};
