import { beforeEach, describe, expect, it } from 'vitest';
import { nebulaClient } from '../../test/client';
import { cleanDatabase, testDb } from '../../test/setup';
import { consumerService } from '../../services';

let createTenant = (identifier = 'tenant-a') =>
  nebulaClient.tenant.upsert({
    identifier,
    name: identifier
  });

let registerWorker = (secret = 'worker-secret', identifier = 'WORKER-INSTANCE') =>
  nebulaClient.consumer.register({
    secret,
    identifier
  });

describe('secret E2E', () => {
  beforeEach(async () => {
    await cleanDatabase();
    await consumerService.ensureEnvConsumers();
  });

  it('stores and uses a secret with the correct proof', async () => {
    let tenant = await createTenant();
    let registration = await registerWorker();
    let consumer = await testDb.consumer.findUniqueOrThrow({ where: { identifier: 'worker' } });

    let secret = await nebulaClient.secret.create({
      tenantId: tenant.id,
      consumerToken: registration.token,
      purpose: 'database_password',
      secret: 'high-entropy-secret-value-1',
      proof: { binding: 'db', nonce: 'proof-1' },
      encryptionContext: { service: 'database' }
    });

    let used = await nebulaClient.secret.use({
      tenantId: tenant.id,
      consumerToken: registration.token,
      secretId: secret.id,
      proof: { binding: 'db', nonce: 'proof-1' },
      note: 'Read database password for connection test'
    });

    expect(used).toMatchObject({
      object: 'nebula#secret_use',
      secretId: secret.id,
      plaintext: 'high-entropy-secret-value-1'
    });
    let useRecord = await testDb.secretUse.findFirstOrThrow();
    let instance = await testDb.consumerInstance.findUniqueOrThrow({
      where: { id: registration.consumerInstanceId }
    });
    expect(useRecord.consumerInstanceOid).toBe(instance.oid);

    await expect(
      nebulaClient.secret.use({
        tenantId: tenant.id,
        consumerToken: registration.token,
        secretId: secret.id,
        proof: { binding: 'db', nonce: 'wrong' },
        note: 'Attempt with wrong proof'
      })
    ).rejects.toThrow('Unable to use secret');
  });

  it('locks a secret to the creating consumer', async () => {
    let tenant = await createTenant('tenant-consumer-lock');
    let ownerRegistration = await registerWorker('owner-secret', 'OWNER-INSTANCE');
    let otherRegistration = await registerWorker('other-secret', 'OTHER-INSTANCE');
    let owner = await testDb.consumer.findUniqueOrThrow({ where: { identifier: 'owner' } });

    let secret = await nebulaClient.secret.create({
      tenantId: tenant.id,
      consumerToken: ownerRegistration.token,
      purpose: 'locked_secret',
      secret: 'high-entropy-secret-value-locked',
      proof: { binding: 'owner' }
    });

    expect(secret.consumerId).toBe(owner.id);

    await expect(
      nebulaClient.secret.use({
        tenantId: tenant.id,
        consumerToken: otherRegistration.token,
        secretId: secret.id,
        proof: { binding: 'owner' },
        note: 'Attempt access from other consumer'
      })
    ).rejects.toThrow('Unable to use secret');
  });

  it('reuses the current data key for multiple writes in the reuse window', async () => {
    let tenant = await createTenant('tenant-reuse');
    let registration = await registerWorker();

    await nebulaClient.secret.create({
      tenantId: tenant.id,
      consumerToken: registration.token,
      purpose: 'first',
      secret: 'high-entropy-secret-value-2',
      proof: { p: 1 }
    });

    await nebulaClient.secret.create({
      tenantId: tenant.id,
      consumerToken: registration.token,
      purpose: 'second',
      secret: 'high-entropy-secret-value-3',
      proof: { p: 2 }
    });

    let keys = await testDb.key.findMany();
    expect(keys).toHaveLength(1);
  });

  it('does not allow a tenant to use another tenant key provider', async () => {
    let tenantA = await createTenant('tenant-provider-a');
    let tenantB = await createTenant('tenant-provider-b');
    let registration = await registerWorker();

    let provider = await nebulaClient.keyProvider.import({
      tenantId: tenantA.id,
      keyInput: {}
    });

    await expect(
      nebulaClient.secret.create({
        tenantId: tenantB.id,
        consumerToken: registration.token,
        purpose: 'cross_tenant',
        secret: 'high-entropy-secret-value-4',
        proof: { p: 1 },
        keyProviderId: provider.id
      })
    ).rejects.toThrow();
  });

  it('registers lowercased consumer instances and refreshes by rotating the nonce', async () => {
    let first = await registerWorker('worker-secret', 'WORKER-RUNTIME-A');
    let instance = await testDb.consumerInstance.findUniqueOrThrow({
      where: { id: first.consumerInstanceId },
      include: { consumer: true }
    });

    expect(instance.identifier).toBe('worker-runtime-a');
    expect(instance.consumer.identifier).toBe('worker');

    let originalNonce = instance.tokenNonce;
    let refreshed = await nebulaClient.consumer.refresh({
      secret: 'worker-secret',
      token: first.token
    });
    let updated = await testDb.consumerInstance.findUniqueOrThrow({
      where: { id: first.consumerInstanceId }
    });

    expect(refreshed.consumerInstanceId).toBe(first.consumerInstanceId);
    expect(updated.tokenNonce).not.toBe(originalNonce);

    await expect(
      nebulaClient.consumer.refresh({
        secret: 'worker-secret',
        token: first.token
      })
    ).rejects.toThrow('Consumer token has been rotated or revoked');
  });

  it('keeps metadata and key provider operations open without consumer tokens', async () => {
    let tenant = await createTenant('tenant-open-metadata');
    let registration = await registerWorker();
    let secret = await nebulaClient.secret.create({
      tenantId: tenant.id,
      consumerToken: registration.token,
      purpose: 'metadata',
      secret: 'high-entropy-secret-value-5',
      proof: { p: 'metadata' }
    });

    await expect(
      nebulaClient.secret.list({ tenantId: tenant.id, limit: 10 })
    ).resolves.toBeDefined();
    await expect(
      nebulaClient.secret.get({ tenantId: tenant.id, secretId: secret.id })
    ).resolves.toMatchObject({ id: secret.id });
    await expect(
      nebulaClient.keyProvider.list({ tenantId: tenant.id, limit: 10 })
    ).resolves.toBeDefined();
  });

  it('rejects bad, expired, revoked, and wrong-secret consumer tokens generically', async () => {
    let registration = await registerWorker();

    await expect(
      nebulaClient.consumer.refresh({
        secret: 'wrong-secret',
        token: registration.token
      })
    ).rejects.toThrow('Registration secret does not match consumer');

    await expect(
      nebulaClient.consumer.refresh({
        secret: 'worker-secret',
        token: `${registration.token}x`
      })
    ).rejects.toThrow('Consumer token is invalid');

    await testDb.consumerInstance.update({
      where: { id: registration.consumerInstanceId },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });

    await expect(
      nebulaClient.consumer.refresh({
        secret: 'worker-secret',
        token: registration.token
      })
    ).rejects.toThrow('Consumer token has expired');

    let revoked = await registerWorker('worker-secret', 'revoked-worker');
    await testDb.consumerInstance.update({
      where: { id: revoked.consumerInstanceId },
      data: { status: 'revoked', revokedAt: new Date() }
    });

    await expect(
      nebulaClient.consumer.refresh({
        secret: 'worker-secret',
        token: revoked.token
      })
    ).rejects.toThrow('Consumer instance is not active');
  });

  it('disables an active secret and blocks use and update', async () => {
    let tenant = await createTenant('tenant-disable');
    let registration = await registerWorker();

    let secret = await nebulaClient.secret.create({
      tenantId: tenant.id,
      consumerToken: registration.token,
      purpose: 'disable_me',
      secret: 'high-entropy-secret-value-disable',
      proof: { binding: 'disable' }
    });

    let disabled = await nebulaClient.secret.disable({
      tenantId: tenant.id,
      consumerToken: registration.token,
      secretId: secret.id
    });

    expect(disabled).toMatchObject({
      id: secret.id,
      status: 'disabled',
      disabledAt: expect.any(Date)
    });

    await expect(
      nebulaClient.secret.use({
        tenantId: tenant.id,
        consumerToken: registration.token,
        secretId: secret.id,
        proof: { binding: 'disable' },
        note: 'Attempt use after disable'
      })
    ).rejects.toThrow('Unable to use secret');

    await expect(
      nebulaClient.secret.update({
        tenantId: tenant.id,
        consumerToken: registration.token,
        secretId: secret.id,
        secret: 'new-value',
        proof: { binding: 'disable' }
      })
    ).rejects.toThrow('Unable to modify secret');
  });

  it('only allows the creating consumer to disable a secret', async () => {
    let tenant = await createTenant('tenant-disable-lock');
    let ownerRegistration = await registerWorker('owner-secret', 'OWNER-DISABLE');
    let otherRegistration = await registerWorker('other-secret', 'OTHER-DISABLE');

    let secret = await nebulaClient.secret.create({
      tenantId: tenant.id,
      consumerToken: ownerRegistration.token,
      purpose: 'disable_lock',
      secret: 'high-entropy-secret-value-disable-lock',
      proof: { binding: 'owner' }
    });

    await expect(
      nebulaClient.secret.disable({
        tenantId: tenant.id,
        consumerToken: otherRegistration.token,
        secretId: secret.id
      })
    ).rejects.toThrow('Only the creating consumer can disable this secret');
  });

  it('rejects disabling an already deleted secret', async () => {
    let tenant = await createTenant('tenant-disable-deleted');
    let registration = await registerWorker();

    let secret = await nebulaClient.secret.create({
      tenantId: tenant.id,
      consumerToken: registration.token,
      purpose: 'disable_deleted',
      secret: 'high-entropy-secret-value-disable-deleted',
      proof: { binding: 'deleted' }
    });

    await testDb.secret.update({
      where: { id: secret.id },
      data: { status: 'deleted', deletedAt: new Date() }
    });

    await expect(
      nebulaClient.secret.disable({
        tenantId: tenant.id,
        consumerToken: registration.token,
        secretId: secret.id
      })
    ).rejects.toThrow('Secret has already been deleted');
  });

  it('is idempotent when disabling an already disabled secret', async () => {
    let tenant = await createTenant('tenant-disable-idempotent');
    let registration = await registerWorker();

    let secret = await nebulaClient.secret.create({
      tenantId: tenant.id,
      consumerToken: registration.token,
      purpose: 'disable_idempotent',
      secret: 'high-entropy-secret-value-disable-idempotent',
      proof: { binding: 'idempotent' }
    });

    let first = await nebulaClient.secret.disable({
      tenantId: tenant.id,
      consumerToken: registration.token,
      secretId: secret.id
    });

    let second = await nebulaClient.secret.disable({
      tenantId: tenant.id,
      consumerToken: registration.token,
      secretId: secret.id
    });

    expect(second).toMatchObject({
      id: secret.id,
      status: 'disabled',
      disabledAt: first.disabledAt
    });
  });
});
