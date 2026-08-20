import { createHmac, randomUUID } from 'node:crypto';

export let SLATES_RUNTIME_IDENTITY_HEADER = 'x-slates-runtime-identity-id';

export type SlateRuntimeIdentity = {
  deploymentId: string;
  runtimeIdentityId: string;
  runtimeIdentityGeneration: number;
};

export type StoredSlateRuntimeIdentity = SlateRuntimeIdentity & {
  status: string;
  runtimeIdentityRevokedAt: Date | null;
};

export let deriveSlateRuntimeIdentitySecret = (
  rootSecret: string,
  identity: SlateRuntimeIdentity
) => {
  if (
    !rootSecret ||
    !identity.deploymentId ||
    !identity.runtimeIdentityId ||
    !Number.isInteger(identity.runtimeIdentityGeneration) ||
    identity.runtimeIdentityGeneration <= 0
  ) {
    throw new Error('Slate runtime identity material is invalid');
  }
  return createHmac('sha256', rootSecret)
    .update(
      [
        'slates-runtime-identity-v1',
        identity.deploymentId,
        identity.runtimeIdentityId,
        identity.runtimeIdentityGeneration
      ].join(':')
    )
    .digest('base64url');
};

export let rotateSlateRuntimeIdentity = (d: {
  deploymentId: string;
  previousGeneration: number;
  rootSecret: string;
}) => {
  let identity = {
    deploymentId: d.deploymentId,
    runtimeIdentityId: randomUUID(),
    runtimeIdentityGeneration: d.previousGeneration + 1
  };
  return {
    ...identity,
    secret: deriveSlateRuntimeIdentitySecret(d.rootSecret, identity)
  };
};

export let authenticateStoredSlateRuntimeIdentity = (
  rootSecret: string,
  identity: StoredSlateRuntimeIdentity
) => {
  if (identity.status !== 'succeeded' || identity.runtimeIdentityRevokedAt) {
    throw new Error('Slate runtime identity is invalid or revoked');
  }
  return {
    secret: deriveSlateRuntimeIdentitySecret(rootSecret, identity),
    context: {
      serviceActorId: 'slates_function_bay_runtime' as const,
      deploymentId: identity.deploymentId,
      runtimeIdentityId: identity.runtimeIdentityId,
      runtimeIdentityGeneration: identity.runtimeIdentityGeneration
    }
  };
};
