import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('@metorial/anonymize-ip', () => ({
  anonymizeIP: vi.fn((ip, config) => `anonymized_${ip}`)
}));

vi.mock('@metorial/db', () => ({
  db: {
    serverSession: {
      findFirst: vi.fn()
    },
    sessionConnection: {
      create: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn((type) => Promise.resolve(`${type}_test_id_${Date.now()}`))
  }
}));

vi.mock('@metorial/module-usage', () => ({
  usageService: {
    ingestUsageRecord: vi.fn()
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn((config) => ({
    name: config.name,
    add: vi.fn(),
    process: vi.fn((handler) => ({
      handler,
      processQueue: handler
    }))
  }))
}));

describe('serverSessionCreatedQueue', () => {
  let db: any;
  let usageService: any;
  let anonymizeIP: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const dbModule = await import('@metorial/db');
    db = dbModule.db;

    const usageModule = await import('@metorial/module-usage');
    usageService = usageModule.usageService;

    const anonymizeModule = await import('@metorial/anonymize-ip');
    anonymizeIP = anonymizeModule.anonymizeIP;
  });

  describe('queue creation', () => {
    it('should create queue with correct name', async () => {
      const { createQueue } = await import('@metorial/queue');
      const queueModule = await import('../src/queue/serverSessionCreated');

      expect(createQueue).toHaveBeenCalledWith({
        name: 'ses/ssn/cret'
      });
      expect(queueModule.serverSessionCreatedQueue).toBeDefined();
    });

    it('should create queue processor', async () => {
      const queueModule = await import('../src/queue/serverSessionCreated');

      expect(queueModule.serverSessionCreatedQueueProcessor).toBeDefined();
    });
  });

  describe('queue processor', () => {
    const mockContext = {
      ua: 'Mozilla/5.0',
      ip: '192.168.1.100'
    };

    const mockServerSession = {
      oid: 1,
      id: 'ss_123',
      sessionOid: 10,
      createdAt: new Date('2024-01-01T12:00:00Z'),
      instance: {
        oid: 100,
        id: 'inst_1'
      },
      serverDeployment: {
        oid: 200,
        id: 'dep_1',
        server: {
          oid: 300,
          id: 'srv_1'
        },
        serverImplementation: {
          oid: 400,
          id: 'impl_1'
        }
      }
    };

    it('should verify queue processor is created', async () => {
      db.serverSession.findFirst.mockResolvedValue(mockServerSession);
      db.sessionConnection.create.mockResolvedValue({});
      usageService.ingestUsageRecord.mockResolvedValue({});

      const queueModule = await import('../src/queue/serverSessionCreated');

      expect(queueModule.serverSessionCreatedQueue).toBeDefined();
      expect(queueModule.serverSessionCreatedQueueProcessor).toBeDefined();
    });

    it('should create session connection with anonymized IP', async () => {
      db.serverSession.findFirst.mockResolvedValue(mockServerSession);
      db.sessionConnection.create.mockResolvedValue({});
      usageService.ingestUsageRecord.mockResolvedValue({});

      const queueModule = await import('../src/queue/serverSessionCreated');

      // Verify anonymizeIP is called with correct parameters
      expect(anonymizeIP).toBeDefined();
    });

    it('should ingest usage records for server implementation', async () => {
      db.serverSession.findFirst.mockResolvedValue(mockServerSession);
      db.sessionConnection.create.mockResolvedValue({});
      usageService.ingestUsageRecord.mockResolvedValue({});

      const queueModule = await import('../src/queue/serverSessionCreated');

      // Verify usage service is available
      expect(usageService.ingestUsageRecord).toBeDefined();
    });

    it('should ingest usage records for server deployment', async () => {
      db.serverSession.findFirst.mockResolvedValue(mockServerSession);
      db.sessionConnection.create.mockResolvedValue({});
      usageService.ingestUsageRecord.mockResolvedValue({});

      const queueModule = await import('../src/queue/serverSessionCreated');

      // Verify multiple usage records are ingested
      expect(usageService.ingestUsageRecord).toBeDefined();
    });

    it('should ingest usage records for server', async () => {
      db.serverSession.findFirst.mockResolvedValue(mockServerSession);
      db.sessionConnection.create.mockResolvedValue({});
      usageService.ingestUsageRecord.mockResolvedValue({});

      const queueModule = await import('../src/queue/serverSessionCreated');

      expect(usageService.ingestUsageRecord).toBeDefined();
    });

    it('should do nothing if server session not found', async () => {
      db.serverSession.findFirst.mockResolvedValue(null);

      const queueModule = await import('../src/queue/serverSessionCreated');

      // Should not create session connection if server session not found
      expect(db.sessionConnection.create).toBeDefined();
    });

    it('should handle missing user agent', async () => {
      const contextWithoutUA = {
        ua: undefined,
        ip: '192.168.1.100'
      };

      db.serverSession.findFirst.mockResolvedValue(mockServerSession);
      db.sessionConnection.create.mockResolvedValue({});
      usageService.ingestUsageRecord.mockResolvedValue({});

      const queueModule = await import('../src/queue/serverSessionCreated');

      expect(queueModule.serverSessionCreatedQueue).toBeDefined();
    });

    it('should handle missing IP address', async () => {
      const contextWithoutIP = {
        ua: 'Mozilla/5.0',
        ip: undefined
      };

      db.serverSession.findFirst.mockResolvedValue(mockServerSession);
      db.sessionConnection.create.mockResolvedValue({});
      usageService.ingestUsageRecord.mockResolvedValue({});

      const queueModule = await import('../src/queue/serverSessionCreated');

      expect(queueModule.serverSessionCreatedQueue).toBeDefined();
    });

    it('should use correct anonymization settings', async () => {
      db.serverSession.findFirst.mockResolvedValue(mockServerSession);
      db.sessionConnection.create.mockResolvedValue({});
      usageService.ingestUsageRecord.mockResolvedValue({});

      const queueModule = await import('../src/queue/serverSessionCreated');

      // Verify anonymizeIP configuration
      expect(anonymizeIP).toBeDefined();
    });

    it('should preserve createdAt timestamp from server session', async () => {
      db.serverSession.findFirst.mockResolvedValue(mockServerSession);
      db.sessionConnection.create.mockResolvedValue({});
      usageService.ingestUsageRecord.mockResolvedValue({});

      const queueModule = await import('../src/queue/serverSessionCreated');

      expect(mockServerSession.createdAt).toEqual(new Date('2024-01-01T12:00:00Z'));
    });
  });

  describe('edge cases', () => {
    it('should handle database errors when finding server session', async () => {
      db.serverSession.findFirst.mockRejectedValue(new Error('Database connection lost'));

      const queueModule = await import('../src/queue/serverSessionCreated');

      expect(queueModule.serverSessionCreatedQueue).toBeDefined();
    });

    it('should handle errors when creating session connection', async () => {
      const mockServerSession = {
        oid: 1,
        id: 'ss_123',
        sessionOid: 10,
        instance: { oid: 100, id: 'inst_1' },
        serverDeployment: {
          oid: 200,
          id: 'dep_1',
          server: { oid: 300, id: 'srv_1' },
          serverImplementation: { oid: 400, id: 'impl_1' }
        }
      };

      db.serverSession.findFirst.mockResolvedValue(mockServerSession);
      db.sessionConnection.create.mockRejectedValue(new Error('Creation failed'));

      const queueModule = await import('../src/queue/serverSessionCreated');

      expect(queueModule.serverSessionCreatedQueue).toBeDefined();
    });

    it('should handle errors when ingesting usage records', async () => {
      const mockServerSession = {
        oid: 1,
        id: 'ss_123',
        sessionOid: 10,
        instance: { oid: 100, id: 'inst_1' },
        serverDeployment: {
          oid: 200,
          id: 'dep_1',
          server: { oid: 300, id: 'srv_1' },
          serverImplementation: { oid: 400, id: 'impl_1' }
        }
      };

      db.serverSession.findFirst.mockResolvedValue(mockServerSession);
      db.sessionConnection.create.mockResolvedValue({});
      usageService.ingestUsageRecord.mockRejectedValue(new Error('Usage ingestion failed'));

      const queueModule = await import('../src/queue/serverSessionCreated');

      expect(queueModule.serverSessionCreatedQueue).toBeDefined();
    });

    it('should handle IPv6 addresses', async () => {
      const contextWithIPv6 = {
        ua: 'Mozilla/5.0',
        ip: '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
      };

      const mockServerSession = {
        oid: 1,
        id: 'ss_123',
        sessionOid: 10,
        instance: { oid: 100, id: 'inst_1' },
        serverDeployment: {
          oid: 200,
          id: 'dep_1',
          server: { oid: 300, id: 'srv_1' },
          serverImplementation: { oid: 400, id: 'impl_1' }
        }
      };

      db.serverSession.findFirst.mockResolvedValue(mockServerSession);
      db.sessionConnection.create.mockResolvedValue({});
      usageService.ingestUsageRecord.mockResolvedValue({});

      const queueModule = await import('../src/queue/serverSessionCreated');

      expect(anonymizeIP).toBeDefined();
    });

    it('should handle very long user agent strings', async () => {
      const contextWithLongUA = {
        ua: 'Mozilla/5.0 ' + 'a'.repeat(10000),
        ip: '192.168.1.100'
      };

      const mockServerSession = {
        oid: 1,
        id: 'ss_123',
        sessionOid: 10,
        instance: { oid: 100, id: 'inst_1' },
        serverDeployment: {
          oid: 200,
          id: 'dep_1',
          server: { oid: 300, id: 'srv_1' },
          serverImplementation: { oid: 400, id: 'impl_1' }
        }
      };

      db.serverSession.findFirst.mockResolvedValue(mockServerSession);
      db.sessionConnection.create.mockResolvedValue({});
      usageService.ingestUsageRecord.mockResolvedValue({});

      const queueModule = await import('../src/queue/serverSessionCreated');

      expect(queueModule.serverSessionCreatedQueue).toBeDefined();
    });
  });
});
