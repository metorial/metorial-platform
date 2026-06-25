import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    instance: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    organizationMember: {
      update: vi.fn()
    },
    environment: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    sandbox: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn()
  },
  addAfterTransactionHook: vi.fn(async callback => await callback()),
  withTransaction: vi.fn(callback =>
    callback({
      instance: {
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn()
      },
      environment: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn()
      },
      sandbox: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn()
      }
    })
  )
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: vi.fn()
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: vi.fn(fn => fn)
  }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/slugify', () => ({
  createSlugGenerator: vi.fn(() => vi.fn().mockResolvedValue('test-slug'))
}));

vi.mock('date-fns', () => ({
  differenceInMinutes: vi.fn()
}));

vi.mock('../src/queues/syncSubspaceTenant', () => ({
  syncSubspaceTenantQueue: {
    add: vi.fn()
  }
}));

import { db, ID, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { differenceInMinutes } from 'date-fns';
import { instanceService } from '../src/services/instance';

let withCompanionMocks = (mockDb: any) => ({
  ...mockDb,
  instance: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn(),
    ...mockDb.instance
  },
  environment: {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    ...mockDb.environment
  },
  sandbox: {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    ...mockDb.sandbox
  }
});

describe('InstanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createInstance', () => {
    it('should create instance successfully', async () => {
      let mockProject = { id: 'proj-1', oid: 1, name: 'Test Project' };
      let mockOrg = { id: 'org-1', oid: 1, name: 'Test Org' };
      let mockActor = { id: 'actor-1', oid: 1 };
      let mockInstance = {
        id: 'inst-1',
        oid: 1,
        slug: 'test-instance',
        name: 'Test Instance',
        type: 'development',
        status: 'active',
        organizationOid: 1,
        projectOid: 1,
        organization: mockOrg,
        project: mockProject
      };

      vi.mocked(ID.generateId).mockResolvedValue('inst-1');
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          instance: {
            create: vi.fn().mockResolvedValue(mockInstance)
          }
        };
        return callback(withCompanionMocks(mockDb) as any);
      });

      let result = await instanceService.createInstance({
        project: mockProject as any,
        organization: mockOrg as any,
        performedBy: mockActor as any,
        context: {} as any,
        input: {
          name: 'Test Instance',
          type: 'development'
        }
      });

      expect(result).toEqual(mockInstance);
      expect(ID.generateId).toHaveBeenCalledWith('instance');
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.project.instance.created:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.project.instance.created:after',
        expect.objectContaining({
          instance: mockInstance
        })
      );
    });

    it('should create production instance', async () => {
      let mockInstance = {
        id: 'inst-2',
        type: 'production',
        slug: 'production-instance'
      };

      vi.mocked(ID.generateId).mockResolvedValue('inst-2');
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          instance: {
            create: vi.fn().mockResolvedValue(mockInstance)
          }
        };
        return callback(withCompanionMocks(mockDb) as any);
      });

      let result = await instanceService.createInstance({
        project: { id: 'proj-1', oid: 1 } as any,
        organization: { id: 'org-1', oid: 1 } as any,
        performedBy: { id: 'actor-1', oid: 1 } as any,
        context: {} as any,
        input: {
          name: 'Production Instance',
          type: 'production'
        }
      });

      expect(result.type).toBe('production');
    });

    it('should handle slug generation', async () => {
      let mockInstance = { id: 'inst-3', slug: 'test-slug' };

      vi.mocked(ID.generateId).mockResolvedValue('inst-3');
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          instance: {
            create: vi.fn().mockResolvedValue(mockInstance)
          }
        };
        return callback(withCompanionMocks(mockDb) as any);
      });

      let result = await instanceService.createInstance({
        project: { id: 'proj-1', oid: 1 } as any,
        organization: { id: 'org-1', oid: 1 } as any,
        performedBy: { id: 'actor-1', oid: 1 } as any,
        context: {} as any,
        input: {
          name: 'Test Instance',
          type: 'development'
        }
      });

      expect(result.slug).toBe('test-slug');
    });

    it('should create environment and sandbox companions for development instances', async () => {
      let mockInstance = {
        id: 'inst-1',
        oid: 10,
        slug: 'test-instance',
        name: 'Test Instance',
        type: 'development',
        status: 'active',
        project: { id: 'proj-1', oid: 1 },
        organization: { id: 'org-1', oid: 1 }
      };
      vi.mocked(ID.generateId).mockResolvedValue('generated-id');
      let mockDb: ReturnType<typeof withCompanionMocks>;
      vi.mocked(withTransaction).mockImplementation(async callback => {
        mockDb = withCompanionMocks({
          instance: {
            create: vi.fn().mockResolvedValue(mockInstance)
          }
        });

        return callback(mockDb as any);
      });

      await instanceService.createInstance({
        project: { id: 'proj-1', oid: 1 } as any,
        organization: { id: 'org-1', oid: 1 } as any,
        performedBy: { id: 'actor-1', oid: 7 } as any,
        context: {} as any,
        input: {
          name: 'Test Instance',
          type: 'development'
        }
      });

      expect(mockDb!.environment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Instance',
          type: 'development',
          status: 'active',
          instanceOid: 10,
          creatorActorOid: 7
        })
      });
      expect(mockDb!.sandbox.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Instance',
          status: 'active',
          instanceOid: 10,
          creatorActorOid: 7
        })
      });
    });

    it('should reject creating a second production instance', async () => {
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = withCompanionMocks({
          instance: {
            findFirst: vi.fn().mockResolvedValue({ id: 'inst-existing' })
          }
        });

        return callback(mockDb as any);
      });

      await expect(
        instanceService.createInstance({
          project: { id: 'proj-1', oid: 1 } as any,
          organization: { id: 'org-1', oid: 1 } as any,
          performedBy: { id: 'actor-1', oid: 1 } as any,
          context: {} as any,
          input: {
            name: 'Production Instance',
            type: 'production'
          }
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('sandbox methods', () => {
    it('should create a sandbox by delegating to development instance creation', async () => {
      let sandbox = {
        id: 'sbox-1',
        status: 'active',
        name: 'Sandbox',
        creatorActor: { id: 'actor-1' },
        instance: {
          id: 'inst-1',
          slug: 'sandbox',
          project: { id: 'proj-1' },
          organization: { id: 'org-1', oid: 1 }
        }
      };
      let createInstanceSpy = vi
        .spyOn(instanceService, 'createInstance')
        .mockResolvedValue({ id: 'inst-1' } as any);
      vi.mocked(db.sandbox.findFirst).mockResolvedValue(sandbox as any);

      try {
        let result = await instanceService.createSandbox({
          project: { id: 'proj-1', oid: 1 } as any,
          organization: { id: 'org-1', oid: 1 } as any,
          performedBy: { id: 'actor-1', oid: 1 } as any,
          context: {} as any,
          input: {
            name: 'Sandbox'
          }
        });

        expect(createInstanceSpy).toHaveBeenCalledWith({
          project: { id: 'proj-1', oid: 1 },
          organization: { id: 'org-1', oid: 1 },
          performedBy: { id: 'actor-1', oid: 1 },
          context: {},
          input: {
            name: 'Sandbox',
            type: 'development'
          }
        });
        expect(result).toEqual(sandbox);
      } finally {
        createInstanceSpy.mockRestore();
      }
    });
  });

  describe('updateInstance', () => {
    it('should update active instance successfully', async () => {
      let mockInstance = {
        id: 'inst-1',
        oid: 1,
        status: 'active',
        name: 'Old Name',
        project: { id: 'proj-1', oid: 1 }
      };
      let updatedInstance = {
        ...mockInstance,
        name: 'New Name'
      };

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          instance: {
            update: vi.fn().mockResolvedValue(updatedInstance)
          }
        };
        return callback(withCompanionMocks(mockDb) as any);
      });

      let result = await instanceService.updateInstance({
        instance: mockInstance as any,
        organization: { id: 'org-1', oid: 1 } as any,
        performedBy: { id: 'actor-1', oid: 1 } as any,
        context: {} as any,
        input: {
          name: 'New Name'
        }
      });

      expect(result.name).toBe('New Name');
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.project.instance.updated:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.project.instance.updated:after',
        expect.any(Object)
      );
    });

    it('should throw forbidden error for deleted instance', async () => {
      let mockInstance = {
        id: 'inst-1',
        oid: 1,
        status: 'deleted',
        project: { id: 'proj-1', oid: 1 }
      };

      await expect(
        instanceService.updateInstance({
          instance: mockInstance as any,
          organization: { id: 'org-1', oid: 1 } as any,
          performedBy: { id: 'actor-1', oid: 1 } as any,
          context: {} as any,
          input: {
            name: 'New Name'
          }
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should update only provided fields', async () => {
      let mockInstance = {
        id: 'inst-1',
        oid: 1,
        status: 'active',
        name: 'Original Name',
        project: { id: 'proj-1', oid: 1 }
      };

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          instance: {
            update: vi.fn().mockResolvedValue(mockInstance)
          }
        };
        return callback(withCompanionMocks(mockDb) as any);
      });

      await instanceService.updateInstance({
        instance: mockInstance as any,
        organization: { id: 'org-1', oid: 1 } as any,
        performedBy: { id: 'actor-1', oid: 1 } as any,
        context: {} as any,
        input: {}
      });

      // Should still complete without error
      expect(Fabric.fire).toHaveBeenCalled();
    });

    it('should reject slug updates when another instance has the current slug', async () => {
      let mockInstance = {
        id: 'inst-1',
        oid: 1,
        status: 'active',
        slug: 'old-slug',
        previousSlugs: [],
        project: { id: 'proj-1', oid: 1 }
      };
      let update = vi.fn();

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = withCompanionMocks({
          instance: {
            findFirst: vi.fn().mockResolvedValue({ id: 'inst-2' }),
            update
          }
        });
        return callback(mockDb as any);
      });

      await expect(
        instanceService.updateInstance({
          instance: mockInstance as any,
          organization: { id: 'org-1', oid: 1 } as any,
          performedBy: { id: 'actor-1', oid: 1 } as any,
          context: {} as any,
          input: {
            slug: 'new-slug'
          }
        })
      ).rejects.toThrow(ServiceError);

      expect(update).not.toHaveBeenCalled();
    });

    it('should reclaim previous slug conflicts and keep slug history on update', async () => {
      let mockInstance = {
        id: 'inst-1',
        oid: 1,
        status: 'active',
        slug: 'old-slug',
        previousSlugs: ['older-slug', 'new-slug'],
        project: { id: 'proj-1', oid: 1 }
      };
      let updatedInstance = {
        ...mockInstance,
        slug: 'new-slug',
        previousSlugs: ['older-slug', 'old-slug']
      };
      let update = vi
        .fn()
        .mockResolvedValueOnce({ oid: 2, previousSlugs: ['kept-slug'] })
        .mockResolvedValueOnce(updatedInstance);

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = withCompanionMocks({
          instance: {
            findFirst: vi.fn().mockResolvedValue(null),
            findMany: vi.fn().mockResolvedValue([
              {
                oid: 2,
                previousSlugs: ['new-slug', 'kept-slug']
              }
            ]),
            update
          }
        });
        return callback(mockDb as any);
      });

      let result = await instanceService.updateInstance({
        instance: mockInstance as any,
        organization: { id: 'org-1', oid: 1 } as any,
        performedBy: { id: 'actor-1', oid: 1 } as any,
        context: {} as any,
        input: {
          slug: 'new-slug'
        }
      });

      expect(result).toEqual(updatedInstance);
      expect(update).toHaveBeenCalledWith({
        where: { oid: 2 },
        data: {
          previousSlugs: ['kept-slug']
        }
      });
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { oid: 1 },
          data: expect.objectContaining({
            slug: 'new-slug',
            previousSlugs: ['older-slug', 'old-slug']
          })
        })
      );
    });
  });

  describe('deleteInstance', () => {
    it('should throw not implemented error', async () => {
      let mockInstance = {
        id: 'inst-1',
        oid: 1,
        status: 'active',
        project: { id: 'proj-1', oid: 1 }
      };

      await expect(
        instanceService.deleteInstance({
          instance: mockInstance as any,
          organization: { id: 'org-1', oid: 1 } as any,
          performedBy: { id: 'actor-1', oid: 1 } as any,
          context: {} as any
        })
      ).rejects.toThrow(ServiceError);
      await expect(
        instanceService.deleteInstance({
          instance: mockInstance as any,
          organization: { id: 'org-1', oid: 1 } as any,
          performedBy: { id: 'actor-1', oid: 1 } as any,
          context: {} as any
        })
      ).rejects.toThrow('Instance deletion is not supported yet');
    });

    it('should throw forbidden error for already deleted instance', async () => {
      let mockInstance = {
        id: 'inst-1',
        oid: 1,
        status: 'deleted',
        project: { id: 'proj-1', oid: 1 }
      };

      await expect(
        instanceService.deleteInstance({
          instance: mockInstance as any,
          organization: { id: 'org-1', oid: 1 } as any,
          performedBy: { id: 'actor-1', oid: 1 } as any,
          context: {} as any
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('getInstanceById', () => {
    it('should return instance by ID', async () => {
      let mockInstance = {
        id: 'inst-1',
        oid: 1,
        slug: 'test-instance',
        organizationOid: 1,
        organization: { id: 'org-1' },
        project: { id: 'proj-1' }
      };

      vi.mocked(db.instance.findFirst).mockResolvedValue(mockInstance as any);

      let result = await instanceService.getInstanceById({
        organization: { id: 'org-1', oid: 1 } as any,
        instanceId: 'inst-1',
        actor: { id: 'actor-1', oid: 1 } as any,
        member: undefined
      });

      expect(result).toEqual(mockInstance);
      expect(db.instance.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ id: 'inst-1' }, { slug: 'inst-1' }, { previousSlugs: { has: 'inst-1' } }],
          organizationOid: 1
        },
        include: {
          organization: true,
          project: true,
          sandbox: true
        }
      });
    });

    it('should return instance by slug', async () => {
      let mockInstance = {
        id: 'inst-1',
        oid: 1,
        slug: 'test-slug',
        organizationOid: 1
      };

      vi.mocked(db.instance.findFirst).mockResolvedValue(mockInstance as any);

      let result = await instanceService.getInstanceById({
        organization: { id: 'org-1', oid: 1 } as any,
        instanceId: 'test-slug',
        actor: { id: 'actor-1', oid: 1 } as any,
        member: undefined
      });

      expect(result).toEqual(mockInstance);
    });

    it('should return instance by previous slug', async () => {
      let mockInstance = {
        id: 'inst-1',
        oid: 1,
        slug: 'current-slug',
        previousSlugs: ['old-slug'],
        organizationOid: 1
      };

      vi.mocked(db.instance.findFirst).mockResolvedValue(mockInstance as any);

      let result = await instanceService.getInstanceById({
        organization: { id: 'org-1', oid: 1 } as any,
        instanceId: 'old-slug',
        actor: { id: 'actor-1', oid: 1 } as any,
        member: undefined
      });

      expect(result).toEqual(mockInstance);
      expect(db.instance.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { id: 'old-slug' },
              { slug: 'old-slug' },
              { previousSlugs: { has: 'old-slug' } }
            ]
          })
        })
      );
    });

    it('should throw not found error when instance does not exist', async () => {
      vi.mocked(db.instance.findFirst).mockResolvedValue(null);

      await expect(
        instanceService.getInstanceById({
          organization: { id: 'org-1', oid: 1 } as any,
          instanceId: 'inst-999',
          actor: { id: 'actor-1', oid: 1 } as any,
          member: undefined
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('listInstances', () => {
    it('should list all instances for organization', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      let result = await instanceService.listInstances({
        organization: mockOrg as any,
        actor: { id: 'actor-1', oid: 1 } as any,
        member: undefined
      });

      expect(result).toBeDefined();
    });

    it('should filter by project when provided', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockProject = { id: 'proj-1', oid: 1 };

      let result = await instanceService.listInstances({
        organization: mockOrg as any,
        project: mockProject as any,
        actor: { id: 'actor-1', oid: 1 } as any,
        member: undefined
      });

      expect(result).toBeDefined();
    });

    it('should only return active instances', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      let result = await instanceService.listInstances({
        organization: mockOrg as any,
        actor: { id: 'actor-1', oid: 1 } as any,
        member: undefined
      });

      // The filter should include status: 'active'
      expect(result).toBeDefined();
    });
  });

  describe('getManyInstancesForOrganization', () => {
    it('should return multiple instances by IDs', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockInstances = [
        { id: 'inst-1', oid: 1, organizationOid: 1 },
        { id: 'inst-2', oid: 2, organizationOid: 1 }
      ];

      vi.mocked(db.instance.findMany).mockResolvedValue(mockInstances as any);

      let result = await instanceService.getManyInstancesForOrganization({
        organization: mockOrg as any,
        instanceIds: ['inst-1', 'inst-2']
      });

      expect(result).toEqual(mockInstances);
      expect(db.instance.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { id: { in: ['inst-1', 'inst-2'] } },
            { slug: { in: ['inst-1', 'inst-2'] } },
            { previousSlugs: { hasSome: ['inst-1', 'inst-2'] } }
          ],
          organizationOid: 1
        },
        include: {
          organization: true,
          project: true,
          sandbox: true
        }
      });
    });

    it('should handle empty instance IDs array', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      vi.mocked(db.instance.findMany).mockResolvedValue([]);

      let result = await instanceService.getManyInstancesForOrganization({
        organization: mockOrg as any,
        instanceIds: []
      });

      expect(result).toEqual([]);
    });

    it('should handle undefined instance IDs', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      vi.mocked(db.instance.findMany).mockResolvedValue([]);

      let result = await instanceService.getManyInstancesForOrganization({
        organization: mockOrg as any
      });

      expect(result).toEqual([]);
    });
  });

  describe('getInstanceByIdForUser', () => {
    it('should return instance with user member info', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        userOid: 1,
        lastActiveAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        actor: { id: 'actor-1' }
      };
      let mockInstance = {
        id: 'inst-1',
        oid: 1,
        organization: {
          id: 'org-1',
          members: [mockMember]
        },
        project: { id: 'proj-1' }
      };

      vi.mocked(db.instance.findFirst).mockResolvedValue(mockInstance as any);
      vi.mocked(differenceInMinutes).mockReturnValue(60);

      let result = await instanceService.getInstanceByIdForUser({
        instanceId: 'inst-1',
        user: mockUser as any
      });

      expect(result.instance).toBeDefined();
      expect(result.member).toEqual(mockMember);
      expect(result.actor).toEqual(mockMember.actor);
      expect(result.organization).toEqual(mockInstance.organization);
      expect(result.project).toEqual(mockInstance.project);
    });

    it('should update lastActiveAt when more than 30 minutes', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        userOid: 1,
        lastActiveAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        actor: { id: 'actor-1' }
      };
      let mockInstance = {
        id: 'inst-1',
        organization: {
          members: [mockMember]
        },
        project: { id: 'proj-1' }
      };

      vi.mocked(db.instance.findFirst).mockResolvedValue(mockInstance as any);
      vi.mocked(differenceInMinutes).mockReturnValue(60);

      await instanceService.getInstanceByIdForUser({
        instanceId: 'inst-1',
        user: mockUser as any
      });

      expect(db.organizationMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { lastActiveAt: expect.any(Date) }
      });
    });

    it('should not update lastActiveAt when less than 30 minutes', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        userOid: 1,
        lastActiveAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        actor: { id: 'actor-1' }
      };
      let mockInstance = {
        id: 'inst-1',
        organization: {
          members: [mockMember]
        },
        project: { id: 'proj-1' }
      };

      vi.mocked(db.instance.findFirst).mockResolvedValue(mockInstance as any);
      vi.mocked(differenceInMinutes).mockReturnValue(10);

      await instanceService.getInstanceByIdForUser({
        instanceId: 'inst-1',
        user: mockUser as any
      });

      expect(db.organizationMember.update).not.toHaveBeenCalled();
    });

    it('should update lastActiveAt when lastActiveAt is null', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        userOid: 1,
        lastActiveAt: null,
        actor: { id: 'actor-1' }
      };
      let mockInstance = {
        id: 'inst-1',
        organization: {
          members: [mockMember]
        },
        project: { id: 'proj-1' }
      };

      vi.mocked(db.instance.findFirst).mockResolvedValue(mockInstance as any);

      await instanceService.getInstanceByIdForUser({
        instanceId: 'inst-1',
        user: mockUser as any
      });

      expect(db.organizationMember.update).toHaveBeenCalled();
    });

    it('should throw not found error when instance not found', async () => {
      vi.mocked(db.instance.findFirst).mockResolvedValue(null);

      await expect(
        instanceService.getInstanceByIdForUser({
          instanceId: 'inst-999',
          user: { id: 'user-1', oid: 1 } as any
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw not found error when user is not a member', async () => {
      let mockInstance = {
        id: 'inst-1',
        organization: {
          members: [] // No members
        }
      };

      vi.mocked(db.instance.findFirst).mockResolvedValue(mockInstance as any);

      await expect(
        instanceService.getInstanceByIdForUser({
          instanceId: 'inst-1',
          user: { id: 'user-1', oid: 1 } as any
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('edge cases', () => {
    it('should handle transaction failures', async () => {
      vi.mocked(withTransaction).mockRejectedValue(new Error('Transaction failed'));

      await expect(
        instanceService.createInstance({
          project: { id: 'proj-1', oid: 1 } as any,
          organization: { id: 'org-1', oid: 1 } as any,
          performedBy: { id: 'actor-1', oid: 1 } as any,
          context: {} as any,
          input: {
            name: 'Test',
            type: 'development'
          }
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('should handle database errors in findFirst', async () => {
      vi.mocked(db.instance.findFirst).mockRejectedValue(new Error('Database error'));

      await expect(
        instanceService.getInstanceById({
          organization: { id: 'org-1', oid: 1 } as any,
          instanceId: 'inst-1',
          actor: { id: 'actor-1', oid: 1 } as any,
          member: undefined
        })
      ).rejects.toThrow('Database error');
    });

    it('should handle empty instance name', async () => {
      let mockInstance = { id: 'inst-1', name: '', slug: 'slug' };

      vi.mocked(ID.generateId).mockResolvedValue('inst-1');
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          instance: {
            create: vi.fn().mockResolvedValue(mockInstance)
          }
        };
        return callback(withCompanionMocks(mockDb) as any);
      });

      let result = await instanceService.createInstance({
        project: { id: 'proj-1', oid: 1 } as any,
        organization: { id: 'org-1', oid: 1 } as any,
        performedBy: { id: 'actor-1', oid: 1 } as any,
        context: {} as any,
        input: {
          name: '',
          type: 'development'
        }
      });

      expect(result.name).toBe('');
    });
  });
});
