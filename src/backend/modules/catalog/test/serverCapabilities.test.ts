import { db } from '@metorial/db';
import { Hash } from '@metorial/hash';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serverCapabilitiesService } from '../src/services/serverCapabilities';

vi.mock('@metorial/db', () => ({
  db: {
    serverVersion: { findMany: vi.fn() },
    serverVariant: { findMany: vi.fn() },
    serverDeployment: { findMany: vi.fn() },
    serverImplementation: { findMany: vi.fn() },
    server: { findMany: vi.fn() }
  }
}));
vi.mock('@metorial/hash', () => ({
  Hash: { sha256: vi.fn(async (s: string) => `hashed_${s}`) }
}));

const mockVariant = {
  id: 'v1',
  currentVersionOid: 'cvo1',
  prompts: {},
  tools: {},
  resourceTemplates: {},
  serverCapabilities: {},
  serverInfo: {},
  server: { id: 's1', oid: 'soid1' }
};
const mockVersion = { ...mockVariant, oid: 'oid1', serverVariant: mockVariant };
const mockDeployment = {
  id: 'd1',
  instanceOid: 'ioid1',
  serverVariantOid: 'v1',
  oid: 'doid1'
};
const mockImplementation = {
  id: 'i1',
  instanceOid: 'ioid1',
  serverVariantOid: 'v1',
  oid: 'ioid1'
};
const mockInstance = { oid: 'ioid1' };

describe('serverCapabilitiesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns server capabilities for serverVersionIds', async () => {
    (db.serverVersion.findMany as any).mockResolvedValue([mockVersion]);
    const result = await serverCapabilitiesService.getManyServerCapabilities({
      serverVersionIds: ['oid1']
    });
    expect(result).toHaveLength(1);
    expect(result[0].serverVersion).toBeDefined();
    expect(result[0].serverVariant).toBeDefined();
    expect(result[0].id).toContain('mcap_');
    expect(Hash.sha256).toHaveBeenCalled();
  });

  it('returns server capabilities for serverVariantIds', async () => {
    (db.serverVariant.findMany as any).mockResolvedValue([mockVariant]);
    const result = await serverCapabilitiesService.getManyServerCapabilities({
      serverVariantIds: ['v1']
    });
    expect(result).toHaveLength(1);
    expect(result[0].serverVariant).toBeDefined();
    expect(result[0].serverVersion).toBeUndefined();
    expect(result[0].id).toContain('mcap_');
  });

  it('returns server capabilities for serverDeploymentIds and instance', async () => {
    (db.serverDeployment.findMany as any).mockResolvedValue([mockDeployment]);
    (db.serverVariant.findMany as any).mockResolvedValue([
      {
        ...mockVariant,
        serverDeployments: [mockDeployment]
      }
    ]);
    const result = await serverCapabilitiesService.getManyServerCapabilities({
      serverDeploymentIds: ['d1'],
      instance: mockInstance as any
    });
    expect(result).toHaveLength(1);
    expect(result[0].serverDeployment).toBeDefined();
  });

  it('returns server capabilities for serverImplementationIds and instance', async () => {
    (db.serverImplementation.findMany as any).mockResolvedValue([mockImplementation]);
    (db.serverVariant.findMany as any).mockResolvedValue([mockVariant]);
    const result = await serverCapabilitiesService.getManyServerCapabilities({
      serverImplementationIds: ['i1'],
      instance: mockInstance as any
    });
    expect(result).toHaveLength(1);
  });

  it('returns server capabilities for serverIds', async () => {
    (db.server.findMany as any).mockResolvedValue([{ id: 's1', oid: 'soid1' }]);
    (db.serverVariant.findMany as any).mockResolvedValue([mockVariant]);
    const result = await serverCapabilitiesService.getManyServerCapabilities({
      serverIds: ['s1'],
      serverVariantIds: ['v1']
    });
    expect(result).toHaveLength(1);
  });

  it('handles empty input gracefully', async () => {
    (db.serverVariant.findMany as any).mockResolvedValue([]);
    const result = await serverCapabilitiesService.getManyServerCapabilities({});
    expect(result).toEqual([]);
  });
});
