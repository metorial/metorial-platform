import { beforeEach, describe, expect, it } from 'vitest';
import { nebulaClient } from '../../test/client';
import { cleanDatabase, testDb } from '../../test/setup';

let createTenant = (identifier = 'tenant-a') =>
  nebulaClient.tenant.upsert({
    identifier,
    name: identifier
  });

describe('secret E2E', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('stores and uses a secret with the correct proof', async () => {
    let tenant = await createTenant();
    let consumer = await nebulaClient.consumer.upsert({
      tenantId: tenant.id,
      identifier: 'worker',
      name: 'Worker'
    });

    let secret = await nebulaClient.secret.create({
      tenantId: tenant.id,
      consumerId: consumer.id,
      purpose: 'database_password',
      secret: 'high-entropy-secret-value-1',
      proof: { binding: 'db', nonce: 'proof-1' },
      encryptionContext: { service: 'database' }
    });

    let used = await nebulaClient.secret.use({
      tenantId: tenant.id,
      consumerId: consumer.id,
      secretId: secret.id,
      proof: { binding: 'db', nonce: 'proof-1' },
      note: 'Read database password for connection test'
    });

    expect(used).toMatchObject({
      object: 'nebula#secret_use',
      secretId: secret.id,
      plaintext: 'high-entropy-secret-value-1'
    });

    await expect(
      nebulaClient.secret.use({
        tenantId: tenant.id,
        consumerId: consumer.id,
        secretId: secret.id,
        proof: { binding: 'db', nonce: 'wrong' },
        note: 'Attempt with wrong proof'
      })
    ).rejects.toThrow('Unable to use secret');
  });

  it('locks a secret to the creating consumer', async () => {
    let tenant = await createTenant('tenant-consumer-lock');
    let owner = await nebulaClient.consumer.upsert({
      tenantId: tenant.id,
      identifier: 'owner',
      name: 'Owner'
    });
    let other = await nebulaClient.consumer.upsert({
      tenantId: tenant.id,
      identifier: 'other',
      name: 'Other'
    });

    let secret = await nebulaClient.secret.create({
      tenantId: tenant.id,
      consumerId: owner.id,
      purpose: 'locked_secret',
      secret: 'high-entropy-secret-value-locked',
      proof: { binding: 'owner' }
    });

    expect(secret.consumerId).toBe(owner.id);

    await expect(
      nebulaClient.secret.use({
        tenantId: tenant.id,
        consumerId: other.id,
        secretId: secret.id,
        proof: { binding: 'owner' },
        note: 'Attempt access from other consumer'
      })
    ).rejects.toThrow('Unable to use secret');
  });

  it('reuses the current data key for multiple writes in the reuse window', async () => {
    let tenant = await createTenant('tenant-reuse');
    let consumer = await nebulaClient.consumer.upsert({
      tenantId: tenant.id,
      identifier: 'worker',
      name: 'Worker'
    });

    await nebulaClient.secret.create({
      tenantId: tenant.id,
      consumerId: consumer.id,
      purpose: 'first',
      secret: 'high-entropy-secret-value-2',
      proof: { p: 1 }
    });

    await nebulaClient.secret.create({
      tenantId: tenant.id,
      consumerId: consumer.id,
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
    let consumerB = await nebulaClient.consumer.upsert({
      tenantId: tenantB.id,
      identifier: 'worker',
      name: 'Worker'
    });

    let provider = await nebulaClient.keyProvider.create({
      tenantId: tenantA.id,
      name: 'Local BYOK'
    });

    await expect(
      nebulaClient.secret.create({
        tenantId: tenantB.id,
        consumerId: consumerB.id,
        purpose: 'cross_tenant',
        secret: 'high-entropy-secret-value-4',
        proof: { p: 1 },
        keyProviderId: provider.id
      })
    ).rejects.toThrow();
  });
});
