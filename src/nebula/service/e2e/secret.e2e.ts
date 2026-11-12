import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { nebula } from './client';
import { createSecret, createTenant, registerConsumer } from './fixtures';

describe('nebula secrets', () => {
  it('stores a secret and returns it with the correct proof only', async () => {
    let tenant = await createTenant();
    let registration = await registerConsumer('worker');

    let secret = await createSecret({
      tenantId: tenant.id,
      consumerToken: registration.token,
      secret: 'high-entropy-secret-value-1',
      proof: { binding: 'db', nonce: 'proof-1' }
    });

    let used = await nebula.secret.use({
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

    let instance = await db.consumerInstance.findUniqueOrThrow({
      where: { id: registration.consumerInstanceId }
    });
    let record = await db.secretUse.findFirstOrThrow({
      where: { secret: { id: secret.id } }
    });
    expect(record.consumerInstanceOid).toBe(instance.oid);

    await expect(
      nebula.secret.use({
        tenantId: tenant.id,
        consumerToken: registration.token,
        secretId: secret.id,
        proof: { binding: 'db', nonce: 'wrong' },
        note: 'Attempt with wrong proof'
      })
    ).rejects.toThrow('Unable to use secret');
  });

  it('does not persist the plaintext', async () => {
    let tenant = await createTenant();
    let registration = await registerConsumer('worker');
    let secret = await createSecret({
      tenantId: tenant.id,
      consumerToken: registration.token,
      secret: 'plaintext-that-must-not-leak'
    });

    let row = await db.secret.findUniqueOrThrow({
      where: { id: secret.id },
      include: { versions: true }
    });
    expect(JSON.stringify(row, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain(
      'plaintext-that-must-not-leak'
    );
    expect(JSON.stringify(secret)).not.toContain('plaintext-that-must-not-leak');
  });

  it('locks a secret to the creating consumer', async () => {
    let tenant = await createTenant();
    let owner = await registerConsumer('owner');
    let other = await registerConsumer('other');
    let ownerConsumer = await db.consumer.findUniqueOrThrow({ where: { identifier: 'owner' } });

    let secret = await createSecret({
      tenantId: tenant.id,
      consumerToken: owner.token,
      proof: { binding: 'owner' }
    });
    expect(secret.consumerId).toBe(ownerConsumer.id);

    await expect(
      nebula.secret.use({
        tenantId: tenant.id,
        consumerToken: other.token,
        secretId: secret.id,
        proof: { binding: 'owner' },
        note: 'Attempt access from other consumer'
      })
    ).rejects.toThrow('Unable to use secret');
  });

  it('reuses the current data key for writes within the reuse window', async () => {
    let tenant = await createTenant();
    let registration = await registerConsumer('worker');

    await createSecret({ tenantId: tenant.id, consumerToken: registration.token });
    await createSecret({ tenantId: tenant.id, consumerToken: registration.token });

    let dbTenant = await db.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    let keys = await db.key.findMany({ where: { tenantOid: dbTenant.oid } });
    expect(keys).toHaveLength(1);
  });

  it('does not allow a tenant to use another tenant key provider', async () => {
    let tenantA = await createTenant();
    let tenantB = await createTenant();
    let registration = await registerConsumer('worker');
    let provider = await nebula.keyProvider.import({ tenantId: tenantA.id, keyInput: {} });

    await expect(
      nebula.secret.create({
        tenantId: tenantB.id,
        consumerToken: registration.token,
        purpose: 'cross_tenant',
        secret: 'high-entropy-secret-value-4',
        proof: { p: 1 },
        keyProviderId: provider.id
      })
    ).rejects.toThrow();
  });

  it('does not expose a secret to another tenant', async () => {
    let tenantA = await createTenant();
    let tenantB = await createTenant();
    let registration = await registerConsumer('worker');
    let secret = await createSecret({ tenantId: tenantA.id, consumerToken: registration.token });

    await expect(
      nebula.secret.get({ tenantId: tenantB.id, secretId: secret.id })
    ).rejects.toThrow();

    await expect(
      nebula.secret.use({
        tenantId: tenantB.id,
        consumerToken: registration.token,
        secretId: secret.id,
        proof: { binding: 'default' },
        note: 'Cross tenant use'
      })
    ).rejects.toThrow();

    let list = await nebula.secret.list({ tenantId: tenantB.id, limit: 10 });
    expect(list.items).toHaveLength(0);
  });

  it('keeps metadata and key provider reads open without consumer tokens', async () => {
    let tenant = await createTenant();
    let registration = await registerConsumer('worker');
    let secret = await createSecret({ tenantId: tenant.id, consumerToken: registration.token });

    let list = await nebula.secret.list({ tenantId: tenant.id, limit: 10 });
    expect(list.items.map(i => i.id)).toContain(secret.id);

    await expect(
      nebula.secret.get({ tenantId: tenant.id, secretId: secret.id })
    ).resolves.toMatchObject({ id: secret.id });
    await expect(
      nebula.keyProvider.list({ tenantId: tenant.id, limit: 10 })
    ).resolves.toBeDefined();
  });

  it('rejects an invalid consumer token on write operations', async () => {
    let tenant = await createTenant();

    await expect(
      nebula.secret.create({
        tenantId: tenant.id,
        consumerToken: 'not-a-token',
        purpose: 'invalid',
        secret: 'high-entropy-secret-value',
        proof: { p: 1 }
      })
    ).rejects.toThrow('Unable to use secret');
  });

  it('disables an active secret and blocks use and update', async () => {
    let tenant = await createTenant();
    let registration = await registerConsumer('worker');
    let secret = await createSecret({
      tenantId: tenant.id,
      consumerToken: registration.token,
      proof: { binding: 'disable' }
    });

    let disabled = await nebula.secret.disable({
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
      nebula.secret.use({
        tenantId: tenant.id,
        consumerToken: registration.token,
        secretId: secret.id,
        proof: { binding: 'disable' },
        note: 'Attempt use after disable'
      })
    ).rejects.toThrow('Unable to use secret');

    await expect(
      nebula.secret.update({
        tenantId: tenant.id,
        consumerToken: registration.token,
        secretId: secret.id,
        secret: 'new-value',
        proof: { binding: 'disable' }
      })
    ).rejects.toThrow('Unable to modify secret');
  });

  it('only allows the creating consumer to disable a secret', async () => {
    let tenant = await createTenant();
    let owner = await registerConsumer('owner');
    let other = await registerConsumer('other');
    let secret = await createSecret({ tenantId: tenant.id, consumerToken: owner.token });

    await expect(
      nebula.secret.disable({
        tenantId: tenant.id,
        consumerToken: other.token,
        secretId: secret.id
      })
    ).rejects.toThrow('Only the creating consumer can disable this secret');
  });

  it('rejects disabling a deleted secret', async () => {
    let tenant = await createTenant();
    let registration = await registerConsumer('worker');
    let secret = await createSecret({ tenantId: tenant.id, consumerToken: registration.token });

    await db.secret.update({
      where: { id: secret.id },
      data: { status: 'deleted', deletedAt: new Date() }
    });

    await expect(
      nebula.secret.disable({
        tenantId: tenant.id,
        consumerToken: registration.token,
        secretId: secret.id
      })
    ).rejects.toThrow('Secret has already been deleted');
  });

  it('is idempotent when disabling a disabled secret', async () => {
    let tenant = await createTenant();
    let registration = await registerConsumer('worker');
    let secret = await createSecret({ tenantId: tenant.id, consumerToken: registration.token });

    let input = {
      tenantId: tenant.id,
      consumerToken: registration.token,
      secretId: secret.id
    };
    let first = await nebula.secret.disable(input);
    let second = await nebula.secret.disable(input);

    expect(second).toMatchObject({
      id: secret.id,
      status: 'disabled',
      disabledAt: first.disabledAt
    });
  });
});
