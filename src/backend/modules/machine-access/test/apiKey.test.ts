import { ServiceError } from '@metorial/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiKeyService } from '../src/services/apiKey';

// @ts-ignore
const { db } = await import('@metorial/db');

// Mocks
vi.mock('@metorial/db', () => ({
  db: {
    apiKey: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    apiKeySecret: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn()
    }
  },
  withTransaction: (fn: any) => fn(db),
  ID: { generateId: vi.fn().mockResolvedValue('mock-id') }
}));
vi.mock('@metorial/service', () => ({
  Service: { create: (_: string, fn: any) => ({ build: () => fn() }) }
}));
vi.mock('@metorial/api-keys', () => ({
  UnifiedApiKey: {
    create: vi.fn(() => ({
      toString: () => 'secret-key'
    })),
    redact: vi.fn(() => 'redacted-key')
  }
}));
vi.mock('@metorial/config', () => ({
  getConfig: () => ({ urls: { apiUrl: 'http://api' } })
}));
vi.mock('@metorial/hash', () => ({
  Hash: { sha512: vi.fn(() => Promise.resolve('sha512')) }
}));
vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));
vi.mock('../src/services/machineAccess', () => ({
  machineAccessService: {
    createMachineAccess: vi.fn(() => Promise.resolve({ oid: 'machine-access-oid' })),
    updateMachineAccess: vi.fn(() => Promise.resolve()),
    deleteMachineAccess: vi.fn(() => Promise.resolve())
  }
}));
vi.mock('@metorial/pagination', () => ({
  Paginator: { create: (fn: any) => fn({ prisma: (cb: any) => cb({}) }) }
}));

const baseContext = { user: { oid: 'user-oid' } } as any;
const baseOrg = { oid: 'org-oid' } as any;
const baseUser = { oid: 'user-oid' } as any;
const baseInstance = { oid: 'instance-oid', type: 'production' } as any;
const baseActor = { oid: 'actor-oid' } as any;

describe('apiKeyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a user auth token api key', async () => {
    // @ts-ignore
    db.apiKey.create.mockResolvedValue({
      oid: 'api-key-oid',
      type: 'user_auth_token',
      machineAccess: {}
    });
    // @ts-ignore
    db.apiKeySecret.create.mockResolvedValue({ secret: 'secret-key' });

    const result = await apiKeyService.createApiKey({
      type: 'user_auth_token',
      user: baseUser,
      input: { name: 'test', description: 'desc' },
      context: baseContext
    });

    expect(result.apiKey).toBeDefined();
    expect(result.secret.secret).toBe('secret-key');
    expect(db.apiKey.create).toHaveBeenCalled();
    expect(db.apiKeySecret.create).toHaveBeenCalled();
  });

  it('should create an organization management token api key', async () => {
    // @ts-ignore
    db.apiKey.create.mockResolvedValue({
      oid: 'api-key-oid',
      type: 'organization_management_token',
      machineAccess: {}
    });
    // @ts-ignore
    db.apiKeySecret.create.mockResolvedValue({ secret: 'secret-key' });

    const result = await apiKeyService.createApiKey({
      type: 'organization_management_token',
      organization: baseOrg,
      performedBy: baseActor,
      input: { name: 'orgkey' },
      context: baseContext
    });

    expect(result.apiKey).toBeDefined();
    expect(result.secret.secret).toBe('secret-key');
  });

  it('should update an api key', async () => {
    // @ts-ignore
    db.apiKey.update.mockResolvedValue({
      oid: 'api-key-oid',
      type: 'organization_management_token',
      machineAccess: {}
    });

    const apiKey = {
      oid: 'api-key-oid',
      type: 'organization_management_token',
      status: 'active',
      machineAccess: {}
    };
    const result = await apiKeyService.updateApiKey({
      // @ts-ignore
      apiKey,
      input: { name: 'updated', description: 'desc' },
      context: baseContext,
      performedBy: baseActor
    });

    expect(result).toBeDefined();
    expect(db.apiKey.update).toHaveBeenCalled();
  });

  it('should revoke an api key', async () => {
    // @ts-ignore
    db.apiKey.update.mockResolvedValue({
      oid: 'api-key-oid',
      type: 'organization_management_token',
      machineAccess: {}
    });

    const apiKey = {
      oid: 'api-key-oid',
      type: 'organization_management_token',
      status: 'active',
      machineAccess: {}
    };
    const result = await apiKeyService.revokeApiKey({
      // @ts-ignore
      apiKey,
      performedBy: baseActor,
      context: baseContext
    });

    expect(result).toBeDefined();
    expect(db.apiKey.update).toHaveBeenCalled();
  });

  it('should rotate an api key', async () => {
    // @ts-ignore
    db.apiKey.update.mockResolvedValue({
      oid: 'api-key-oid',
      type: 'organization_management_token',
      machineAccess: {}
    });
    // @ts-ignore
    db.apiKeySecret.create.mockResolvedValue({ secret: 'secret-key' });
    // @ts-ignore
    db.apiKeySecret.findMany.mockResolvedValue([{ id: 'secret-1' }]);
    // @ts-ignore
    db.apiKeySecret.updateMany.mockResolvedValue({});

    const apiKey = {
      oid: 'api-key-oid',
      type: 'organization_management_token',
      status: 'active',
      machineAccess: {},
      expiresAt: new Date()
    };
    const result = await apiKeyService.rotateApiKey({
      // @ts-ignore
      apiKey,
      performedBy: baseActor,
      context: baseContext,
      input: {}
    });

    expect(result.apiKey).toBeDefined();
    expect(result.secret.secret).toBe('secret-key');
  });

  it('should reveal an api key secret', async () => {
    // @ts-ignore
    db.apiKeySecret.findFirst.mockResolvedValue({ secret: 'secret-key' });

    const apiKey = {
      oid: 'api-key-oid',
      type: 'organization_management_token',
      status: 'active',
      machineAccess: {}
    };
    const result = await apiKeyService.revealApiKey({
      // @ts-ignore
      apiKey,
      performedBy: baseActor,
      context: baseContext
    });

    expect(result.secret).toBe('secret-key');
  });

  it('should throw if api key is not active', async () => {
    const apiKey = {
      oid: 'api-key-oid',
      type: 'organization_management_token',
      status: 'deleted',
      machineAccess: {}
    };
    await expect(
      apiKeyService.updateApiKey({
        // @ts-ignore
        apiKey,
        input: {},
        context: baseContext,
        performedBy: baseActor
      })
    ).rejects.toThrow(ServiceError);
  });

  it('should get api key by id', async () => {
    // @ts-ignore
    db.apiKey.findFirst.mockResolvedValue({ id: 'api-key-id', machineAccess: {} });

    const result = await apiKeyService.getApiKeyById({
      apiKeyId: 'api-key-id',
      organization: baseOrg
    });
    expect(result).toBeDefined();
    expect(db.apiKey.findFirst).toHaveBeenCalled();
  });

  it('should throw if api key by id not found', async () => {
    // @ts-ignore
    db.apiKey.findFirst.mockResolvedValue(undefined);

    await expect(
      apiKeyService.getApiKeyById({ apiKeyId: 'notfound', organization: baseOrg })
    ).rejects.toThrow(ServiceError);
  });

  it('should get api key by id for user', async () => {
    // @ts-ignore
    db.apiKey.findFirst.mockResolvedValue({ id: 'api-key-id', machineAccess: {} });

    const result = await apiKeyService.getApiKeyByIdForUser({
      apiKeyId: 'api-key-id',
      user: baseUser
    });
    expect(result).toBeDefined();
    expect(db.apiKey.findFirst).toHaveBeenCalled();
  });

  it('should throw if api key by id for user not found', async () => {
    // @ts-ignore
    db.apiKey.findFirst.mockResolvedValue(undefined);

    await expect(
      apiKeyService.getApiKeyByIdForUser({ apiKeyId: 'notfound', user: baseUser })
    ).rejects.toThrow(ServiceError);
  });

  it('should list api keys for organization', async () => {
    // @ts-ignore
    db.apiKey.findMany.mockResolvedValue([{ id: 'api-key-id', machineAccess: {} }]);

    const paginator = await apiKeyService.listApiKeys({
      filter: { type: 'organization_management_token', organization: baseOrg }
    });

    expect(Array.isArray(paginator)).toBe(true);
    expect(db.apiKey.findMany).toHaveBeenCalled();
  });

  it('should list api keys for user', async () => {
    // @ts-ignore
    db.apiKey.findMany.mockResolvedValue([{ id: 'api-key-id', machineAccess: {} }]);

    const paginator = await apiKeyService.listApiKeys({
      filter: { type: 'user_auth_token', user: baseUser }
    });

    expect(Array.isArray(paginator)).toBe(true);
    expect(db.apiKey.findMany).toHaveBeenCalled();
  });

  it('should list api keys for instance', async () => {
    // @ts-ignore
    db.apiKey.findMany.mockResolvedValue([{ id: 'api-key-id', machineAccess: {} }]);

    const paginator = await apiKeyService.listApiKeys({
      filter: { type: 'instance_access_token', instance: baseInstance, organization: baseOrg }
    });

    expect(Array.isArray(paginator)).toBe(true);
    expect(db.apiKey.findMany).toHaveBeenCalled();
  });
});
