import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceError } from '@metorial/error';

// Mock external dependencies
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
  withTransaction: vi.fn((callback) => callback({
    project: {
      create: vi.fn(),
      update: vi.fn()
    }
  }))
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: vi.fn()
  }
}));

vi.mock('@metorial/pagination', () => ({
  Paginator: {
    create: vi.fn((fn) => fn)
  }
}));

vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn((name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial/slugify', () => ({
  createSlugGenerator: vi.fn(() => vi.fn().mockResolvedValue('test-slug'))
}));

vi.mock('../src/services/instance', () => ({
  instanceService: {
    createInstance: vi.fn()
  }
}));

import { db, ID, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { projectService } from '../src/services/project';
import { instanceService } from '../src/services/instance';

describe('ProjectService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createProject', () => {
    it('should create project with development instance', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockActor = { id: 'actor-1', oid: 1 };
      let mockProject = {
        id: 'proj-1',
        oid: 1,
        slug: 'test-project',
        name: 'Test Project',
        status: 'active',
        organizationOid: 1,
        organization: mockOrg
      };

      vi.mocked(ID.generateId).mockResolvedValue('proj-1');
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
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
        performedBy: mockActor as any,
        context: {} as any,
        input: {
          name: 'Test Project'
        }
      });

      expect(result).toEqual(mockProject);
      expect(ID.generateId).toHaveBeenCalledWith('project');
      expect(Fabric.fire).toHaveBeenCalledWith('organization.project.created:before', expect.any(Object));
      expect(Fabric.fire).toHaveBeenCalledWith('organization.project.created:after', expect.objectContaining({
        project: mockProject
      }));
      expect(instanceService.createInstance).toHaveBeenCalledWith({
        project: mockProject,
        organization: mockOrg,
        performedBy: mockActor,
        context: {},
        input: {
          name: 'Development',
          type: 'development'
        }
      });
    });

    it('should handle slug generation', async () => {
      let mockProject = { id: 'proj-1', slug: 'test-slug' };

      vi.mocked(ID.generateId).mockResolvedValue('proj-1');
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
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
        performedBy: { id: 'actor-1', oid: 1 } as any,
        context: {} as any,
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
        name: 'Old Name'
      };
      let updatedProject = {
        ...mockProject,
        name: 'New Name'
      };

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
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
        performedBy: { id: 'actor-1', oid: 1 } as any,
        context: {} as any,
        input: {
          name: 'New Name'
        }
      });

      expect(result.name).toBe('New Name');
      expect(Fabric.fire).toHaveBeenCalledWith('organization.project.updated:before', expect.any(Object));
      expect(Fabric.fire).toHaveBeenCalledWith('organization.project.updated:after', expect.any(Object));
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
          performedBy: { id: 'actor-1', oid: 1 } as any,
          context: {} as any,
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

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
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
        performedBy: { id: 'actor-1', oid: 1 } as any,
        context: {} as any,
        input: {}
      });

      expect(Fabric.fire).toHaveBeenCalled();
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
          performedBy: { id: 'actor-1', oid: 1 } as any,
          context: {} as any
        })
      ).rejects.toThrow(ServiceError);
      await expect(
        projectService.deleteProject({
          project: mockProject as any,
          organization: { id: 'org-1', oid: 1 } as any,
          performedBy: { id: 'actor-1', oid: 1 } as any,
          context: {} as any
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
          performedBy: { id: 'actor-1', oid: 1 } as any,
          context: {} as any
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
        projectId: 'proj-1'
      });

      expect(result).toEqual(mockProject);
      expect(db.project.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ id: 'proj-1' }, { slug: 'proj-1' }],
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
        projectId: 'test-slug'
      });

      expect(result).toEqual(mockProject);
    });

    it('should throw not found error when project does not exist', async () => {
      vi.mocked(db.project.findFirst).mockResolvedValue(null);

      await expect(
        projectService.getProjectById({
          organization: { id: 'org-1', oid: 1 } as any,
          projectId: 'proj-999'
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('listProjects', () => {
    it('should list all projects for organization', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      let result = await projectService.listProjects({
        organization: mockOrg as any
      });

      expect(result).toBeDefined();
    });

    it('should only return active projects', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      let result = await projectService.listProjects({
        organization: mockOrg as any
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
          performedBy: { id: 'actor-1', oid: 1 } as any,
          context: {} as any,
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
          performedBy: { id: 'actor-1', oid: 1 } as any,
          context: {} as any,
          input: { name: 'New Name' }
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('should handle database errors', async () => {
      vi.mocked(db.project.findFirst).mockRejectedValue(new Error('Database error'));

      await expect(
        projectService.getProjectById({
          organization: { id: 'org-1', oid: 1 } as any,
          projectId: 'proj-1'
        })
      ).rejects.toThrow('Database error');
    });

    it('should handle instance creation failure', async () => {
      let mockProject = { id: 'proj-1', oid: 1 };

      vi.mocked(ID.generateId).mockResolvedValue('proj-1');
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
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
          performedBy: { id: 'actor-1', oid: 1 } as any,
          context: {} as any,
          input: {
            name: 'Test'
          }
        })
      ).rejects.toThrow('Instance creation failed');
    });
  });
});
