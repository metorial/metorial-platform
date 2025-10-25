import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueRetryError } from '@metorial/queue';

// Mock external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    magicMcpServer: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock('@metorial/module-search', () => ({
  searchService: {
    indexDocument: vi.fn()
  }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn((config) => ({
    name: config.name,
    process: vi.fn((fn) => fn),
    config
  })),
  QueueRetryError: class QueueRetryError extends Error {
    constructor() {
      super('Queue retry error');
      this.name = 'QueueRetryError';
    }
  }
}));

import { db } from '@metorial/db';
import { searchService } from '@metorial/module-search';
import { syncMagicMcpServerQueue, syncMagicMcpServerQueueProcessor } from '../src/queues/sync';

// Type assertion to make the processor callable in tests
const processor = syncMagicMcpServerQueueProcessor as any as (data: { magicMcpServerId: string }) => Promise<void>;

describe('syncMagicMcpServerQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queue configuration', () => {
    it('should have correct queue name', () => {
      expect(syncMagicMcpServerQueue.name).toBe('mgc/srv/snc');
    });
  });

  describe('syncMagicMcpServerQueueProcessor', () => {
    it('should index server document successfully', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        name: 'Test Server',
        description: 'Test Description',
        instance: {
          id: 'inst_1',
          oid: 'inst_oid_1'
        },
        serverDeployment: {
          serverDeployment: {
            name: 'Deployment Server',
            description: 'Deployment Description',
            server: {
              id: 'srv_1',
              name: 'Base Server'
            }
          }
        }
      };

      vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue(mockServer as any);
      vi.mocked(searchService.indexDocument).mockResolvedValue(undefined);

      await processor({ magicMcpServerId: 'mcp_srv_1' });

      expect(db.magicMcpServer.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'mcp_srv_1'
        },
        include: {
          instance: true,
          serverDeployment: {
            include: {
              serverDeployment: {
                include: {
                  server: true
                }
              }
            }
          }
        }
      });

      expect(searchService.indexDocument).toHaveBeenCalledWith({
        index: 'magic_mcp_server',
        document: {
          id: 'mcp_srv_1',
          instanceId: 'inst_1',
          name: 'Test Server',
          description: 'Test Description',
          serverName: 'Deployment Server',
          serverDescription: 'Deployment Description'
        }
      });
    });

    it('should throw QueueRetryError when server not found', async () => {
      vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue(null);

      await expect(
        processor({ magicMcpServerId: 'nonexistent' })
      ).rejects.toThrow(QueueRetryError);

      expect(searchService.indexDocument).not.toHaveBeenCalled();
    });

    it('should use server deployment name when server name is null', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        name: null,
        description: null,
        instance: {
          id: 'inst_1'
        },
        serverDeployment: {
          serverDeployment: {
            name: 'Deployment Server',
            description: 'Deployment Description',
            server: {
              id: 'srv_1'
            }
          }
        }
      };

      vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue(mockServer as any);
      vi.mocked(searchService.indexDocument).mockResolvedValue(undefined);

      await processor({ magicMcpServerId: 'mcp_srv_1' });

      expect(searchService.indexDocument).toHaveBeenCalledWith({
        index: 'magic_mcp_server',
        document: expect.objectContaining({
          name: 'Deployment Server',
          description: 'Deployment Description'
        })
      });
    });

    it('should prefer server name over deployment name', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        name: 'Custom Server Name',
        description: 'Custom Description',
        instance: {
          id: 'inst_1'
        },
        serverDeployment: {
          serverDeployment: {
            name: 'Deployment Server',
            description: 'Deployment Description',
            server: {
              id: 'srv_1'
            }
          }
        }
      };

      vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue(mockServer as any);
      vi.mocked(searchService.indexDocument).mockResolvedValue(undefined);

      await processor({ magicMcpServerId: 'mcp_srv_1' });

      expect(searchService.indexDocument).toHaveBeenCalledWith({
        index: 'magic_mcp_server',
        document: expect.objectContaining({
          name: 'Custom Server Name',
          description: 'Custom Description',
          serverName: 'Deployment Server',
          serverDescription: 'Deployment Description'
        })
      });
    });

    it('should include all required fields in indexed document', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        name: 'Test Server',
        description: 'Test Description',
        instance: {
          id: 'inst_1'
        },
        serverDeployment: {
          serverDeployment: {
            name: 'Deployment Server',
            description: 'Deployment Description',
            server: {
              id: 'srv_1'
            }
          }
        }
      };

      vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue(mockServer as any);
      vi.mocked(searchService.indexDocument).mockResolvedValue(undefined);

      await processor({ magicMcpServerId: 'mcp_srv_1' });

      expect(searchService.indexDocument).toHaveBeenCalledWith({
        index: 'magic_mcp_server',
        document: {
          id: expect.any(String),
          instanceId: expect.any(String),
          name: expect.any(String),
          description: expect.any(String),
          serverName: expect.any(String),
          serverDescription: expect.any(String)
        }
      });
    });

    it('should handle undefined descriptions gracefully', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        name: 'Test Server',
        description: undefined,
        instance: {
          id: 'inst_1'
        },
        serverDeployment: {
          serverDeployment: {
            name: 'Deployment Server',
            description: undefined,
            server: {
              id: 'srv_1'
            }
          }
        }
      };

      vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue(mockServer as any);
      vi.mocked(searchService.indexDocument).mockResolvedValue(undefined);

      await processor({ magicMcpServerId: 'mcp_srv_1' });

      expect(searchService.indexDocument).toHaveBeenCalledWith({
        index: 'magic_mcp_server',
        document: expect.objectContaining({
          id: 'mcp_srv_1',
          name: 'Test Server'
        })
      });
    });

    it('should handle server without deployment gracefully', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        name: 'Test Server',
        description: 'Test Description',
        instance: {
          id: 'inst_1'
        },
        serverDeployment: null
      };

      vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue(mockServer as any);
      vi.mocked(searchService.indexDocument).mockResolvedValue(undefined);

      await processor({ magicMcpServerId: 'mcp_srv_1' });

      expect(searchService.indexDocument).toHaveBeenCalledWith({
        index: 'magic_mcp_server',
        document: expect.objectContaining({
          id: 'mcp_srv_1',
          name: 'Test Server',
          description: 'Test Description',
          serverName: undefined,
          serverDescription: undefined
        })
      });
    });

    it('should use correct search index name', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        name: 'Test Server',
        instance: {
          id: 'inst_1'
        },
        serverDeployment: {
          serverDeployment: {
            name: 'Deployment',
            server: { id: 'srv_1' }
          }
        }
      };

      vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue(mockServer as any);
      vi.mocked(searchService.indexDocument).mockResolvedValue(undefined);

      await processor({ magicMcpServerId: 'mcp_srv_1' });

      expect(searchService.indexDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'magic_mcp_server'
        })
      );
    });

    it('should handle search service errors', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        name: 'Test Server',
        instance: {
          id: 'inst_1'
        },
        serverDeployment: {
          serverDeployment: {
            name: 'Deployment',
            server: { id: 'srv_1' }
          }
        }
      };

      vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue(mockServer as any);
      vi.mocked(searchService.indexDocument).mockRejectedValue(new Error('Search service error'));

      await expect(
        processor({ magicMcpServerId: 'mcp_srv_1' })
      ).rejects.toThrow('Search service error');
    });

    it('should handle database errors', async () => {
      vi.mocked(db.magicMcpServer.findUnique).mockRejectedValue(new Error('Database error'));

      await expect(
        processor({ magicMcpServerId: 'mcp_srv_1' })
      ).rejects.toThrow('Database error');

      expect(searchService.indexDocument).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty server ID', async () => {
      vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue(null);

      await expect(
        processor({ magicMcpServerId: '' })
      ).rejects.toThrow(QueueRetryError);
    });

    it('should handle server with very long names and descriptions', async () => {
      const longText = 'A'.repeat(10000);
      const mockServer = {
        id: 'mcp_srv_1',
        name: longText,
        description: longText,
        instance: {
          id: 'inst_1'
        },
        serverDeployment: {
          serverDeployment: {
            name: longText,
            description: longText,
            server: { id: 'srv_1' }
          }
        }
      };

      vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue(mockServer as any);
      vi.mocked(searchService.indexDocument).mockResolvedValue(undefined);

      await processor({ magicMcpServerId: 'mcp_srv_1' });

      expect(searchService.indexDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({
            name: longText,
            description: longText
          })
        })
      );
    });

    it('should handle server with special characters in name', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        name: 'Test Server @#$% & Special!',
        description: 'Description with émojis 🎉',
        instance: {
          id: 'inst_1'
        },
        serverDeployment: {
          serverDeployment: {
            name: 'Deployment',
            server: { id: 'srv_1' }
          }
        }
      };

      vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue(mockServer as any);
      vi.mocked(searchService.indexDocument).mockResolvedValue(undefined);

      await processor({ magicMcpServerId: 'mcp_srv_1' });

      expect(searchService.indexDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({
            name: 'Test Server @#$% & Special!',
            description: 'Description with émojis 🎉'
          })
        })
      );
    });

    it('should handle multiple consecutive sync calls', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        name: 'Test Server',
        instance: {
          id: 'inst_1'
        },
        serverDeployment: {
          serverDeployment: {
            name: 'Deployment',
            server: { id: 'srv_1' }
          }
        }
      };

      vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue(mockServer as any);
      vi.mocked(searchService.indexDocument).mockResolvedValue(undefined);

      await processor({ magicMcpServerId: 'mcp_srv_1' });
      await processor({ magicMcpServerId: 'mcp_srv_1' });
      await processor({ magicMcpServerId: 'mcp_srv_1' });

      expect(searchService.indexDocument).toHaveBeenCalledTimes(3);
    });

    it('should preserve instance ID in document', async () => {
      const mockServer = {
        id: 'mcp_srv_1',
        name: 'Test Server',
        instance: {
          id: 'unique_inst_123',
          oid: 'inst_oid_123'
        },
        serverDeployment: {
          serverDeployment: {
            name: 'Deployment',
            server: { id: 'srv_1' }
          }
        }
      };

      vi.mocked(db.magicMcpServer.findUnique).mockResolvedValue(mockServer as any);
      vi.mocked(searchService.indexDocument).mockResolvedValue(undefined);

      await processor({ magicMcpServerId: 'mcp_srv_1' });

      expect(searchService.indexDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          document: expect.objectContaining({
            instanceId: 'unique_inst_123'
          })
        })
      );
    });
  });
});
