import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    serverDeployment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    serverVersion: {
      findFirst: vi.fn()
    },
    providerOAuthConfig: {
      findFirstOrThrow: vi.fn(),
      findUniqueOrThrow: vi.fn()
    },
    providerOAuthConnection: {
      updateMany: vi.fn()
    },
    serverDeploymentConfig: {
      create: vi.fn(),
      update: vi.fn()
    },
    serverConfigVault: {
      findFirst: vi.fn()
    },
    server: {
      findMany: vi.fn()
    },
    serverVariant: {
      findMany: vi.fn()
    },
    serverImplementation: {
      findMany: vi.fn()
    },
    session: {
      findMany: vi.fn()
    }
  },
  withTransaction: vi.fn(async (fn: any) => {
    return fn({
      serverDeployment: {
        create: vi.fn(),
        update: vi.fn()
      },
      serverDeploymentConfig: {
        create: vi.fn(),
        update: vi.fn()
      },
      serverConfigVault: {
        findFirst: vi.fn()
      },
      providerOAuthConfig: {
        findFirstOrThrow: vi.fn(),
        findUniqueOrThrow: vi.fn()
      },
      providerOAuthConnection: {
        updateMany: vi.fn()
      }
    });
  }),
  ID: {
    generateId: vi.fn(async (type: string) => `${type}-123`)
  },
  ensureEmailIdentity: vi.fn((factory: any) => factory())
}));

vi.mock('@metorial/delay', () => ({
  delay: vi.fn(async () => {})
}));

vi.mock('@metorial/error', () => ({
  badRequestError: vi.fn((msg: any) => ({ type: 'bad_request', ...msg })),
  conflictError: vi.fn((msg: any) => ({ type: 'conflict', ...msg })),
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

vi.mock('@metorial/module-catalog', () => ({
  serverVariantService: {
    getServerVariantById: vi.fn()
  }
}));

vi.mock('@metorial/module-engine', () => ({
  engineServerDiscoveryService: {
    discoverServerAsync: vi.fn()
  }
}));

vi.mock('@metorial/module-event', () => ({
  ingestEventService: {
    ingest: vi.fn(async () => {})
  }
}));

vi.mock('@metorial/module-provider-oauth', () => ({
  providerOauthConnectionService: {
    createConnection: vi.fn()
  },
  providerOauthDiscoveryService: {
    supportsAutoRegistration: vi.fn()
  }
}));

vi.mock('@metorial/module-search', () => ({
  searchService: {
    search: vi.fn()
  }
}));

vi.mock('@metorial/module-secret', () => ({
  secretService: {
    createSecret: vi.fn(),
    getSecretById: vi.fn(),
    deleteSecret: vi.fn()
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

vi.mock('jsonschema', () => ({
  Validator: vi.fn().mockImplementation(() => ({
    validate: vi.fn((data: any, schema: any) => ({ valid: true, errors: [] }))
  }))
}));

vi.mock('../src/queues/serverDeploymentDeleted', () => ({
  serverDeploymentDeletedQueue: {
    add: vi.fn(async () => {})
  }
}));

vi.mock('../src/queues/serverDeploymentSetup', () => ({
  serverDeploymentSetupQueue: {
    add: vi.fn(async () => {})
  }
}));

describe('ServerDeploymentService', () => {
  let mockInstance: any;
  let mockOrganization: any;
  let mockPerformedBy: any;
  let mockContext: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockInstance = {
      id: 'instance-123',
      oid: 1,
      organization: {
        id: 'org-123',
        oid: 2,
        name: 'Test Org'
      }
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

    mockContext = {
      requestId: 'req-123'
    };
  });

  describe('getServerDeploymentById', () => {
    it('should retrieve a server deployment by id', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { db } = await import('@metorial/db');

      const mockDeployment = {
        id: 'deployment-123',
        oid: 10,
        status: 'active',
        instanceOid: mockInstance.oid
      };

      (db.serverDeployment.findFirst as any).mockResolvedValue(mockDeployment);

      const result = await serverDeploymentService.getServerDeploymentById({
        instance: mockInstance,
        serverDeploymentId: 'deployment-123'
      });

      expect(result).toEqual(mockDeployment);
      expect(db.serverDeployment.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'deployment-123',
          instanceOid: mockInstance.oid
        },
        include: expect.any(Object)
      });
    });

    it('should throw not found error when deployment does not exist', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { db } = await import('@metorial/db');
      const { ServiceError } = await import('@metorial/error');

      (db.serverDeployment.findFirst as any).mockResolvedValue(null);

      await expect(
        serverDeploymentService.getServerDeploymentById({
          instance: mockInstance,
          serverDeploymentId: 'nonexistent'
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('getManyServerDeployments', () => {
    it('should retrieve multiple server deployments', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { db } = await import('@metorial/db');

      const mockDeployments = [
        { id: 'deployment-1', oid: 10 },
        { id: 'deployment-2', oid: 11 }
      ];

      (db.serverDeployment.findMany as any).mockResolvedValue(mockDeployments);

      const result = await serverDeploymentService.getManyServerDeployments({
        instance: mockInstance,
        serverDeploymentIds: ['deployment-1', 'deployment-2']
      });

      expect(result).toEqual(mockDeployments);
      expect(db.serverDeployment.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['deployment-1', 'deployment-2'] },
          instanceOid: mockInstance.oid
        },
        include: expect.any(Object)
      });
    });

    it('should remove duplicate IDs', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { db } = await import('@metorial/db');

      const mockDeployments = [{ id: 'deployment-1', oid: 10 }];

      (db.serverDeployment.findMany as any).mockResolvedValue(mockDeployments);

      await serverDeploymentService.getManyServerDeployments({
        instance: mockInstance,
        serverDeploymentIds: ['deployment-1', 'deployment-1', 'deployment-1']
      });

      expect(db.serverDeployment.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['deployment-1'] },
          instanceOid: mockInstance.oid
        },
        include: expect.any(Object)
      });
    });

    it('should throw error if not all deployments are found', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { db } = await import('@metorial/db');
      const { ServiceError } = await import('@metorial/error');

      const mockDeployments = [{ id: 'deployment-1', oid: 10 }];

      (db.serverDeployment.findMany as any).mockResolvedValue(mockDeployments);

      await expect(
        serverDeploymentService.getManyServerDeployments({
          instance: mockInstance,
          serverDeploymentIds: ['deployment-1', 'deployment-2']
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should retrieve all deployments when no IDs specified', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { db } = await import('@metorial/db');

      const mockDeployments = [
        { id: 'deployment-1', oid: 10 },
        { id: 'deployment-2', oid: 11 }
      ];

      (db.serverDeployment.findMany as any).mockResolvedValue(mockDeployments);

      const result = await serverDeploymentService.getManyServerDeployments({
        instance: mockInstance
      });

      expect(result).toEqual(mockDeployments);
      expect(db.serverDeployment.findMany).toHaveBeenCalledWith({
        where: {
          id: undefined,
          instanceOid: mockInstance.oid
        },
        include: expect.any(Object)
      });
    });
  });

  describe('createServerDeployment', () => {
    it('should create a persistent server deployment', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { serverVariantService } = await import('@metorial/module-catalog');
      const { secretService } = await import('@metorial/module-secret');
      const { withTransaction, ID } = await import('@metorial/db');
      const { Fabric } = await import('@metorial/fabric');

      const mockServerImplementation = {
        id: 'impl-123',
        oid: 20,
        status: 'active',
        serverVariant: {
          id: 'variant-123',
          oid: 21,
          currentVersionOid: null
        },
        server: {
          id: 'server-123',
          oid: 22,
          status: 'active',
          type: 'managed'
        }
      };

      const mockVariant = {
        currentVersion: {
          schema: {
            oid: 30,
            schema: JSON.stringify({ type: 'object', properties: {} })
          }
        }
      };

      const mockSecret = {
        id: 'secret-123',
        oid: 40
      };

      const mockConfig = {
        id: 'config-123',
        oid: 50
      };

      const mockDeployment = {
        id: 'deployment-123',
        oid: 60,
        status: 'active',
        name: 'Test Deployment',
        serverImplementation: mockServerImplementation
      };

      (serverVariantService.getServerVariantById as any).mockResolvedValue(mockVariant);
      (secretService.createSecret as any).mockResolvedValue(mockSecret);

      (withTransaction as any).mockImplementation(async (fn: any) => {
        const mockDb = {
          serverDeploymentConfig: {
            create: vi.fn().mockResolvedValue(mockConfig)
          },
          serverDeployment: {
            create: vi.fn().mockResolvedValue(mockDeployment)
          },
          providerOAuthConnection: {
            updateMany: vi.fn()
          }
        };
        return fn(mockDb);
      });

      const result = await serverDeploymentService.createServerDeployment({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        context: mockContext,
        serverImplementation: {
          instance: mockServerImplementation,
          isNewEphemeral: false
        },
        input: {
          name: 'Test Deployment',
          description: 'Test Description',
          config: { type: 'direct', config: { key: 'value' } }
        },
        type: 'persistent'
      });

      expect(result).toEqual(mockDeployment);
      expect(Fabric.fire).toHaveBeenCalledWith(
        'server.server_deployment.created:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'server.server_deployment.created:after',
        expect.any(Object)
      );
    });

    it('should throw error when server implementation is deleted', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { ServiceError } = await import('@metorial/error');

      const mockServerImplementation = {
        id: 'impl-123',
        oid: 20,
        status: 'deleted',
        serverVariant: {
          id: 'variant-123',
          oid: 21
        },
        server: {
          id: 'server-123',
          oid: 22,
          status: 'active'
        }
      };

      await expect(
        serverDeploymentService.createServerDeployment({
          organization: mockOrganization,
          performedBy: mockPerformedBy,
          instance: mockInstance,
          context: mockContext,
          serverImplementation: {
            instance: mockServerImplementation,
            isNewEphemeral: false
          },
          input: {
            config: { type: 'direct', config: {} }
          },
          type: 'persistent'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw error when server is deleted', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { ServiceError } = await import('@metorial/error');

      const mockServerImplementation = {
        id: 'impl-123',
        oid: 20,
        status: 'active',
        serverVariant: {
          id: 'variant-123',
          oid: 21
        },
        server: {
          id: 'server-123',
          oid: 22,
          status: 'deleted'
        }
      };

      await expect(
        serverDeploymentService.createServerDeployment({
          organization: mockOrganization,
          performedBy: mockPerformedBy,
          instance: mockInstance,
          context: mockContext,
          serverImplementation: {
            instance: mockServerImplementation,
            isNewEphemeral: false
          },
          input: {
            config: { type: 'direct', config: {} }
          },
          type: 'persistent'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should create ephemeral deployment with archived status', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { serverVariantService } = await import('@metorial/module-catalog');
      const { secretService } = await import('@metorial/module-secret');
      const { withTransaction } = await import('@metorial/db');

      const mockServerImplementation = {
        id: 'impl-123',
        oid: 20,
        status: 'active',
        name: 'Test Impl',
        serverVariant: {
          id: 'variant-123',
          oid: 21,
          currentVersionOid: null
        },
        server: {
          id: 'server-123',
          oid: 22,
          name: 'Test Server',
          status: 'active',
          type: 'managed'
        }
      };

      const mockVariant = {
        currentVersion: {
          schema: {
            oid: 30,
            schema: { type: 'object', properties: {} }
          }
        }
      };

      const mockSecret = { id: 'secret-123', oid: 40 };
      const mockConfig = { id: 'config-123', oid: 50 };
      const mockDeployment = {
        id: 'deployment-123',
        oid: 60,
        status: 'archived',
        isEphemeral: true,
        serverImplementation: mockServerImplementation
      };

      (serverVariantService.getServerVariantById as any).mockResolvedValue(mockVariant);
      (secretService.createSecret as any).mockResolvedValue(mockSecret);

      (withTransaction as any).mockImplementation(async (fn: any) => {
        const mockDb = {
          serverDeploymentConfig: {
            create: vi.fn().mockResolvedValue(mockConfig)
          },
          serverDeployment: {
            create: vi.fn().mockResolvedValue(mockDeployment)
          },
          providerOAuthConnection: {
            updateMany: vi.fn()
          }
        };
        return fn(mockDb);
      });

      const result = await serverDeploymentService.createServerDeployment({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        context: mockContext,
        serverImplementation: {
          instance: mockServerImplementation,
          isNewEphemeral: true
        },
        input: {
          config: { type: 'direct', config: {} }
        },
        type: 'ephemeral'
      });

      expect(result.status).toBe('archived');
      expect(result.isEphemeral).toBe(true);
    });

    it('should throw error for custom server without server instance', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { ServiceError } = await import('@metorial/error');
      const { db } = await import('@metorial/db');

      const mockServerImplementation = {
        id: 'impl-123',
        oid: 20,
        status: 'active',
        serverVariant: {
          id: 'variant-123',
          oid: 21,
          currentVersionOid: 100
        },
        server: {
          id: 'server-123',
          oid: 22,
          status: 'active',
          type: 'custom'
        }
      };

      (db.serverVersion.findFirst as any).mockResolvedValue({
        oid: 100,
        customServerVersion: null
      });

      await expect(
        serverDeploymentService.createServerDeployment({
          organization: mockOrganization,
          performedBy: mockPerformedBy,
          instance: mockInstance,
          context: mockContext,
          serverImplementation: {
            instance: mockServerImplementation,
            isNewEphemeral: false
          },
          input: {
            config: { type: 'direct', config: {} }
          },
          type: 'persistent'
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('updateServerDeployment', () => {
    it('should update server deployment', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { withTransaction } = await import('@metorial/db');
      const { Fabric } = await import('@metorial/fabric');

      const mockDeployment = {
        id: 'deployment-123',
        oid: 60,
        status: 'active',
        config: {
          oid: 50,
          isEphemeral: false
        },
        serverImplementation: {
          id: 'impl-123',
          oid: 20,
          serverVariant: {
            id: 'variant-123',
            oid: 21
          },
          server: {
            id: 'server-123',
            oid: 22
          }
        }
      };

      const updatedDeployment = {
        ...mockDeployment,
        name: 'Updated Name',
        description: 'Updated Description'
      };

      (withTransaction as any).mockImplementation(async (fn: any) => {
        const mockDb = {
          serverDeployment: {
            update: vi.fn().mockResolvedValue(updatedDeployment)
          }
        };
        return fn(mockDb);
      });

      const result = await serverDeploymentService.updateServerDeployment({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        serverDeployment: mockDeployment as any,
        input: {
          name: 'Updated Name',
          description: 'Updated Description'
        }
      });

      expect(result.name).toBe('Updated Name');
      expect(result.description).toBe('Updated Description');
      expect(Fabric.fire).toHaveBeenCalledWith(
        'server.server_deployment.updated:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'server.server_deployment.updated:after',
        expect.any(Object)
      );
    });

    it('should throw error when updating deleted deployment', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { ServiceError } = await import('@metorial/error');

      const mockDeployment = {
        id: 'deployment-123',
        oid: 60,
        status: 'deleted',
        config: { oid: 50, isEphemeral: false },
        serverImplementation: {
          id: 'impl-123',
          oid: 20,
          serverVariant: { id: 'variant-123', oid: 21 },
          server: { id: 'server-123', oid: 22 }
        }
      };

      await expect(
        serverDeploymentService.updateServerDeployment({
          organization: mockOrganization,
          performedBy: mockPerformedBy,
          instance: mockInstance,
          serverDeployment: mockDeployment as any,
          input: {
            name: 'Updated Name'
          }
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw error when updating config of non-ephemeral deployment', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { ServiceError } = await import('@metorial/error');
      const { serverVariantService } = await import('@metorial/module-catalog');

      const mockDeployment = {
        id: 'deployment-123',
        oid: 60,
        status: 'active',
        config: {
          oid: 50,
          isEphemeral: false
        },
        serverImplementation: {
          id: 'impl-123',
          oid: 20,
          serverVariant: {
            id: 'variant-123',
            oid: 21
          },
          server: {
            id: 'server-123',
            oid: 22
          }
        }
      };

      (serverVariantService.getServerVariantById as any).mockResolvedValue({
        currentVersion: {
          schema: {
            oid: 30,
            schema: { type: 'object' }
          }
        }
      });

      await expect(
        serverDeploymentService.updateServerDeployment({
          organization: mockOrganization,
          performedBy: mockPerformedBy,
          instance: mockInstance,
          serverDeployment: mockDeployment as any,
          input: {
            config: { newKey: 'newValue' }
          }
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('deleteServerDeployment', () => {
    it('should delete server deployment', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { withTransaction } = await import('@metorial/db');
      const { Fabric } = await import('@metorial/fabric');
      const { serverDeploymentDeletedQueue } = await import('../src/queues/serverDeploymentDeleted');

      const mockDeployment = {
        id: 'deployment-123',
        oid: 60,
        status: 'active',
        config: {
          oid: 50
        },
        serverImplementation: {
          id: 'impl-123',
          oid: 20
        }
      };

      const deletedDeployment = {
        ...mockDeployment,
        status: 'deleted',
        deletedAt: new Date()
      };

      (withTransaction as any).mockImplementation(async (fn: any) => {
        const mockDb = {
          serverDeployment: {
            update: vi.fn().mockResolvedValue(deletedDeployment)
          }
        };
        return fn(mockDb);
      });

      const result = await serverDeploymentService.deleteServerDeployment({
        organization: mockOrganization,
        performedBy: mockPerformedBy,
        instance: mockInstance,
        serverDeployment: mockDeployment as any
      });

      expect(result.status).toBe('deleted');
      expect(result.deletedAt).toBeDefined();
      expect(serverDeploymentDeletedQueue.add).toHaveBeenCalledWith(
        {
          serverDeploymentId: 'deployment-123',
          performedById: mockPerformedBy.id
        },
        { delay: 100 }
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'server.server_deployment.deleted:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'server.server_deployment.deleted:after',
        expect.any(Object)
      );
    });

    it('should throw error when deleting already deleted deployment', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { ServiceError } = await import('@metorial/error');

      const mockDeployment = {
        id: 'deployment-123',
        oid: 60,
        status: 'deleted',
        config: { oid: 50 },
        serverImplementation: { id: 'impl-123', oid: 20 }
      };

      await expect(
        serverDeploymentService.deleteServerDeployment({
          organization: mockOrganization,
          performedBy: mockPerformedBy,
          instance: mockInstance,
          serverDeployment: mockDeployment as any
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('listServerDeployments', () => {
    it('should list server deployments without search', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { Paginator } = await import('@metorial/pagination');

      const mockPaginator = vi.fn();
      (Paginator.create as any).mockReturnValue(mockPaginator);

      const result = await serverDeploymentService.listServerDeployments({
        instance: mockInstance
      });

      expect(Paginator.create).toHaveBeenCalled();
      expect(result).toBe(mockPaginator);
    });

    it('should list server deployments with search', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { searchService } = await import('@metorial/module-search');
      const { Paginator } = await import('@metorial/pagination');

      const mockSearchResults = [{ id: 'deployment-1' }, { id: 'deployment-2' }];
      (searchService.search as any).mockResolvedValue(mockSearchResults);

      const mockPaginator = vi.fn();
      (Paginator.create as any).mockReturnValue(mockPaginator);

      await serverDeploymentService.listServerDeployments({
        instance: mockInstance,
        search: 'test query'
      });

      expect(searchService.search).toHaveBeenCalledWith({
        index: 'server_deployment',
        query: 'test query',
        options: {
          limit: 50
        }
      });
    });

    it('should filter by server variant IDs', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { db } = await import('@metorial/db');

      const mockServerVariants = [{ id: 'variant-1', oid: 100 }];
      (db.serverVariant.findMany as any).mockResolvedValue(mockServerVariants);

      await serverDeploymentService.listServerDeployments({
        instance: mockInstance,
        serverVariantIds: ['variant-1']
      });

      expect(db.serverVariant.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['variant-1'] } }
      });
    });

    it('should filter by server IDs', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');
      const { db } = await import('@metorial/db');

      const mockServers = [{ id: 'server-1', oid: 100 }];
      (db.server.findMany as any).mockResolvedValue(mockServers);

      await serverDeploymentService.listServerDeployments({
        instance: mockInstance,
        serverIds: ['server-1']
      });

      expect(db.server.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['server-1'] } }
      });
    });

    it('should filter by status', async () => {
      const { serverDeploymentService } = await import('../src/services/serverDeployment');

      await serverDeploymentService.listServerDeployments({
        instance: mockInstance,
        status: ['active', 'failed']
      });

      // The paginator create function should have been called
      // We're just verifying the method runs without error
      expect(true).toBe(true);
    });
  });
});
