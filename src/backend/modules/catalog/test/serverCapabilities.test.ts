import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverCapabilitiesService } from '../src/services/serverCapabilities';
import { db } from '@metorial/db';
import { Hash } from '@metorial/hash';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    serverVersion: {
      findMany: vi.fn()
    },
    serverVariant: {
      findMany: vi.fn()
    },
    serverDeployment: {
      findMany: vi.fn()
    },
    serverImplementation: {
      findMany: vi.fn()
    },
    server: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('@metorial/hash', () => ({
  Hash: {
    sha256: vi.fn()
  }
}));

describe('serverCapabilitiesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Hash.sha256).mockResolvedValue('mocked_hash_value');
  });

  describe('getManyServerCapabilities', () => {
    it('should get capabilities by serverVersionIds', async () => {
      let mockVersions = [
        {
          id: 'version_1',
          oid: 1,
          prompts: [{ name: 'prompt1' }],
          tools: [{ name: 'tool1' }],
          resourceTemplates: [{ name: 'template1' }],
          serverCapabilities: { test: 'capability' },
          serverInfo: { version: '1.0.0' },
          server: {
            id: 'server_1',
            oid: 10
          },
          serverVariant: {
            id: 'variant_1',
            oid: 100,
            currentVersionOid: 1
          }
        }
      ];

      vi.mocked(db.serverVersion.findMany).mockResolvedValue(mockVersions as any);

      let result = await serverCapabilitiesService.getManyServerCapabilities({
        serverVersionIds: ['version_1']
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('serverVariant');
      expect(result[0]).toHaveProperty('serverVersion');
      expect(result[0]).toHaveProperty('server');
      expect(result[0]).toHaveProperty('prompts');
      expect(result[0]).toHaveProperty('tools');
      expect(result[0]).toHaveProperty('resourceTemplates');
      expect(result[0]).toHaveProperty('capabilities');
      expect(result[0]).toHaveProperty('info');

      expect(db.serverVersion.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['version_1'] }
        },
        include: {
          server: true,
          serverVariant: true
        },
        take: 100
      });
    });

    it('should get capabilities by serverVariantIds', async () => {
      let mockVariants = [
        {
          id: 'variant_1',
          oid: 100,
          currentVersionOid: 1,
          prompts: [{ name: 'prompt1' }],
          tools: [{ name: 'tool1' }],
          resourceTemplates: [{ name: 'template1' }],
          serverCapabilities: { test: 'capability' },
          serverInfo: { version: '1.0.0' },
          server: {
            id: 'server_1',
            oid: 10
          }
        }
      ];

      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants as any);

      let result = await serverCapabilitiesService.getManyServerCapabilities({
        serverVariantIds: ['variant_1']
      });

      expect(result).toHaveLength(1);
      expect(result[0].serverVariant.id).toBe('variant_1');
      expect(result[0].serverVersion).toBeUndefined();

      expect(db.serverVariant.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['variant_1'] } },
        include: {
          server: true
        },
        take: 100
      });
    });

    it('should get capabilities by serverIds', async () => {
      let mockServers = [{ id: 'server_1', oid: 10 }];
      let mockVariants = [
        {
          id: 'variant_1',
          oid: 100,
          serverOid: 10,
          currentVersionOid: 1,
          prompts: [],
          tools: [],
          resourceTemplates: [],
          serverCapabilities: {},
          serverInfo: {},
          server: mockServers[0]
        }
      ];

      vi.mocked(db.server.findMany).mockResolvedValue(mockServers as any);
      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants as any);

      let result = await serverCapabilitiesService.getManyServerCapabilities({
        serverIds: ['server_1']
      });

      expect(result).toHaveLength(1);
      expect(db.server.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['server_1'] } }
      });
    });

    it('should get capabilities by serverDeploymentIds with instance', async () => {
      let mockInstance = {
        id: 'instance_1',
        oid: 1000,
        organizationOid: 1
      };

      let mockDeployments = [
        {
          id: 'deployment_1',
          oid: 10000,
          instanceOid: 1000,
          serverVariantOid: 100
        }
      ];

      let mockVariants = [
        {
          id: 'variant_1',
          oid: 100,
          currentVersionOid: 1,
          prompts: [],
          tools: [],
          resourceTemplates: [],
          serverCapabilities: {},
          serverInfo: {},
          server: {
            id: 'server_1',
            oid: 10
          },
          serverDeployments: mockDeployments
        }
      ];

      vi.mocked(db.serverDeployment.findMany).mockResolvedValue(mockDeployments as any);
      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants as any);

      let result = await serverCapabilitiesService.getManyServerCapabilities({
        serverDeploymentIds: ['deployment_1'],
        instance: mockInstance as any
      });

      expect(result).toHaveLength(1);
      expect(result[0].serverDeployment).toBeDefined();
      expect(result[0].serverDeployment?.id).toBe('deployment_1');
    });

    it('should get capabilities by serverImplementationIds with instance', async () => {
      let mockInstance = {
        id: 'instance_1',
        oid: 1000,
        organizationOid: 1
      };

      let mockImplementations = [
        {
          id: 'impl_1',
          oid: 20000,
          instanceOid: 1000,
          serverVariantOid: 100
        }
      ];

      let mockVariants = [
        {
          id: 'variant_1',
          oid: 100,
          currentVersionOid: 1,
          prompts: [],
          tools: [],
          resourceTemplates: [],
          serverCapabilities: {},
          serverInfo: {},
          server: {
            id: 'server_1',
            oid: 10
          }
        }
      ];

      vi.mocked(db.serverImplementation.findMany).mockResolvedValue(mockImplementations as any);
      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants as any);

      let result = await serverCapabilitiesService.getManyServerCapabilities({
        serverImplementationIds: ['impl_1'],
        instance: mockInstance as any
      });

      expect(result).toHaveLength(1);
    });

    it('should handle legacy prompts format', async () => {
      let mockVariants = [
        {
          id: 'variant_1',
          oid: 100,
          currentVersionOid: 1,
          prompts: { prompts: [{ name: 'legacy_prompt' }] },
          tools: [],
          resourceTemplates: [],
          serverCapabilities: {},
          serverInfo: {},
          server: {
            id: 'server_1',
            oid: 10
          }
        }
      ];

      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants as any);

      let result = await serverCapabilitiesService.getManyServerCapabilities({
        serverVariantIds: ['variant_1']
      });

      expect(result).toHaveLength(1);
      expect(Array.isArray(result[0].prompts)).toBe(true);
      expect(result[0].prompts).toEqual([{ name: 'legacy_prompt' }]);
    });

    it('should handle legacy tools format', async () => {
      let mockVariants = [
        {
          id: 'variant_1',
          oid: 100,
          currentVersionOid: 1,
          prompts: [],
          tools: { tools: [{ name: 'legacy_tool' }] },
          resourceTemplates: [],
          serverCapabilities: {},
          serverInfo: {},
          server: {
            id: 'server_1',
            oid: 10
          }
        }
      ];

      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants as any);

      let result = await serverCapabilitiesService.getManyServerCapabilities({
        serverVariantIds: ['variant_1']
      });

      expect(result).toHaveLength(1);
      expect(Array.isArray(result[0].tools)).toBe(true);
      expect(result[0].tools).toEqual([{ name: 'legacy_tool' }]);
    });

    it('should handle legacy resourceTemplates format', async () => {
      let mockVariants = [
        {
          id: 'variant_1',
          oid: 100,
          currentVersionOid: 1,
          prompts: [],
          tools: [],
          resourceTemplates: {
            resourceTemplates: [{ name: 'legacy_template' }]
          },
          serverCapabilities: {},
          serverInfo: {},
          server: {
            id: 'server_1',
            oid: 10
          }
        }
      ];

      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants as any);

      let result = await serverCapabilitiesService.getManyServerCapabilities({
        serverVariantIds: ['variant_1']
      });

      expect(result).toHaveLength(1);
      expect(Array.isArray(result[0].resourceTemplates)).toBe(true);
      expect(result[0].resourceTemplates).toEqual([{ name: 'legacy_template' }]);
    });

    it('should prefer version data over variant data', async () => {
      let mockVersions = [
        {
          id: 'version_1',
          oid: 1,
          prompts: [{ name: 'version_prompt' }],
          tools: [{ name: 'version_tool' }],
          resourceTemplates: [{ name: 'version_template' }],
          serverCapabilities: { version: 'capability' },
          serverInfo: { version: '2.0.0' },
          server: {
            id: 'server_1',
            oid: 10
          },
          serverVariant: {
            id: 'variant_1',
            oid: 100,
            currentVersionOid: 1,
            prompts: [{ name: 'variant_prompt' }],
            tools: [{ name: 'variant_tool' }],
            resourceTemplates: [{ name: 'variant_template' }],
            serverCapabilities: { variant: 'capability' },
            serverInfo: { version: '1.0.0' }
          }
        }
      ];

      vi.mocked(db.serverVersion.findMany).mockResolvedValue(mockVersions as any);

      let result = await serverCapabilitiesService.getManyServerCapabilities({
        serverVersionIds: ['version_1']
      });

      expect(result).toHaveLength(1);
      expect(result[0].prompts).toEqual([{ name: 'version_prompt' }]);
      expect(result[0].tools).toEqual([{ name: 'version_tool' }]);
      expect(result[0].resourceTemplates).toEqual([{ name: 'version_template' }]);
      expect(result[0].capabilities).toEqual({ version: 'capability' });
      expect(result[0].info).toEqual({ version: '2.0.0' });
    });

    it('should generate hash-based id for capabilities', async () => {
      let mockVariants = [
        {
          id: 'variant_123',
          oid: 100,
          currentVersionOid: 1,
          prompts: [],
          tools: [],
          resourceTemplates: [],
          serverCapabilities: {},
          serverInfo: {},
          server: {
            id: 'server_1',
            oid: 10
          }
        }
      ];

      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants as any);
      vi.mocked(Hash.sha256).mockResolvedValue('abc123def456');

      let result = await serverCapabilitiesService.getManyServerCapabilities({
        serverVariantIds: ['variant_123']
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('mcsrv_abc123def456');
      expect(Hash.sha256).toHaveBeenCalledWith('variant_1231');
    });

    it('should handle multiple variants', async () => {
      let mockVariants = [
        {
          id: 'variant_1',
          oid: 100,
          currentVersionOid: 1,
          prompts: [],
          tools: [],
          resourceTemplates: [],
          serverCapabilities: {},
          serverInfo: {},
          server: {
            id: 'server_1',
            oid: 10
          }
        },
        {
          id: 'variant_2',
          oid: 200,
          currentVersionOid: 2,
          prompts: [],
          tools: [],
          resourceTemplates: [],
          serverCapabilities: {},
          serverInfo: {},
          server: {
            id: 'server_2',
            oid: 20
          }
        }
      ];

      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants as any);

      let result = await serverCapabilitiesService.getManyServerCapabilities({
        serverVariantIds: ['variant_1', 'variant_2']
      });

      expect(result).toHaveLength(2);
    });

    it('should limit results to 100', async () => {
      let mockVariants = Array.from({ length: 150 }, (_, i) => ({
        id: `variant_${i}`,
        oid: i,
        currentVersionOid: i,
        prompts: [],
        tools: [],
        resourceTemplates: [],
        serverCapabilities: {},
        serverInfo: {},
        server: {
          id: `server_${i}`,
          oid: i * 10
        }
      }));

      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants.slice(0, 100) as any);

      let result = await serverCapabilitiesService.getManyServerCapabilities({
        serverVariantIds: mockVariants.map(v => v.id)
      });

      expect(result).toHaveLength(100);
    });
  });

  describe('edge cases', () => {
    it('should handle empty arrays', async () => {
      vi.mocked(db.serverVersion.findMany).mockResolvedValue([]);

      let result = await serverCapabilitiesService.getManyServerCapabilities({
        serverVersionIds: []
      });

      expect(result).toHaveLength(0);
    });

    it('should handle undefined parameters', async () => {
      vi.mocked(db.serverVariant.findMany).mockResolvedValue([]);

      let result = await serverCapabilitiesService.getManyServerCapabilities({});

      expect(result).toHaveLength(0);
    });

    it('should handle null prompts, tools, and resourceTemplates', async () => {
      let mockVariants = [
        {
          id: 'variant_1',
          oid: 100,
          currentVersionOid: 1,
          prompts: null,
          tools: null,
          resourceTemplates: null,
          serverCapabilities: {},
          serverInfo: {},
          server: {
            id: 'server_1',
            oid: 10
          }
        }
      ];

      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants as any);

      let result = await serverCapabilitiesService.getManyServerCapabilities({
        serverVariantIds: ['variant_1']
      });

      expect(result).toHaveLength(1);
      expect(result[0].prompts).toEqual([]);
      expect(result[0].tools).toEqual([]);
      expect(result[0].resourceTemplates).toEqual([]);
    });

    it('should handle variants without deployment', async () => {
      let mockVariants = [
        {
          id: 'variant_1',
          oid: 100,
          currentVersionOid: 1,
          prompts: [],
          tools: [],
          resourceTemplates: [],
          serverCapabilities: {},
          serverInfo: {},
          server: {
            id: 'server_1',
            oid: 10
          }
        }
      ];

      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants as any);

      let result = await serverCapabilitiesService.getManyServerCapabilities({
        serverVariantIds: ['variant_1']
      });

      expect(result).toHaveLength(1);
      expect(result[0].serverDeployment).toBeUndefined();
    });

    it('should handle complex capabilities and info objects', async () => {
      let mockVariants = [
        {
          id: 'variant_1',
          oid: 100,
          currentVersionOid: 1,
          prompts: [],
          tools: [],
          resourceTemplates: [],
          serverCapabilities: {
            sampling: { max_tokens: 4096 },
            streaming: true,
            experimental: { feature: 'test' }
          },
          serverInfo: {
            version: '1.0.0',
            vendor: 'Test Vendor',
            metadata: { custom: 'data' }
          },
          server: {
            id: 'server_1',
            oid: 10
          }
        }
      ];

      vi.mocked(db.serverVariant.findMany).mockResolvedValue(mockVariants as any);

      let result = await serverCapabilitiesService.getManyServerCapabilities({
        serverVariantIds: ['variant_1']
      });

      expect(result).toHaveLength(1);
      expect(result[0].capabilities).toEqual({
        sampling: { max_tokens: 4096 },
        streaming: true,
        experimental: { feature: 'test' }
      });
      expect(result[0].info).toEqual({
        version: '1.0.0',
        vendor: 'Test Vendor',
        metadata: { custom: 'data' }
      });
    });
  });
});
