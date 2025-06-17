import { ID } from '@metorial/db';
import { ServiceError } from '@metorial/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { secretService } from '../src/services/secret';

// @ts-ignore
let { db } = await import('@metorial/db');

// Mocks
vi.mock('@metorial/db', () => ({
  db: {
    secret: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn()
    },
    secretEvent: {
      createMany: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn()
  },
  withTransaction: (fn: any) => fn(db)
}));
vi.mock('@metorial/pagination', () => ({
  Paginator: { create: vi.fn(fn => fn({ prisma: (cb: any) => cb({}) })) }
}));
vi.mock('../src/definitions', () => ({
  secretTypes: {
    'api-key': Promise.resolve({ oid: 1, slug: 'api-key' })
  }
}));
vi.mock('../src/lib/fingerprint', () => ({
  getSecretFingerprint: vi.fn(() => Promise.resolve('fingerprint'))
}));
vi.mock('../src/store', () => ({
  SecretStores: {
    getDefault: () => 'default',
    get: vi.fn(() => ({
      get: vi.fn(() => Promise.resolve({ oid: 1, slug: 'default' })),
      encryptSecret: vi.fn(() => Promise.resolve('encrypted')),
      decryptSecret: vi.fn(() => Promise.resolve(JSON.stringify({ foo: 'bar' })))
    }))
  }
}));

const organization = { oid: 1 };
const instance = { oid: 2 };
const performedBy = { oid: 3 };
const secret = {
  oid: 10,
  id: 'secret-id',
  status: 'active',
  type: { oid: 1, slug: 'api-key' },
  store: { slug: 'default' },
  encryptedData: 'encrypted',
  instanceOid: 2,
  organizationOid: 1
};

describe('secretService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    ID.generateId.mockResolvedValue('generated-id');
  });

  it('creates a secret', async () => {
    // @ts-ignore
    db.secret.create.mockResolvedValue({ ...secret });
    // @ts-ignore
    db.secretEvent.createMany.mockResolvedValue(undefined);

    const result = await secretService.createSecret({
      // @ts-ignore
      organization,
      // @ts-ignore
      instance,
      // @ts-ignore
      performedBy,
      input: {
        // @ts-ignore
        type: 'api-key',
        secretData: { foo: 'bar' },
        description: 'desc',
        metadata: { a: 1 }
      }
    });

    expect(result).toMatchObject(secret);
    expect(db.secret.create).toHaveBeenCalled();
    expect(db.secretEvent.createMany).toHaveBeenCalled();
  });

  it('gets a secret by id', async () => {
    // @ts-ignore
    db.secret.findFirst.mockResolvedValue(secret);

    // @ts-ignore
    const result = await secretService.getSecretById({ secretId: 'secret-id', instance });
    expect(result).toBe(secret);
    expect(db.secret.findFirst).toHaveBeenCalled();
  });

  it('throws if secret not found', async () => {
    // @ts-ignore
    db.secret.findFirst.mockResolvedValue(null);

    await expect(
      // @ts-ignore
      secretService.getSecretById({ secretId: 'not-found', instance })
    ).rejects.toThrow(ServiceError);
  });

  it('deletes a secret', async () => {
    // @ts-ignore
    db.secretEvent.createMany.mockResolvedValue(undefined);
    // @ts-ignore
    db.secret.update.mockResolvedValue({
      ...secret,
      status: 'deleted'
    });

    // @ts-ignore
    const result = await secretService.deleteSecret({ secret, performedBy });
    expect(result.status).toBe('deleted');
    expect(db.secret.update).toHaveBeenCalled();
    expect(db.secretEvent.createMany).toHaveBeenCalled();
  });

  it('throws on deleting non-active secret', async () => {
    const deletedSecret = { ...secret, status: 'deleted' };
    await expect(
      // @ts-ignore
      secretService.deleteSecret({ secret: deletedSecret, performedBy })
    ).rejects.toThrow(ServiceError);
  });

  it('lists secrets', async () => {
    // @ts-ignore
    db.secret.findMany.mockResolvedValue([secret]);
    // @ts-ignore
    const paginator = await secretService.listSecrets({ instance });
    expect(Array.isArray(await paginator)).toBe(true);
  });

  it('reads secret value', async () => {
    // @ts-ignore
    db.secret.findFirst.mockResolvedValue(secret);
    // @ts-ignore
    db.secretEvent.createMany.mockResolvedValue(undefined);
    // @ts-ignore
    db.secret.updateMany.mockResolvedValue(undefined);

    const result = await secretService.DANGEROUSLY_readSecretValue({
      secretId: 'secret-id',
      // @ts-ignore
      performedBy,
      // @ts-ignore
      instance,
      // @ts-ignore
      type: 'api-key'
    });

    expect(result.secret).toMatchObject(secret);
    expect(result.data).toEqual({ foo: 'bar' });
  });

  it('throws on secret type mismatch', async () => {
    // @ts-ignore
    db.secret.findFirst.mockResolvedValue({
      ...secret,
      type: { oid: 1, slug: 'wrong-type' }
    });

    await expect(
      secretService.DANGEROUSLY_readSecretValue({
        secretId: 'secret-id',
        // @ts-ignore
        performedBy,
        // @ts-ignore
        instance,
        // @ts-ignore
        type: 'api-key'
      })
    ).rejects.toThrow(ServiceError);
  });

  it('throws on reading deleted secret', async () => {
    // @ts-ignore
    db.secret.findFirst.mockResolvedValue({
      ...secret,
      status: 'deleted'
    });

    await expect(
      secretService.DANGEROUSLY_readSecretValue({
        secretId: 'secret-id',
        // @ts-ignore
        performedBy,
        // @ts-ignore
        instance,
        // @ts-ignore
        type: 'api-key'
      })
    ).rejects.toThrow(ServiceError);
  });
});
