import { ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock external dependencies
vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn().mockImplementation(config => ({
    name: config.name,
    add: vi.fn(),
    addMany: vi.fn(),
    process: vi.fn(handler => ({ handler }))
  })),
  combineQueueProcessors: vi.fn(processors => processors),
  QueueRetryError: class QueueRetryError extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'QueueRetryError';
    }
  }
}));

vi.mock('@metorial/db', () => ({
  db: {
    project: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn()
  },
  addAfterTransactionHook: vi.fn(async callback => await callback()),
  withTransaction: vi.fn(callback =>
    callback({
      project: {
        create: vi.fn(),
        update: vi.fn()
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

vi.mock('../src/services/instance', () => ({
  instanceService: {
    createInstance: vi.fn()
  }
}));

vi.mock('../src/queues/syncBrand', () => ({
  syncBrandQueue: {
    add: vi.fn(),
    addMany: vi.fn()
  },
  syncBrandOrganizationQueue: {
    add: vi.fn()
  }
}));

vi.mock('../src/queues/syncSubspaceTenant', () => ({
  syncSubspaceTenantQueue: {
    add: vi.fn(),
    addMany: vi.fn()
  }
}));

import { db, ID, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { instanceService } from '../src/services/instance';
import { projectService } from '../src/services/project';

describe('ProjectService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createProject', () => {
    it('should create project with production instance', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockActor = { id: 'actor-1', oid: 1 };
      let mockProject = {
        id: 'proj-1',
        oid: 1,
        slug: 'test-project',
        name: 'Test Project',
        status: 'active',
        magicMcpSessionDurationMinutes: 1440,
        organizationOid: 1,
        organization: mockOrg
      };

      vi.mocked(ID.generateId).mockResolvedValue('proj-1');
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          project: {
            create: vi.fn().mockResolvedValue(mockProject)
          }
        };
        return callback(mockDb as any);
      });
      vi.mocked(instanceService.createInstance).mockResolvedValue({} as any);

      let result = await projectService.createProject({
        organization: mockOrg as any,
        auditScope: {} as any,
        input: {
          name: 'Test Project'
        }
      });

      expect(result).toEqual(mockProject);
      expect(ID.generateId).toHaveBeenCalledWith('project');
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.project.created:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.project.created:after',
        expect.objectContaining({
          project: mockProject
        })
      );
      expect(instanceService.createInstance).toHaveBeenCalledWith({
        project: mockProject,
        organization: mockOrg,
        auditScope: {},
        input: {
          name: 'Production',
          type: 'production'
        }
      });
    });

    it('should persist a custom magic MCP session duration', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockProject = {
        id: 'proj-1',
        oid: 1,
        slug: 'test-project',
        name: 'Test Project',
        status: 'active',
        magicMcpSessionDurationMinutes: 30,
        organizationOid: 1,
        organization: mockOrg
      };
      let create = vi.fn().mockResolvedValue(mockProject);

      vi.mocked(ID.generateId).mockResolvedValue('proj-1');
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          project: {
            create
          }
        };
        return callback(mockDb as any);
      });
      vi.mocked(instanceService.createInstance).mockResolvedValue({} as any);

      await projectService.createProject({
        organization: mockOrg as any,
        auditScope: {} as any,
        input: {
          name: 'Test Project',
          magicMcpSessionDurationMinutes: 30
        }
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            magicMcpSessionDurationMinutes: 30
          })
        })
      );
    });

    it('should handle slug generation', async () => {
      let mockProject = { id: 'proj-1', slug: 'test-slug' };

      vi.mocked(ID.generateId).mockResolvedValue('proj-1');
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          project: {
            create: vi.fn().mockResolvedValue(mockProject)
          }
        };
        return callback(mockDb as any);
      });
      vi.mocked(instanceService.createInstance).mockResolvedValue({} as any);

      let result = await projectService.createProject({
        organization: { id: 'org-1', oid: 1 } as any,
        auditScope: {} as any,
        input: {
          name: 'My Test Project'
        }
      });

      expect(result.slug).toBe('test-slug');
    });
  });

  describe('updateProject', () => {
    it('should update active project successfully', async () => {
      let mockProject = {
        id: 'proj-1',
        oid: 1,
        status: 'active',
        name: 'Old Name',
        magicMcpSessionDurationMinutes: 1440
      };
      let updatedProject = {
        ...mockProject,
        name: 'New Name'
      };

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          project: {
            update: vi.fn().mockResolvedValue(updatedProject)
          }
        };
        return callback(mockDb as any);
      });

      let result = await projectService.updateProject({
        project: mockProject as any,
        organization: { id: 'org-1', oid: 1 } as any,
        auditScope: {} as any,
        input: {
          name: 'New Name'
        }
      });

      expect(result.name).toBe('New Name');
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.project.updated:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.project.updated:after',
        expect.any(Object)
      );
    });

    it('should throw forbidden error for deleted project', async () => {
      let mockProject = {
        id: 'proj-1',
        oid: 1,
        status: 'deleted'
      };

      await expect(
        projectService.updateProject({
          project: mockProject as any,
          organization: { id: 'org-1', oid: 1 } as any,
          auditScope: {} as any,
          input: {
            name: 'New Name'
          }
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should handle empty updates', async () => {
      let mockProject = {
        id: 'proj-1',
        oid: 1,
        status: 'active',
        name: 'Original Name'
      };

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          project: {
            update: vi.fn().mockResolvedValue(mockProject)
          }
        };
        return callback(mockDb as any);
      });

      await projectService.updateProject({
        project: mockProject as any,
        organization: { id: 'org-1', oid: 1 } as any,
        auditScope: {} as any,
        input: {}
      });

      expect(Fabric.fire).toHaveBeenCalled();
    });

    it('should update the magic MCP session duration', async () => {
      let mockProject = {
        id: 'proj-1',
        oid: 1,
        status: 'active',
        name: 'Original Name',
        magicMcpSessionDurationMinutes: 1440
      };
      let update = vi.fn().mockResolvedValue({
        ...mockProject,
        magicMcpSessionDurationMinutes: 60
      });

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          project: {
            update
          }
        };
        return callback(mockDb as any);
      });

      await projectService.updateProject({
        project: mockProject as any,
        organization: { id: 'org-1', oid: 1 } as any,
        auditScope: {} as any,
        input: {
          magicMcpSessionDurationMinutes: 60
        }
      });

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            magicMcpSessionDurationMinutes: 60
          })
        })
      );
    });

    it('should reject slug updates when another project has the current slug', async () => {
      let mockProject = {
        id: 'proj-1',
        oid: 1,
        status: 'active',
        slug: 'old-slug',
        previousSlugs: []
      };
      let update = vi.fn();

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          project: {
            findFirst: vi.fn().mockResolvedValue({ id: 'proj-2' }),
            update
          }
        };
        return callback(mockDb as any);
      });

      await expect(
        projectService.updateProject({
          project: mockProject as any,
          organization: { id: 'org-1', oid: 1 } as any,
          auditScope: {} as any,
          input: {
            slug: 'new-slug'
          }
        })
      ).rejects.toThrow(ServiceError);

      expect(update).not.toHaveBeenCalled();
    });

    it('should reclaim previous slug conflicts and keep slug history on update', async () => {
      let mockProject = {
        id: 'proj-1',
        oid: 1,
        status: 'active',
        slug: 'old-slug',
        previousSlugs: ['older-slug', 'new-slug']
      };
      let updatedProject = {
        ...mockProject,
        slug: 'new-slug',
        previousSlugs: ['older-slug', 'old-slug']
      };
      let update = vi
        .fn()
        .mockResolvedValueOnce({ oid: 2, previousSlugs: ['kept-slug'] })
        .mockResolvedValueOnce(updatedProject);

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          project: {
            findFirst: vi.fn().mockResolvedValue(null),
            findMany: vi.fn().mockResolvedValue([
              {
                oid: 2,
                previousSlugs: ['new-slug', 'kept-slug']
              }
            ]),
            update
          }
        };
        return callback(mockDb as any);
      });

      let result = await projectService.updateProject({
        project: mockProject as any,
        organization: { id: 'org-1', oid: 1 } as any,
        auditScope: {} as any,
        input: {
          slug: 'new-slug'
        }
      });

      expect(result).toEqual(updatedProject);
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

  describe('deleteProject', () => {
    it('should throw not implemented error', async () => {
      let mockProject = {
        id: 'proj-1',
        oid: 1,
        status: 'active'
      };

      await expect(
        projectService.deleteProject({
          project: mockProject as any,
          organization: { id: 'org-1', oid: 1 } as any,
          auditScope: {} as any
        })
      ).rejects.toThrow(ServiceError);
      await expect(
        projectService.deleteProject({
          project: mockProject as any,
          organization: { id: 'org-1', oid: 1 } as any,
          auditScope: {} as any
        })
      ).rejects.toThrow('Project deletion is not supported yet');
    });

    it('should throw forbidden error for already deleted project', async () => {
      let mockProject = {
        id: 'proj-1',
        oid: 1,
        status: 'deleted'
      };

      await expect(
        projectService.deleteProject({
          project: mockProject as any,
          organization: { id: 'org-1', oid: 1 } as any,
          auditScope: {} as any
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('getProjectById', () => {
    it('should return project by ID', async () => {
      let mockProject = {
        id: 'proj-1',
        oid: 1,
        slug: 'test-project',
        organizationOid: 1,
        organization: { id: 'org-1' }
      };

      vi.mocked(db.project.findFirst).mockResolvedValue(mockProject as any);

      let result = await projectService.getProjectById({
        organization: { id: 'org-1', oid: 1 } as any,
        projectId: 'proj-1',
        actor: { id: 'actor-1', oid: 1 } as any,
        member: undefined
      });

      expect(result).toEqual(mockProject);
      expect(db.project.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ id: 'proj-1' }, { slug: 'proj-1' }, { previousSlugs: { has: 'proj-1' } }],
          organizationOid: 1
        },
        include: {
          organization: true
        }
      });
    });

    it('should return project by slug', async () => {
      let mockProject = {
        id: 'proj-1',
        oid: 1,
        slug: 'test-slug',
        organizationOid: 1
      };

      vi.mocked(db.project.findFirst).mockResolvedValue(mockProject as any);

      let result = await projectService.getProjectById({
        organization: { id: 'org-1', oid: 1 } as any,
        projectId: 'test-slug',
        actor: { id: 'actor-1', oid: 1 } as any,
        member: undefined
      });

      expect(result).toEqual(mockProject);
    });

    it('should return project by previous slug', async () => {
      let mockProject = {
        id: 'proj-1',
        oid: 1,
        slug: 'current-slug',
        previousSlugs: ['old-slug'],
        organizationOid: 1
      };

      vi.mocked(db.project.findFirst).mockResolvedValue(mockProject as any);

      let result = await projectService.getProjectById({
        organization: { id: 'org-1', oid: 1 } as any,
        projectId: 'old-slug',
        actor: { id: 'actor-1', oid: 1 } as any,
        member: undefined
      });

      expect(result).toEqual(mockProject);
      expect(db.project.findFirst).toHaveBeenCalledWith(
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

    it('should throw not found error when project does not exist', async () => {
      vi.mocked(db.project.findFirst).mockResolvedValue(null);

      await expect(
        projectService.getProjectById({
          organization: { id: 'org-1', oid: 1 } as any,
          projectId: 'proj-999',
          actor: { id: 'actor-1', oid: 1 } as any,
          member: undefined
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('listProjects', () => {
    it('should list all projects for organization', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      let result = await projectService.listProjects({
        organization: mockOrg as any,
        actor: { id: 'actor-1', oid: 1 } as any,
        member: undefined
      });

      expect(result).toBeDefined();
    });

    it('should only return active projects', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      let result = await projectService.listProjects({
        organization: mockOrg as any,
        actor: { id: 'actor-1', oid: 1 } as any,
        member: undefined
      });

      expect(result).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle transaction failures in create', async () => {
      vi.mocked(withTransaction).mockRejectedValue(new Error('Transaction failed'));

      await expect(
        projectService.createProject({
          organization: { id: 'org-1', oid: 1 } as any,
          auditScope: {} as any,
          input: {
            name: 'Test'
          }
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('should handle transaction failures in update', async () => {
      vi.mocked(withTransaction).mockRejectedValue(new Error('Transaction failed'));

      await expect(
        projectService.updateProject({
          project: { id: 'proj-1', oid: 1, status: 'active' } as any,
          organization: { id: 'org-1', oid: 1 } as any,
          auditScope: {} as any,
          input: { name: 'New Name' }
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('should handle database errors', async () => {
      vi.mocked(db.project.findFirst).mockRejectedValue(new Error('Database error'));

      await expect(
        projectService.getProjectById({
          organization: { id: 'org-1', oid: 1 } as any,
          projectId: 'proj-1',
          actor: { id: 'actor-1', oid: 1 } as any,
          member: undefined
        })
      ).rejects.toThrow('Database error');
    });

    it('should handle instance creation failure', async () => {
      let mockProject = { id: 'proj-1', oid: 1 };

      vi.mocked(ID.generateId).mockResolvedValue('proj-1');
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          project: {
            create: vi.fn().mockResolvedValue(mockProject)
          }
        };
        return callback(mockDb as any);
      });
      vi.mocked(instanceService.createInstance).mockRejectedValue(
        new Error('Instance creation failed')
      );

      await expect(
        projectService.createProject({
          organization: { id: 'org-1', oid: 1 } as any,
          auditScope: {} as any,
          input: {
            name: 'Test'
          }
        })
      ).rejects.toThrow('Instance creation failed');
    });
  });
});
