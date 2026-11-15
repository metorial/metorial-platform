import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  createSystemKeyProvider: vi.fn(),
  matchesLegacySystemKeyInfo: vi.fn(),
  fingerprint: 'gcp_kms:projects/p/locations/l/keyRings/r/cryptoKeys/k'
}));

vi.mock('../db', () => ({
  db: { keyProvider: { findMany: mocks.findMany, create: mocks.create } }
}));
vi.mock('../env', () => ({
  defaultProviderType: 'gcp_kms',
  isTenantProviderTypeEnabled: () => true,
  env: { service: { REDIS_URL: 'redis://localhost:6379' }, kms: {} }
}));
vi.mock('../id', () => ({
  ID: { generateId: async () => 'kp_new' },
  snowflake: { nextId: () => 1n }
}));
vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({ usingLock: async (_key: string, fn: () => Promise<any>) => await fn() })
}));
vi.mock('../adapters', () => ({
  getKeyProviderAdapter: () => ({
    getSystemFingerprint: () => mocks.fingerprint,
    matchesLegacySystemKeyInfo: mocks.matchesLegacySystemKeyInfo,
    createSystemKeyProvider: mocks.createSystemKeyProvider
  })
}));

import { keyProviderService } from './keyProvider';

describe('keyProviderService.ensureSystemDefaultProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSystemKeyProvider.mockResolvedValue({
      name: 'Default',
      keyInfo: { variant: 'gcp_kms', fingerprint: mocks.fingerprint }
    });
    mocks.create.mockImplementation(async ({ data }: any) => data);
  });

  it('keeps a legacy row without a fingerprint when the type matches', async () => {
    let legacy = {
      systemIdentifier: 'system:global:default',
      keyInfo: { variant: 'gcp_kms' }
    };
    mocks.findMany.mockResolvedValue([legacy]);
    mocks.matchesLegacySystemKeyInfo.mockResolvedValue(true);

    expect(await keyProviderService.ensureSystemDefaultProvider()).toBe(legacy);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('reuses a row with a matching fingerprint', async () => {
    let existing = {
      systemIdentifier: 'system:global:default:gcp_kms:abcdef12',
      keyInfo: { fingerprint: mocks.fingerprint }
    };
    mocks.findMany.mockResolvedValue([existing]);

    expect(await keyProviderService.ensureSystemDefaultProvider()).toBe(existing);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('creates a new identifier for a fresh installation', async () => {
    mocks.findMany.mockResolvedValue([]);

    let created: any = await keyProviderService.ensureSystemDefaultProvider();

    expect(created.systemIdentifier).toMatch(/^system:global:default:gcp_kms:[0-9A-Za-z]{8}$/);
  });

  it('creates a new row when the configured key changed', async () => {
    mocks.findMany.mockResolvedValue([
      {
        systemIdentifier: 'system:global:default:gcp_kms:abcdef12',
        keyInfo: { fingerprint: 'gcp_kms:projects/other' }
      }
    ]);

    let created: any = await keyProviderService.ensureSystemDefaultProvider();

    expect(created.systemIdentifier).not.toBe('system:global:default');
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it('creates a new row when a legacy row no longer matches the configuration', async () => {
    mocks.findMany.mockResolvedValue([
      { systemIdentifier: 'system:global:default', keyInfo: { variant: 'gcp_kms' } }
    ]);
    mocks.matchesLegacySystemKeyInfo.mockResolvedValue(false);

    await keyProviderService.ensureSystemDefaultProvider();

    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
});
