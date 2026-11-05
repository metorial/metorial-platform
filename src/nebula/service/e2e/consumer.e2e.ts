import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { nebula } from './client';
import { consumerSecrets, registerConsumer } from './fixtures';

describe('nebula consumers', () => {
  it('registers lowercased consumer instances and refreshes without rotating the nonce', async () => {
    let first = await nebula.consumer.register({
      secret: consumerSecrets.worker,
      identifier: 'WORKER-RUNTIME-A'
    });

    let instance = await db.consumerInstance.findUniqueOrThrow({
      where: { id: first.consumerInstanceId },
      include: { consumer: true }
    });
    expect(instance.identifier).toBe('worker-runtime-a');
    expect(instance.consumer.identifier).toBe('worker');

    let refreshed = await nebula.consumer.refresh({
      secret: consumerSecrets.worker,
      token: first.token
    });
    expect(refreshed.consumerInstanceId).toBe(first.consumerInstanceId);

    let updated = await db.consumerInstance.findUniqueOrThrow({
      where: { id: first.consumerInstanceId }
    });
    expect(updated.tokenNonce).toBe(instance.tokenNonce);

    await expect(
      nebula.consumer.refresh({ secret: consumerSecrets.worker, token: first.token })
    ).resolves.toMatchObject({ consumerInstanceId: first.consumerInstanceId });
  });

  it('rejects an unknown registration secret', async () => {
    await expect(
      nebula.consumer.register({ secret: 'not-a-real-secret', identifier: 'nobody' })
    ).rejects.toThrow();
  });

  it('rejects refreshing with the wrong registration secret', async () => {
    let registration = await registerConsumer('worker');

    await expect(
      nebula.consumer.refresh({ secret: consumerSecrets.owner, token: registration.token })
    ).rejects.toThrow('Registration secret does not match consumer');
  });

  it('rejects tampered, expired and revoked consumer tokens', async () => {
    let registration = await registerConsumer('worker');

    await expect(
      nebula.consumer.refresh({
        secret: consumerSecrets.worker,
        token: `${registration.token}x`
      })
    ).rejects.toThrow('Consumer token is invalid');

    await db.consumerInstance.update({
      where: { id: registration.consumerInstanceId },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });
    await expect(
      nebula.consumer.refresh({ secret: consumerSecrets.worker, token: registration.token })
    ).rejects.toThrow('Consumer token has expired');

    let revoked = await registerConsumer('worker');
    await db.consumerInstance.update({
      where: { id: revoked.consumerInstanceId },
      data: { status: 'revoked', revokedAt: new Date() }
    });
    await expect(
      nebula.consumer.refresh({ secret: consumerSecrets.worker, token: revoked.token })
    ).rejects.toThrow('Consumer instance is not active');
  });
});
