import { describe, expect, it } from 'vitest';
import {
  authenticateStoredSlateRuntimeIdentity,
  deriveSlateRuntimeIdentitySecret,
  rotateSlateRuntimeIdentity
} from './runtimeIdentity';

describe('authenticated Slate runtime identities', () => {
  it('rotates deployment credentials and invalidates the previous identity binding', () => {
    let first = rotateSlateRuntimeIdentity({
      deploymentId: 'deployment-1',
      previousGeneration: 0,
      rootSecret: 'root-secret'
    });
    let second = rotateSlateRuntimeIdentity({
      deploymentId: 'deployment-1',
      previousGeneration: first.runtimeIdentityGeneration,
      rootSecret: 'root-secret'
    });

    expect(second.runtimeIdentityId).not.toBe(first.runtimeIdentityId);
    expect(second.runtimeIdentityGeneration).toBe(2);
    expect(second.secret).not.toBe(first.secret);
    expect(
      deriveSlateRuntimeIdentitySecret('root-secret', {
        deploymentId: 'deployment-2',
        runtimeIdentityId: second.runtimeIdentityId,
        runtimeIdentityGeneration: second.runtimeIdentityGeneration
      })
    ).not.toBe(second.secret);
  });

  it('authenticates only the current active deployment identity and rejects revocation', () => {
    let identity = {
      deploymentId: 'deployment-1',
      runtimeIdentityId: 'runtime-1',
      runtimeIdentityGeneration: 3,
      status: 'succeeded',
      runtimeIdentityRevokedAt: null
    };
    expect(authenticateStoredSlateRuntimeIdentity('root-secret', identity)).toMatchObject({
      context: {
        serviceActorId: 'slates_function_bay_runtime',
        deploymentId: 'deployment-1',
        runtimeIdentityId: 'runtime-1',
        runtimeIdentityGeneration: 3
      }
    });
    expect(() =>
      authenticateStoredSlateRuntimeIdentity('root-secret', {
        ...identity,
        runtimeIdentityRevokedAt: new Date()
      })
    ).toThrow('invalid or revoked');
    expect(() =>
      authenticateStoredSlateRuntimeIdentity('root-secret', {
        ...identity,
        status: 'pending'
      })
    ).toThrow('invalid or revoked');
  });
});
