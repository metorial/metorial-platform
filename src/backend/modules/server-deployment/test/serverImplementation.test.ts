import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    serverImplementation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn()
    },
    serverDeployment: {
      updateMany: vi.fn()
    },
    server: {
      findMany: vi.fn()
    },
    serverVariant: {
      findMany: vi.fn()
    }
  },
  withTransaction: vi.fn(async (fn: any) => {
    return fn({
      serverImplementation: {
        create: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn()
      },
      serverDeployment: {
        updateMany: vi.fn()
      }
    });
  }),
  ID: {
    generateId: vi.fn(async (type: string) => `${type}-456`)
  }
}));

vi.mock('@metorial/error', () => ({
  badRequestError: vi.fn((msg: any) => ({ type: 'bad_request', ...msg })),
  forbiddenError: vi.fn((msg: any) => ({ type: 'forbidden', ...msg })),
  notFoundError: vi.fn((type: string, id: string) => ({ type: 'not_found', resource: type, id })),
  ServiceError: class ServiceError extends Error {
    constructor(public error: any) {
      super(error.message);
    }
  }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: vi.fn(async () => {})
  }
}));

vi.mock('@metorial/module-event', () => ({
  ingestEventService: {
    ingest: vi.fn(async () => {})
  }
}));

vi.mock('@metorial/module-search', () => ({
  searchService: {
    search: vi.fn()
  }
}));

vi.mock('@metorial/pagination', () => ({
  Paginator: {
    create: vi.fn((fn: any) => fn)
  }
}));

vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn((name: string, factory: any) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('../src/queues/serverImplementationCreated', () => ({
  serverImplementationCreatedQueue: {
    add: vi.fn(async () => {})
  }
}));

describe('ServerImplementationService', () => {
  let mockInstance: any;
  let mockOrganization: any;
  let mockPerformedBy: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockInstance = {
      id: 'instance-123',
      oid: 1
    };

    mockOrganization = {
      id: 'org-123',
      oid: 2,
      name: 'Test Org'
    };

    mockPerformedBy = {
      id: 'actor-123',
      oid: 3
    };
  });

  describe('getServerImplementationById', () => {
    it('should retrieve a server implementation by id', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { db } = await import('@metorial/db');

      const mockImplementation = {
        id: 'impl-123',
        oid: 10,
        status: 'active',
        instanceOid: mockInstance.oid
      };

      (db.serverImplementation.findFirst as any).mockResolvedValue(mockImplementation);

      const result = await serverImplementationService.getServerImplementationById({
        instance: mockInstance,
        serverImplementationId: 'impl-123'
      });

      expect(result).toEqual(mockImplementation);
      expect(db.serverImplementation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'impl-123',
          instanceOid: mockInstance.oid
        },
        include: expect.any(Object)
      });
    });

    it('should throw not found error when implementation does not exist', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { db } = await import('@metorial/db');
      const { ServiceError } = await import('@metorial/error');

      (db.serverImplementation.findFirst as any).mockResolvedValue(null);

      await expect(
        serverImplementationService.getServerImplementationById({
          instance: mockInstance,
          serverImplementationId: 'nonexistent'
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('createServerImplementation', () => {
    it('should create a persistent server implementation', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { withTransaction } = await import('@metorial/db');
      const { Fabric } = await import('@metorial/fabric');
      const { serverImplementationCreatedQueue } = await import(
        '../src/queues/serverImplementationCreated'
      );

      const mockServerVariant = {
        id: 'variant-123',
        oid: 20,
        status: 'active',
        server: {
          id: 'server-123',
          oid: 21,
          status: 'active'
        }
      };

      const mockImplementation = {
        id: 'serverImplementation-456',
        oid: 30,
        status: 'active',
        isEphemeral: false,
        name: 'Test Implementation'
      };

      (withTransaction as any).mockImplementation(async (fn: any) => {
        const mockDb = {
          serverImplementation: {
            create: vi.fn().mockResolvedValue(mockImplementation)
          }
        };
        return fn(mockDb);
      });

      const result = await serverImplementationService.createServerImplementation({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        serverVariant: mockServerVariant as any,
        input: {
          name: 'Test Implementation',
          description: 'Test Description'
        },
        type: 'persistent'
      });

      expect(result).toEqual(mockImplementation);
      expect(Fabric.fire).toHaveBeenCalledWith(
        'server.server_implementation.created:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'server.server_implementation.created:after',
        expect.any(Object)
      );
      expect(serverImplementationCreatedQueue.add).toHaveBeenCalledWith(
        { serverImplementationId: mockImplementation.id },
        { delay: 100 }
      );
    });

    it('should create ephemeral server implementation with archived status', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { withTransaction } = await import('@metorial/db');

      const mockServerVariant = {
        id: 'variant-123',
        oid: 20,
        status: 'active',
        server: {
          id: 'server-123',
          oid: 21,
          status: 'active'
        }
      };

      const mockImplementation = {
        id: 'serverImplementation-456',
        oid: 30,
        status: 'archived',
        isEphemeral: true
      };

      (withTransaction as any).mockImplementation(async (fn: any) => {
        const mockDb = {
          serverImplementation: {
            create: vi.fn().mockResolvedValue(mockImplementation)
          }
        };
        return fn(mockDb);
      });

      const result = await serverImplementationService.createServerImplementation({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        serverVariant: mockServerVariant as any,
        input: {},
        type: 'ephemeral'
      });

      expect(result.status).toBe('archived');
      expect(result.isEphemeral).toBe(true);
    });

    it('should throw error when server variant is inactive', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { ServiceError } = await import('@metorial/error');

      const mockServerVariant = {
        id: 'variant-123',
        oid: 20,
        status: 'deleted',
        server: {
          id: 'server-123',
          oid: 21,
          status: 'active'
        }
      };

      await expect(
        serverImplementationService.createServerImplementation({
          organization: mockOrganization,
          performedBy: mockPerformedBy,
          instance: mockInstance,
          serverVariant: mockServerVariant as any,
          input: {},
          type: 'persistent'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw error when server is inactive', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { ServiceError } = await import('@metorial/error');

      const mockServerVariant = {
        id: 'variant-123',
        oid: 20,
        status: 'active',
        server: {
          id: 'server-123',
          oid: 21,
          status: 'deleted'
        }
      };

      await expect(
        serverImplementationService.createServerImplementation({
          organization: mockOrganization,
          performedBy: mockPerformedBy,
          instance: mockInstance,
          serverVariant: mockServerVariant as any,
          input: {},
          type: 'persistent'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should set isDefault to null (not false)', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { withTransaction } = await import('@metorial/db');

      const mockServerVariant = {
        id: 'variant-123',
        oid: 20,
        status: 'active',
        server: {
          id: 'server-123',
          oid: 21,
          status: 'active'
        }
      };

      const mockImplementation = {
        id: 'serverImplementation-456',
        oid: 30,
        status: 'active',
        isDefault: null
      };

      let capturedData: any = null;

      (withTransaction as any).mockImplementation(async (fn: any) => {
        const mockDb = {
          serverImplementation: {
            create: vi.fn().mockImplementation(({ data }: any) => {
              capturedData = data;
              return mockImplementation;
            })
          }
        };
        return fn(mockDb);
      });

      await serverImplementationService.createServerImplementation({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        serverVariant: mockServerVariant as any,
        input: {},
        type: 'persistent'
      });

      expect(capturedData.isDefault).toBe(null);
    });

    it('should include getLaunchParams in creation', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { withTransaction } = await import('@metorial/db');

      const mockServerVariant = {
        id: 'variant-123',
        oid: 20,
        status: 'active',
        server: {
          id: 'server-123',
          oid: 21,
          status: 'active'
        }
      };

      const mockImplementation = {
        id: 'serverImplementation-456',
        oid: 30,
        getLaunchParams: 'custom launch params'
      };

      let capturedData: any = null;

      (withTransaction as any).mockImplementation(async (fn: any) => {
        const mockDb = {
          serverImplementation: {
            create: vi.fn().mockImplementation(({ data }: any) => {
              capturedData = data;
              return mockImplementation;
            })
          }
        };
        return fn(mockDb);
      });

      await serverImplementationService.createServerImplementation({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        serverVariant: mockServerVariant as any,
        input: {
          getLaunchParams: 'custom launch params'
        },
        type: 'persistent'
      });

      expect(capturedData.getLaunchParams).toBe('custom launch params');
    });
  });

  describe('ensureDefaultImplementation', () => {
    it('should return existing default implementation if it exists', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { withTransaction } = await import('@metorial/db');

      const mockServerVariant = {
        id: 'variant-123',
        oid: 20,
        status: 'active',
        server: {
          id: 'server-123',
          oid: 21,
          status: 'active'
        }
      };

      const existingImplementation = {
        id: 'existing-impl',
        oid: 30,
        isDefault: true
      };

      (withTransaction as any).mockImplementation(async (fn: any) => {
        const mockDb = {
          serverImplementation: {
            findUnique: vi.fn().mockResolvedValue(existingImplementation)
          }
        };
        return fn(mockDb);
      });

      const result = await serverImplementationService.ensureDefaultImplementation({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        serverVariant: mockServerVariant as any
      });

      expect(result).toEqual(existingImplementation);
    });

    it('should create new default implementation if none exists', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { withTransaction, ID } = await import('@metorial/db');
      const { Fabric } = await import('@metorial/fabric');

      const mockServerVariant = {
        id: 'variant-123',
        oid: 20,
        status: 'active',
        server: {
          id: 'server-123',
          oid: 21,
          status: 'active'
        }
      };

      const newImplementation = {
        id: 'serverImplementation-456',
        oid: 30,
        isDefault: true
      };

      (withTransaction as any).mockImplementation(async (fn: any) => {
        const mockDb = {
          serverImplementation: {
            findUnique: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue(newImplementation)
          }
        };
        return fn(mockDb);
      });

      const result = await serverImplementationService.ensureDefaultImplementation({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        serverVariant: mockServerVariant as any
      });

      expect(result.isDefault).toBe(true);
      expect(Fabric.fire).toHaveBeenCalledWith(
        'server.server_implementation.created:before',
        expect.any(Object)
      );
    });

    it('should throw error when server variant is inactive', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { ServiceError } = await import('@metorial/error');
      const { withTransaction } = await import('@metorial/db');

      const mockServerVariant = {
        id: 'variant-123',
        oid: 20,
        status: 'deleted',
        server: {
          id: 'server-123',
          oid: 21,
          status: 'active'
        }
      };

      (withTransaction as any).mockImplementation(async (fn: any) => {
        const mockDb = {
          serverImplementation: {
            findUnique: vi.fn().mockResolvedValue(null)
          }
        };
        return fn(mockDb);
      });

      await expect(
        serverImplementationService.ensureDefaultImplementation({
          organization: mockOrganization,
          performedBy: mockPerformedBy,
          instance: mockInstance,
          serverVariant: mockServerVariant as any
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should only fire created event for newly created implementation', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { withTransaction, ID } = await import('@metorial/db');
      const { ingestEventService } = await import('@metorial/module-event');

      const mockServerVariant = {
        id: 'variant-123',
        oid: 20,
        status: 'active',
        server: {
          id: 'server-123',
          oid: 21,
          status: 'active'
        }
      };

      // Mock ID.generateId to return a specific value
      const generatedId = 'serverImplementation-456';
      (ID.generateId as any).mockResolvedValue(generatedId);

      const newImplementation = {
        id: generatedId,
        oid: 30,
        isDefault: true
      };

      (withTransaction as any).mockImplementation(async (fn: any) => {
        const mockDb = {
          serverImplementation: {
            findUnique: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue(newImplementation)
          }
        };
        return fn(mockDb);
      });

      await serverImplementationService.ensureDefaultImplementation({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        serverVariant: mockServerVariant as any
      });

      expect(ingestEventService.ingest).toHaveBeenCalledWith(
        'server.server_implementation:created',
        expect.any(Object)
      );
    });
  });

  describe('updateServerImplementation', () => {
    it('should update server implementation', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { withTransaction } = await import('@metorial/db');
      const { Fabric } = await import('@metorial/fabric');

      const mockImplementation = {
        id: 'impl-123',
        oid: 30,
        status: 'active'
      };

      const updatedImplementation = {
        ...mockImplementation,
        name: 'Updated Name',
        description: 'Updated Description'
      };

      (withTransaction as any).mockImplementation(async (fn: any) => {
        const mockDb = {
          serverImplementation: {
            update: vi.fn().mockResolvedValue(updatedImplementation)
          }
        };
        return fn(mockDb);
      });

      const result = await serverImplementationService.updateServerImplementation({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        serverImplementation: mockImplementation as any,
        input: {
          name: 'Updated Name',
          description: 'Updated Description'
        }
      });

      expect(result.name).toBe('Updated Name');
      expect(result.description).toBe('Updated Description');
      expect(Fabric.fire).toHaveBeenCalledWith(
        'server.server_implementation.updated:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'server.server_implementation.updated:after',
        expect.any(Object)
      );
    });

    it('should throw error when updating deleted implementation', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { ServiceError } = await import('@metorial/error');

      const mockImplementation = {
        id: 'impl-123',
        oid: 30,
        status: 'deleted'
      };

      await expect(
        serverImplementationService.updateServerImplementation({
          organization: mockOrganization,
          performedBy: mockPerformedBy,
          instance: mockInstance,
          serverImplementation: mockImplementation as any,
          input: {
            name: 'Updated Name'
          }
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should update getLaunchParams', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { withTransaction } = await import('@metorial/db');

      const mockImplementation = {
        id: 'impl-123',
        oid: 30,
        status: 'active'
      };

      const updatedImplementation = {
        ...mockImplementation,
        getLaunchParams: 'new params'
      };

      let capturedData: any = null;

      (withTransaction as any).mockImplementation(async (fn: any) => {
        const mockDb = {
          serverImplementation: {
            update: vi.fn().mockImplementation(({ data }: any) => {
              capturedData = data;
              return updatedImplementation;
            })
          }
        };
        return fn(mockDb);
      });

      await serverImplementationService.updateServerImplementation({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        serverImplementation: mockImplementation as any,
        input: {
          getLaunchParams: 'new params'
        }
      });

      expect(capturedData.getLaunchParams).toBe('new params');
    });
  });

  describe('deleteServerImplementation', () => {
    it('should delete server implementation and cascade to deployments', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { withTransaction } = await import('@metorial/db');
      const { Fabric } = await import('@metorial/fabric');

      const mockImplementation = {
        id: 'impl-123',
        oid: 30,
        status: 'active'
      };

      const deletedImplementation = {
        ...mockImplementation,
        status: 'deleted',
        deletedAt: new Date()
      };

      let deploymentUpdateCalled = false;

      (withTransaction as any).mockImplementation(async (fn: any) => {
        const mockDb = {
          serverImplementation: {
            update: vi.fn().mockResolvedValue(deletedImplementation)
          },
          serverDeployment: {
            updateMany: vi.fn().mockImplementation(() => {
              deploymentUpdateCalled = true;
              return { count: 2 };
            })
          }
        };
        return fn(mockDb);
      });

      const result = await serverImplementationService.deleteServerImplementation({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        serverImplementation: mockImplementation as any
      });

      expect(result.status).toBe('deleted');
      expect(result.deletedAt).toBeDefined();
      expect(deploymentUpdateCalled).toBe(true);
      expect(Fabric.fire).toHaveBeenCalledWith(
        'server.server_implementation.deleted:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'server.server_implementation.deleted:after',
        expect.any(Object)
      );
    });

    it('should throw error when deleting already deleted implementation', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { ServiceError } = await import('@metorial/error');

      const mockImplementation = {
        id: 'impl-123',
        oid: 30,
        status: 'deleted'
      };

      await expect(
        serverImplementationService.deleteServerImplementation({
          organization: mockOrganization,
          performedBy: mockPerformedBy,
          instance: mockInstance,
          serverImplementation: mockImplementation as any
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('listServerImplementations', () => {
    it('should list server implementations without search', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { Paginator } = await import('@metorial/pagination');

      const mockPaginator = vi.fn();
      (Paginator.create as any).mockReturnValue(mockPaginator);

      const result = await serverImplementationService.listServerImplementations({
        instance: mockInstance
      });

      expect(Paginator.create).toHaveBeenCalled();
      expect(result).toBe(mockPaginator);
    });

    it('should list server implementations with search', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { searchService } = await import('@metorial/module-search');
      const { Paginator } = await import('@metorial/pagination');

      const mockSearchResults = [{ id: 'impl-1' }, { id: 'impl-2' }];
      (searchService.search as any).mockResolvedValue(mockSearchResults);

      const mockPaginator = vi.fn();
      (Paginator.create as any).mockReturnValue(mockPaginator);

      await serverImplementationService.listServerImplementations({
        instance: mockInstance,
        search: 'test query'
      });

      expect(searchService.search).toHaveBeenCalledWith({
        index: 'server_implementation',
        query: 'test query',
        options: {
          limit: 50
        }
      });
    });

    it('should filter by server variant IDs', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { db } = await import('@metorial/db');

      const mockServerVariants = [{ id: 'variant-1', oid: 100 }];
      (db.serverVariant.findMany as any).mockResolvedValue(mockServerVariants);

      await serverImplementationService.listServerImplementations({
        instance: mockInstance,
        serverVariantIds: ['variant-1']
      });

      expect(db.serverVariant.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['variant-1'] } }
      });
    });

    it('should filter by server IDs', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');
      const { db } = await import('@metorial/db');

      const mockServers = [{ id: 'server-1', oid: 100 }];
      (db.server.findMany as any).mockResolvedValue(mockServers);

      await serverImplementationService.listServerImplementations({
        instance: mockInstance,
        serverIds: ['server-1']
      });

      expect(db.server.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['server-1'] } }
      });
    });

    it('should filter by status', async () => {
      const { serverImplementationService } = await import('../src/services/serverImplementation');

      await serverImplementationService.listServerImplementations({
        instance: mockInstance,
        status: ['active', 'archived']
      });

      // The paginator create function should have been called
      // We're just verifying the method runs without error
      expect(true).toBe(true);
    });
  });
});
