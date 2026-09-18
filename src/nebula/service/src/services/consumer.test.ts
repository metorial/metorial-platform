import { JWT } from '@lowerdeck/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Consumer, ConsumerInstance } from '../../prisma/generated/client';

let mocks = vi.hoisted(() => ({ update: vi.fn(), load: vi.fn(), captureException: vi.fn() }));
vi.mock('../db', () => ({ db: { consumerInstance: { update: mocks.update } } }));
vi.mock('../env', () => ({
  consumerInstanceTokenTtlSeconds: 3600,
  consumerRegistrationSecrets: [{ identifier: 'worker', secret: 'worker-secret' }],
  env: {
    consumerAuth: {
      CONSUMER_INSTANCE_TOKEN_SECRET: 'test-secret-with-at-least-thirty-two-characters'
    }
  }
}));
vi.mock('../id', () => ({ ID: {}, snowflake: {} }));
vi.mock('../lib/consumerCache', () => ({
  loadConsumerInstanceForAuth: mocks.load,
  clearConsumerInstanceAuthCache: vi.fn(),
  clearConsumerCache: vi.fn(),
  loadConsumerById: vi.fn(),
  loadConsumerByIdentifier: vi.fn()
}));
vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: mocks.captureException })
}));

import { env } from '../env';
import { consumerService } from './consumer';

let instance: ConsumerInstance & { consumer: Consumer };
let token: string;
let start = new Date('2026-09-18T00:00:00Z');
let authenticate = (value: string) =>
  consumerService.authenticateConsumerInstanceToken({ token: value });
let refresh = () =>
  consumerService.refreshConsumerInstance({ secret: 'worker-secret', token });

describe('consumer token refresh', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(start);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    instance = {
      oid: 1n,
      id: 'instance-1',
      consumerOid: 2n,
      identifier: 'worker-1',
      tokenNonce: 'original-nonce',
      status: 'active',
      createdAt: start,
      updatedAt: start,
      expiresAt: new Date(start.getTime() + 3_600_000),
      lastUsedAt: null,
      revokedAt: null,
      consumer: {
        oid: 2n,
        id: 'consumer-1',
        identifier: 'worker',
        name: 'Worker',
        status: 'active',
        createdAt: start,
        updatedAt: start
      }
    };
    mocks.load.mockImplementation(async () => ({ ...instance }));
    mocks.update.mockImplementation(async ({ where, data }) => {
      if (
        (where.tokenNonce && where.tokenNonce !== instance.tokenNonce) ||
        (where.status && where.status !== instance.status) ||
        (where.revokedAt === null && instance.revokedAt !== null) ||
        (where.expiresAt && instance.expiresAt <= where.expiresAt.gt)
      )
        throw new Error('Record to update not found');
      instance = { ...instance, ...data };
      return { ...instance };
    });
    token = await JWT.sign(
      {
        type: 'nebula_consumer_instance',
        consumerId: instance.consumer.id,
        consumerInstanceId: instance.id,
        nonce: instance.tokenNonce
      },
      {
        issuer: 'nebula',
        audience: 'nebula_consumer_instance',
        expiresIn: 3600,
        alg: 'HS256'
      },
      env.consumerAuth.CONSUMER_INSTANCE_TOKEN_SECRET
    );
    vi.setSystemTime(new Date(start.getTime() + 3_480_000));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('accepts a request carrying the old token after refresh has committed', async () => {
    let refreshed = await refresh();
    await expect(authenticate(token)).resolves.toBeDefined();
    await expect(authenticate(refreshed.token)).resolves.toBeDefined();
    expect(mocks.captureException).not.toHaveBeenCalled();
  });

  it('does not let overlapping refreshes invalidate each other', async () => {
    let refreshed = await Promise.all([refresh(), refresh()]);
    for (let result of refreshed)
      await expect(authenticate(result.token)).resolves.toBeDefined();
    await expect(authenticate(token)).resolves.toBeDefined();
  });

  it('still expires the original JWT even though the instance was extended', async () => {
    let refreshed = await refresh();
    vi.setSystemTime(new Date(start.getTime() + 3_600_001));
    await expect(authenticate(token)).rejects.toThrow('Consumer token is invalid');
    await expect(authenticate(refreshed.token)).resolves.toBeDefined();
  });

  it.each(['revocation', 'nonce change', 'expiry'])(
    'does not overwrite a concurrent %s after authentication',
    async change => {
      mocks.update.mockImplementationOnce(async ({ data }) => {
        instance = { ...instance, ...data };
        let result = { ...instance };
        if (change === 'revocation') {
          instance.status = 'revoked';
          instance.revokedAt = new Date();
        } else if (change === 'nonce change') {
          instance.tokenNonce = 'revoked-nonce';
        } else {
          instance.expiresAt = new Date();
        }
        return result;
      });
      await expect(refresh()).rejects.toThrow('Unable to refresh consumer instance');
      await expect(authenticate(token)).rejects.toThrow();
    }
  );

  it('rejects both old and refreshed tokens after revocation', async () => {
    let refreshed = await refresh();
    instance.status = 'revoked';
    instance.revokedAt = new Date();
    await expect(authenticate(token)).rejects.toThrow('Consumer instance is not active');
    await expect(authenticate(refreshed.token)).rejects.toThrow(
      'Consumer instance is not active'
    );
  });

  it('requires the registration secret to refresh', async () => {
    await expect(
      consumerService.refreshConsumerInstance({ token, secret: 'wrong-secret' })
    ).rejects.toThrow('Registration secret does not match consumer');
    expect(instance.expiresAt.getTime()).toBe(start.getTime() + 3_600_000);
  });
});
