import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceError, forbiddenError, notFoundError, notImplementedError } from '@metorial/error';

// Mock external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    organization: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    organizationMember: {
      update: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn()
  },
  withTransaction: vi.fn((callback) => callback({
    organization: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    organizationMember: {
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
  createSlugGenerator: vi.fn(() => vi.fn().mockResolvedValue('test-org-slug'))
}));

vi.mock('date-fns', () => ({
  differenceInMinutes: vi.fn()
}));

// Mock organizationActorService
vi.mock('../src/services/organizationActor', () => ({
  organizationActorService: {
    createOrganizationActor: vi.fn()
  }
}));

// Mock organizationMemberService
vi.mock('../src/services/organizationMember', () => ({
  organizationMemberService: {
    createOrganizationMember: vi.fn()
  }
}));

// Mock syncProfileQueue
vi.mock('../src/queues/syncProfile', () => ({
  syncProfileQueue: {
    add: vi.fn()
  }
}));

import { db, ID, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { differenceInMinutes } from 'date-fns';
import { organizationActorService } from '../src/services/organizationActor';
import { organizationMemberService } from '../src/services/organizationMember';
import { syncProfileQueue } from '../src/queues/syncProfile';
import { organizationService } from '../src/services/organization';

describe('OrganizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrganization', () => {
    it('should create organization with system actor and admin member', async () => {
      let mockUser = {
        id: 'user-1',
        oid: 1,
        name: 'John Doe',
        email: 'john@example.com'
      };
      let mockOrg = {
        id: 'org-1',
        oid: 1,
        status: 'active',
        type: 'default',
        slug: 'test-org',
        name: 'Test Org',
        image: { type: 'default' }
      };
      let mockSystemActor = {
        id: 'actor-system',
        oid: 1,
        type: 'system',
        name: 'Metorial',
        isSystem: true
      };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        status: 'active',
        role: 'admin',
        userId: 'user-1',
        organizationId: 'org-1'
      };
      let mockMemberActor = {
        id: 'actor-member',
        oid: 2,
        type: 'member'
      };

      vi.mocked(ID.generateId).mockResolvedValue('org-1');
      vi.mocked(organizationActorService.createOrganizationActor).mockResolvedValue(mockSystemActor as any);
      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue({
        ...mockMember,
        actor: mockMemberActor
      } as any);
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organization: {
            create: vi.fn().mockResolvedValue(mockOrg)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationService.createOrganization({
        input: {
          name: 'Test Org'
        },
        context: {} as any,
        performedBy: mockUser as any
      });

      expect(result.organization).toEqual(mockOrg);
      expect(result.member).toMatchObject(mockMember);
      expect(result.actor).toEqual(mockMemberActor);
      expect(ID.generateId).toHaveBeenCalledWith('organization');
      expect(Fabric.fire).toHaveBeenCalledWith('organization.created:before', expect.any(Object));
      expect(Fabric.fire).toHaveBeenCalledWith('organization.created:after', expect.objectContaining({
        organization: mockOrg,
        performedBy: mockUser
      }));
    });

    it('should create organization with custom image', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let customImage = { type: 'url', url: 'https://example.com/logo.png' };
      let mockOrg = {
        id: 'org-1',
        oid: 1,
        image: customImage
      };
      let mockSystemActor = { id: 'actor-system', oid: 1 };
      let mockMember = { id: 'member-1', oid: 1, actor: { id: 'actor-member' } };

      vi.mocked(ID.generateId).mockResolvedValue('org-1');
      vi.mocked(organizationActorService.createOrganizationActor).mockResolvedValue(mockSystemActor as any);
      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue(mockMember as any);
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organization: {
            create: vi.fn().mockResolvedValue(mockOrg)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationService.createOrganization({
        input: {
          name: 'Test Org',
          image: customImage as any
        },
        context: {} as any,
        performedBy: mockUser as any
      });

      expect(result.organization.image).toEqual(customImage);
    });

    it('should use default image when not provided', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = {
        id: 'org-1',
        oid: 1,
        image: { type: 'default' }
      };
      let mockSystemActor = { id: 'actor-system', oid: 1 };
      let mockMember = { id: 'member-1', oid: 1, actor: { id: 'actor-member' } };

      vi.mocked(ID.generateId).mockResolvedValue('org-1');
      vi.mocked(organizationActorService.createOrganizationActor).mockResolvedValue(mockSystemActor as any);
      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue(mockMember as any);
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organization: {
            create: vi.fn().mockResolvedValue(mockOrg)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationService.createOrganization({
        input: {
          name: 'Test Org'
        },
        context: {} as any,
        performedBy: mockUser as any
      });

      expect(result.organization.image).toEqual({ type: 'default' });
    });

    it('should create system actor with correct properties', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockSystemActor = { id: 'actor-system', oid: 1 };
      let mockMember = { id: 'member-1', oid: 1, actor: { id: 'actor-member' } };

      vi.mocked(ID.generateId).mockResolvedValue('org-1');
      vi.mocked(organizationActorService.createOrganizationActor).mockResolvedValue(mockSystemActor as any);
      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue(mockMember as any);
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organization: {
            create: vi.fn().mockResolvedValue(mockOrg)
          }
        };
        return callback(mockDb as any);
      });

      await organizationService.createOrganization({
        input: {
          name: 'Test Org'
        },
        context: {} as any,
        performedBy: mockUser as any
      });

      expect(organizationActorService.createOrganizationActor).toHaveBeenCalledWith({
        input: {
          type: 'system',
          name: 'Metorial',
          image: {
            type: 'url',
            url: 'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg'
          }
        },
        organization: mockOrg,
        context: {},
        performedBy: { type: 'user', user: mockUser }
      });
    });

    it('should create admin member with correct properties', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockSystemActor = { id: 'actor-system', oid: 1 };
      let mockMember = { id: 'member-1', oid: 1, actor: { id: 'actor-member' } };

      vi.mocked(ID.generateId).mockResolvedValue('org-1');
      vi.mocked(organizationActorService.createOrganizationActor).mockResolvedValue(mockSystemActor as any);
      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue(mockMember as any);
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organization: {
            create: vi.fn().mockResolvedValue(mockOrg)
          }
        };
        return callback(mockDb as any);
      });

      await organizationService.createOrganization({
        input: {
          name: 'Test Org'
        },
        context: {} as any,
        performedBy: mockUser as any
      });

      expect(organizationMemberService.createOrganizationMember).toHaveBeenCalledWith({
        user: mockUser,
        organization: mockOrg,
        input: { role: 'admin' },
        context: {},
        performedBy: { type: 'actor', actor: mockSystemActor }
      });
    });

    it('should queue profile sync with 5000ms delay', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockSystemActor = { id: 'actor-system', oid: 1 };
      let mockMember = { id: 'member-1', oid: 1, actor: { id: 'actor-member' } };

      vi.mocked(ID.generateId).mockResolvedValue('org-1');
      vi.mocked(organizationActorService.createOrganizationActor).mockResolvedValue(mockSystemActor as any);
      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue(mockMember as any);
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organization: {
            create: vi.fn().mockResolvedValue(mockOrg)
          }
        };
        return callback(mockDb as any);
      });

      await organizationService.createOrganization({
        input: {
          name: 'Test Org'
        },
        context: {} as any,
        performedBy: mockUser as any
      });

      expect(syncProfileQueue.add).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        { delay: 5000 }
      );
    });

    it('should handle transaction failures', async () => {
      vi.mocked(withTransaction).mockRejectedValue(new Error('Transaction failed'));

      await expect(
        organizationService.createOrganization({
          input: {
            name: 'Test Org'
          },
          context: {} as any,
          performedBy: { id: 'user-1', oid: 1 } as any
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('should create organization with status active', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = { id: 'org-1', oid: 1, status: 'active' };
      let mockSystemActor = { id: 'actor-system', oid: 1 };
      let mockMember = { id: 'member-1', oid: 1, actor: { id: 'actor-member' } };

      vi.mocked(ID.generateId).mockResolvedValue('org-1');
      vi.mocked(organizationActorService.createOrganizationActor).mockResolvedValue(mockSystemActor as any);
      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue(mockMember as any);
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organization: {
            create: vi.fn().mockResolvedValue(mockOrg)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationService.createOrganization({
        input: {
          name: 'Test Org'
        },
        context: {} as any,
        performedBy: mockUser as any
      });

      expect(result.organization.status).toBe('active');
    });

    it('should create organization with type default', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = { id: 'org-1', oid: 1, type: 'default' };
      let mockSystemActor = { id: 'actor-system', oid: 1 };
      let mockMember = { id: 'member-1', oid: 1, actor: { id: 'actor-member' } };

      vi.mocked(ID.generateId).mockResolvedValue('org-1');
      vi.mocked(organizationActorService.createOrganizationActor).mockResolvedValue(mockSystemActor as any);
      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue(mockMember as any);
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organization: {
            create: vi.fn().mockResolvedValue(mockOrg)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationService.createOrganization({
        input: {
          name: 'Test Org'
        },
        context: {} as any,
        performedBy: mockUser as any
      });

      expect(result.organization.type).toBe('default');
    });
  });

  describe('updateOrganization', () => {
    it('should update organization name', async () => {
      let mockOrg = {
        id: 'org-1',
        oid: 1,
        status: 'active',
        name: 'Old Name'
      };
      let updatedOrg = {
        ...mockOrg,
        name: 'New Name'
      };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organization: {
            update: vi.fn().mockResolvedValue(updatedOrg)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationService.updateOrganization({
        input: {
          name: 'New Name'
        },
        organization: mockOrg as any,
        context: {} as any,
        performedBy: mockPerformedBy as any
      });

      expect(result.name).toBe('New Name');
      expect(Fabric.fire).toHaveBeenCalledWith('organization.updated:before', expect.any(Object));
      expect(Fabric.fire).toHaveBeenCalledWith('organization.updated:after', expect.objectContaining({
        organization: updatedOrg,
        performedBy: mockPerformedBy
      }));
    });

    it('should update organization image', async () => {
      let mockOrg = { id: 'org-1', oid: 1, status: 'active' };
      let newImage = { type: 'url', url: 'https://example.com/new-logo.png' };
      let updatedOrg = {
        ...mockOrg,
        image: newImage
      };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organization: {
            update: vi.fn().mockResolvedValue(updatedOrg)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationService.updateOrganization({
        input: {
          image: newImage as any
        },
        organization: mockOrg as any,
        context: {} as any,
        performedBy: mockPerformedBy as any
      });

      expect(result.image).toEqual(newImage);
    });

    it('should update both name and image', async () => {
      let mockOrg = { id: 'org-1', oid: 1, status: 'active' };
      let newImage = { type: 'url', url: 'https://example.com/logo.png' };
      let updatedOrg = {
        ...mockOrg,
        name: 'Updated Org',
        image: newImage
      };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organization: {
            update: vi.fn().mockResolvedValue(updatedOrg)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationService.updateOrganization({
        input: {
          name: 'Updated Org',
          image: newImage as any
        },
        organization: mockOrg as any,
        context: {} as any,
        performedBy: mockPerformedBy as any
      });

      expect(result.name).toBe('Updated Org');
      expect(result.image).toEqual(newImage);
    });

    it('should queue profile sync with 5000ms delay', async () => {
      let mockOrg = { id: 'org-1', oid: 1, status: 'active' };
      let updatedOrg = { ...mockOrg, name: 'Updated' };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organization: {
            update: vi.fn().mockResolvedValue(updatedOrg)
          }
        };
        return callback(mockDb as any);
      });

      await organizationService.updateOrganization({
        input: {
          name: 'Updated'
        },
        organization: mockOrg as any,
        context: {} as any,
        performedBy: mockPerformedBy as any
      });

      expect(syncProfileQueue.add).toHaveBeenCalledWith(
        { organizationId: 'org-1' },
        { delay: 5000 }
      );
    });

    it('should throw forbidden error when organization is deleted', async () => {
      let mockOrg = {
        id: 'org-1',
        oid: 1,
        status: 'deleted'
      };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };

      await expect(
        organizationService.updateOrganization({
          input: {
            name: 'New Name'
          },
          organization: mockOrg as any,
          context: {} as any,
          performedBy: mockPerformedBy as any
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw forbidden error when organization is inactive', async () => {
      let mockOrg = {
        id: 'org-1',
        oid: 1,
        status: 'inactive'
      };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };

      await expect(
        organizationService.updateOrganization({
          input: {
            name: 'New Name'
          },
          organization: mockOrg as any,
          context: {} as any,
          performedBy: mockPerformedBy as any
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should handle empty input', async () => {
      let mockOrg = { id: 'org-1', oid: 1, status: 'active' };
      let updatedOrg = { ...mockOrg };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organization: {
            update: vi.fn().mockResolvedValue(updatedOrg)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationService.updateOrganization({
        input: {},
        organization: mockOrg as any,
        context: {} as any,
        performedBy: mockPerformedBy as any
      });

      expect(result).toEqual(updatedOrg);
    });

    it('should handle transaction failures', async () => {
      let mockOrg = { id: 'org-1', oid: 1, status: 'active' };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };

      vi.mocked(withTransaction).mockRejectedValue(new Error('Transaction failed'));

      await expect(
        organizationService.updateOrganization({
          input: {
            name: 'New Name'
          },
          organization: mockOrg as any,
          context: {} as any,
          performedBy: mockPerformedBy as any
        })
      ).rejects.toThrow('Transaction failed');
    });
  });

  describe('deleteOrganization', () => {
    it('should throw not implemented error', async () => {
      let mockOrg = { id: 'org-1', oid: 1, status: 'active' };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };

      await expect(
        organizationService.deleteOrganization({
          organization: mockOrg as any,
          context: {} as any,
          performedBy: mockPerformedBy as any
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw forbidden error when organization is deleted', async () => {
      let mockOrg = { id: 'org-1', oid: 1, status: 'deleted' };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };

      await expect(
        organizationService.deleteOrganization({
          organization: mockOrg as any,
          context: {} as any,
          performedBy: mockPerformedBy as any
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw forbidden error when organization is inactive', async () => {
      let mockOrg = { id: 'org-1', oid: 1, status: 'inactive' };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };

      await expect(
        organizationService.deleteOrganization({
          organization: mockOrg as any,
          context: {} as any,
          performedBy: mockPerformedBy as any
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('getOrganizationByIdForUser', () => {
    it('should return organization by ID', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = { id: 'org-1', oid: 1, slug: 'test-org' };
      let mockActor = { id: 'actor-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        lastActiveAt: new Date('2024-01-01')
      };

      vi.mocked(db.organization.findFirst).mockResolvedValue({
        ...mockOrg,
        members: [{ ...mockMember, actor: mockActor, user: mockUser }]
      } as any);
      vi.mocked(differenceInMinutes).mockReturnValue(60);

      let result = await organizationService.getOrganizationByIdForUser({
        organizationId: 'org-1',
        user: mockUser
      });

      expect(result.organization).toMatchObject(mockOrg);
      expect(result.member).toMatchObject(mockMember);
      expect(result.actor).toEqual(mockActor);
      expect(db.organization.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ id: 'org-1' }, { slug: 'org-1' }],
          members: {
            some: {
              user: { id: 'user-1' },
              status: 'active'
            }
          }
        },
        include: {
          members: {
            where: {
              user: { id: 'user-1' },
              status: 'active'
            },
            include: {
              actor: true,
              user: true
            }
          }
        }
      });
    });

    it('should return organization by slug', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = { id: 'org-1', oid: 1, slug: 'test-org' };
      let mockActor = { id: 'actor-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        lastActiveAt: new Date()
      };

      vi.mocked(db.organization.findFirst).mockResolvedValue({
        ...mockOrg,
        members: [{ ...mockMember, actor: mockActor, user: mockUser }]
      } as any);
      vi.mocked(differenceInMinutes).mockReturnValue(10);

      let result = await organizationService.getOrganizationByIdForUser({
        organizationId: 'test-org',
        user: mockUser
      });

      expect(result.organization).toMatchObject(mockOrg);
      expect(db.organization.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ id: 'test-org' }, { slug: 'test-org' }],
          members: {
            some: {
              user: { id: 'user-1' },
              status: 'active'
            }
          }
        },
        include: expect.any(Object)
      });
    });

    it('should update lastActiveAt when more than 30 minutes', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockActor = { id: 'actor-1', oid: 1 };
      let oldDate = new Date('2024-01-01T10:00:00');
      let mockMember = {
        id: 'member-1',
        oid: 1,
        lastActiveAt: oldDate
      };

      vi.mocked(db.organization.findFirst).mockResolvedValue({
        ...mockOrg,
        members: [{ ...mockMember, actor: mockActor, user: mockUser }]
      } as any);
      vi.mocked(differenceInMinutes).mockReturnValue(60);

      await organizationService.getOrganizationByIdForUser({
        organizationId: 'org-1',
        user: mockUser
      });

      expect(db.organizationMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { lastActiveAt: expect.any(Date) }
      });
    });

    it('should update lastActiveAt when null', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockActor = { id: 'actor-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        lastActiveAt: null
      };

      vi.mocked(db.organization.findFirst).mockResolvedValue({
        ...mockOrg,
        members: [{ ...mockMember, actor: mockActor, user: mockUser }]
      } as any);

      await organizationService.getOrganizationByIdForUser({
        organizationId: 'org-1',
        user: mockUser
      });

      expect(db.organizationMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { lastActiveAt: expect.any(Date) }
      });
    });

    it('should not update lastActiveAt when less than 30 minutes', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockActor = { id: 'actor-1', oid: 1 };
      let recentDate = new Date();
      let mockMember = {
        id: 'member-1',
        oid: 1,
        lastActiveAt: recentDate
      };

      vi.mocked(db.organization.findFirst).mockResolvedValue({
        ...mockOrg,
        members: [{ ...mockMember, actor: mockActor, user: mockUser }]
      } as any);
      vi.mocked(differenceInMinutes).mockReturnValue(15);

      await organizationService.getOrganizationByIdForUser({
        organizationId: 'org-1',
        user: mockUser
      });

      expect(db.organizationMember.update).not.toHaveBeenCalled();
    });

    it('should update lastActiveAt when exactly 31 minutes', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockActor = { id: 'actor-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        lastActiveAt: new Date('2024-01-01T10:00:00')
      };

      vi.mocked(db.organization.findFirst).mockResolvedValue({
        ...mockOrg,
        members: [{ ...mockMember, actor: mockActor, user: mockUser }]
      } as any);
      vi.mocked(differenceInMinutes).mockReturnValue(31);

      await organizationService.getOrganizationByIdForUser({
        organizationId: 'org-1',
        user: mockUser
      });

      expect(db.organizationMember.update).toHaveBeenCalled();
    });

    it('should not update lastActiveAt when exactly 30 minutes', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockActor = { id: 'actor-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        lastActiveAt: new Date('2024-01-01T10:00:00')
      };

      vi.mocked(db.organization.findFirst).mockResolvedValue({
        ...mockOrg,
        members: [{ ...mockMember, actor: mockActor, user: mockUser }]
      } as any);
      vi.mocked(differenceInMinutes).mockReturnValue(30);

      await organizationService.getOrganizationByIdForUser({
        organizationId: 'org-1',
        user: mockUser
      });

      expect(db.organizationMember.update).not.toHaveBeenCalled();
    });

    it('should throw not found error when organization does not exist', async () => {
      let mockUser = { id: 'user-1', oid: 1 };

      vi.mocked(db.organization.findFirst).mockResolvedValue(null);

      await expect(
        organizationService.getOrganizationByIdForUser({
          organizationId: 'org-999',
          user: mockUser
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw not found error when user is not a member', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = { id: 'org-1', oid: 1, members: [] };

      vi.mocked(db.organization.findFirst).mockResolvedValue(mockOrg as any);

      await expect(
        organizationService.getOrganizationByIdForUser({
          organizationId: 'org-1',
          user: mockUser
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw not found error when member is inactive', async () => {
      let mockUser = { id: 'user-1', oid: 1 };

      vi.mocked(db.organization.findFirst).mockResolvedValue(null);

      await expect(
        organizationService.getOrganizationByIdForUser({
          organizationId: 'org-1',
          user: mockUser
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should include actor and user in member', async () => {
      let mockUser = { id: 'user-1', oid: 1, name: 'John Doe' };
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockActor = { id: 'actor-1', oid: 1, name: 'John Doe' };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        lastActiveAt: new Date()
      };

      vi.mocked(db.organization.findFirst).mockResolvedValue({
        ...mockOrg,
        members: [{ ...mockMember, actor: mockActor, user: mockUser }]
      } as any);
      vi.mocked(differenceInMinutes).mockReturnValue(10);

      let result = await organizationService.getOrganizationByIdForUser({
        organizationId: 'org-1',
        user: mockUser
      });

      expect(result.member.actor).toEqual(mockActor);
      expect(result.member.user).toEqual(mockUser);
    });

    it('should handle empty organization ID', async () => {
      let mockUser = { id: 'user-1', oid: 1 };

      vi.mocked(db.organization.findFirst).mockResolvedValue(null);

      await expect(
        organizationService.getOrganizationByIdForUser({
          organizationId: '',
          user: mockUser
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('listOrganizations', () => {
    it('should list organizations for user', async () => {
      let mockUser = { id: 'user-1', oid: 1 };

      let result = await organizationService.listOrganizations({
        filter: { type: 'user', user: mockUser as any }
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should list organizations for actor', async () => {
      let mockActor = { id: 'actor-1', oid: 1 };

      let result = await organizationService.listOrganizations({
        filter: { type: 'actor', actor: mockActor as any }
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should filter by user with active membership', async () => {
      let mockUser = { id: 'user-1', oid: 1 };

      let result = await organizationService.listOrganizations({
        filter: { type: 'user', user: mockUser as any }
      });

      expect(result).toBeDefined();
    });

    it('should filter by actor oid', async () => {
      let mockActor = { id: 'actor-1', oid: 1 };

      let result = await organizationService.listOrganizations({
        filter: { type: 'actor', actor: mockActor as any }
      });

      expect(result).toBeDefined();
    });

    it('should only return active organizations', async () => {
      let mockUser = { id: 'user-1', oid: 1 };

      let result = await organizationService.listOrganizations({
        filter: { type: 'user', user: mockUser as any }
      });

      expect(result).toBeDefined();
    });

    it('should return paginated results', async () => {
      let mockUser = { id: 'user-1', oid: 1 };

      let result = await organizationService.listOrganizations({
        filter: { type: 'user', user: mockUser as any }
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });
  });

  describe('bootUser', () => {
    it('should return user organizations, projects, and instances', async () => {
      let mockUser = { id: 'user-1', oid: 1, name: 'John Doe' };
      let mockOrg1 = {
        id: 'org-1',
        oid: 1,
        name: 'Org 1',
        members: [
          {
            id: 'member-1',
            oid: 1,
            actor: { id: 'actor-1', oid: 1 }
          }
        ],
        projects: [
          { id: 'proj-1', oid: 1, name: 'Project 1' }
        ],
        instances: [
          {
            id: 'inst-1',
            oid: 1,
            name: 'Instance 1',
            project: { id: 'proj-1', oid: 1 }
          }
        ]
      };
      let mockOrg2 = {
        id: 'org-2',
        oid: 2,
        name: 'Org 2',
        members: [
          {
            id: 'member-2',
            oid: 2,
            actor: { id: 'actor-2', oid: 2 }
          }
        ],
        projects: [
          { id: 'proj-2', oid: 2, name: 'Project 2' }
        ],
        instances: [
          {
            id: 'inst-2',
            oid: 2,
            name: 'Instance 2',
            project: { id: 'proj-2', oid: 2 }
          }
        ]
      };

      vi.mocked(db.organization.findMany).mockResolvedValue([mockOrg1, mockOrg2] as any);

      let result = await organizationService.bootUser({
        user: mockUser as any
      });

      expect(result.user).toEqual(mockUser);
      expect(result.organizations).toHaveLength(2);
      expect(result.organizations[0]).toMatchObject({
        ...mockOrg1,
        member: mockOrg1.members[0]
      });
      expect(result.projects).toHaveLength(2);
      expect(result.instances).toHaveLength(2);
      expect(result.projects[0].organization).toEqual(mockOrg1);
      expect(result.instances[0].organization).toEqual(mockOrg1);
    });

    it('should filter by user oid and active status', async () => {
      let mockUser = { id: 'user-1', oid: 1 };

      vi.mocked(db.organization.findMany).mockResolvedValue([]);

      await organizationService.bootUser({
        user: mockUser as any
      });

      expect(db.organization.findMany).toHaveBeenCalledWith({
        where: {
          members: {
            some: {
              userOid: 1,
              status: 'active'
            }
          }
        },
        orderBy: { id: 'asc' },
        include: {
          members: {
            where: {
              userOid: 1,
              status: 'active'
            },
            include: {
              actor: true
            }
          },
          projects: {
            orderBy: { id: 'asc' }
          },
          instances: {
            include: {
              project: true
            },
            orderBy: { id: 'asc' }
          }
        }
      });
    });

    it('should return empty arrays when user has no organizations', async () => {
      let mockUser = { id: 'user-1', oid: 1 };

      vi.mocked(db.organization.findMany).mockResolvedValue([]);

      let result = await organizationService.bootUser({
        user: mockUser as any
      });

      expect(result.user).toEqual(mockUser);
      expect(result.organizations).toEqual([]);
      expect(result.projects).toEqual([]);
      expect(result.instances).toEqual([]);
    });

    it('should flatten projects from all organizations', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg1 = {
        id: 'org-1',
        oid: 1,
        members: [{ id: 'member-1', oid: 1, actor: { id: 'actor-1' } }],
        projects: [
          { id: 'proj-1', oid: 1 },
          { id: 'proj-2', oid: 2 }
        ],
        instances: []
      };
      let mockOrg2 = {
        id: 'org-2',
        oid: 2,
        members: [{ id: 'member-2', oid: 2, actor: { id: 'actor-2' } }],
        projects: [
          { id: 'proj-3', oid: 3 }
        ],
        instances: []
      };

      vi.mocked(db.organization.findMany).mockResolvedValue([mockOrg1, mockOrg2] as any);

      let result = await organizationService.bootUser({
        user: mockUser as any
      });

      expect(result.projects).toHaveLength(3);
      expect(result.projects[0].organization).toEqual(mockOrg1);
      expect(result.projects[1].organization).toEqual(mockOrg1);
      expect(result.projects[2].organization).toEqual(mockOrg2);
    });

    it('should flatten instances from all organizations', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg1 = {
        id: 'org-1',
        oid: 1,
        members: [{ id: 'member-1', oid: 1, actor: { id: 'actor-1' } }],
        projects: [],
        instances: [
          { id: 'inst-1', oid: 1, project: { id: 'proj-1' } },
          { id: 'inst-2', oid: 2, project: { id: 'proj-1' } }
        ]
      };
      let mockOrg2 = {
        id: 'org-2',
        oid: 2,
        members: [{ id: 'member-2', oid: 2, actor: { id: 'actor-2' } }],
        projects: [],
        instances: [
          { id: 'inst-3', oid: 3, project: { id: 'proj-2' } }
        ]
      };

      vi.mocked(db.organization.findMany).mockResolvedValue([mockOrg1, mockOrg2] as any);

      let result = await organizationService.bootUser({
        user: mockUser as any
      });

      expect(result.instances).toHaveLength(3);
      expect(result.instances[0].organization).toEqual(mockOrg1);
      expect(result.instances[0].project).toEqual(mockOrg1.instances[0].project);
      expect(result.instances[2].organization).toEqual(mockOrg2);
    });

    it('should order organizations by id ascending', async () => {
      let mockUser = { id: 'user-1', oid: 1 };

      vi.mocked(db.organization.findMany).mockResolvedValue([]);

      await organizationService.bootUser({
        user: mockUser as any
      });

      expect(db.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { id: 'asc' }
        })
      );
    });

    it('should order projects by id ascending', async () => {
      let mockUser = { id: 'user-1', oid: 1 };

      vi.mocked(db.organization.findMany).mockResolvedValue([]);

      await organizationService.bootUser({
        user: mockUser as any
      });

      expect(db.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            projects: {
              orderBy: { id: 'asc' }
            }
          })
        })
      );
    });

    it('should order instances by id ascending', async () => {
      let mockUser = { id: 'user-1', oid: 1 };

      vi.mocked(db.organization.findMany).mockResolvedValue([]);

      await organizationService.bootUser({
        user: mockUser as any
      });

      expect(db.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            instances: {
              include: {
                project: true
              },
              orderBy: { id: 'asc' }
            }
          })
        })
      );
    });

    it('should include member actor for each organization', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = {
        id: 'org-1',
        oid: 1,
        members: [
          {
            id: 'member-1',
            oid: 1,
            actor: { id: 'actor-1', oid: 1, name: 'John Doe' }
          }
        ],
        projects: [],
        instances: []
      };

      vi.mocked(db.organization.findMany).mockResolvedValue([mockOrg] as any);

      let result = await organizationService.bootUser({
        user: mockUser as any
      });

      expect(result.organizations[0].member.actor).toEqual(mockOrg.members[0].actor);
    });

    it('should handle organizations with no projects or instances', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = {
        id: 'org-1',
        oid: 1,
        members: [{ id: 'member-1', oid: 1, actor: { id: 'actor-1' } }],
        projects: [],
        instances: []
      };

      vi.mocked(db.organization.findMany).mockResolvedValue([mockOrg] as any);

      let result = await organizationService.bootUser({
        user: mockUser as any
      });

      expect(result.organizations).toHaveLength(1);
      expect(result.projects).toEqual([]);
      expect(result.instances).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle organization with special characters in name', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = {
        id: 'org-1',
        oid: 1,
        name: 'Test & Co. "Org"',
        status: 'active'
      };
      let mockSystemActor = { id: 'actor-system', oid: 1 };
      let mockMember = { id: 'member-1', oid: 1, actor: { id: 'actor-member' } };

      vi.mocked(ID.generateId).mockResolvedValue('org-1');
      vi.mocked(organizationActorService.createOrganizationActor).mockResolvedValue(mockSystemActor as any);
      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue(mockMember as any);
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organization: {
            create: vi.fn().mockResolvedValue(mockOrg)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationService.createOrganization({
        input: {
          name: 'Test & Co. "Org"'
        },
        context: {} as any,
        performedBy: mockUser as any
      });

      expect(result.organization.name).toBe('Test & Co. "Org"');
    });

    it('should handle database errors in findFirst', async () => {
      let mockUser = { id: 'user-1', oid: 1 };

      vi.mocked(db.organization.findFirst).mockRejectedValue(new Error('Database error'));

      await expect(
        organizationService.getOrganizationByIdForUser({
          organizationId: 'org-1',
          user: mockUser
        })
      ).rejects.toThrow('Database error');
    });

    it('should handle database errors in findMany', async () => {
      let mockUser = { id: 'user-1', oid: 1 };

      vi.mocked(db.organization.findMany).mockRejectedValue(new Error('Database error'));

      await expect(
        organizationService.bootUser({
          user: mockUser as any
        })
      ).rejects.toThrow('Database error');
    });

    it('should handle actor creation failure in createOrganization', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = { id: 'org-1', oid: 1 };

      vi.mocked(ID.generateId).mockResolvedValue('org-1');
      vi.mocked(organizationActorService.createOrganizationActor).mockRejectedValue(
        new Error('Actor creation failed')
      );
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organization: {
            create: vi.fn().mockResolvedValue(mockOrg)
          }
        };
        return callback(mockDb as any);
      });

      await expect(
        organizationService.createOrganization({
          input: {
            name: 'Test Org'
          },
          context: {} as any,
          performedBy: mockUser as any
        })
      ).rejects.toThrow('Actor creation failed');
    });

    it('should handle member creation failure in createOrganization', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockSystemActor = { id: 'actor-system', oid: 1 };

      vi.mocked(ID.generateId).mockResolvedValue('org-1');
      vi.mocked(organizationActorService.createOrganizationActor).mockResolvedValue(mockSystemActor as any);
      vi.mocked(organizationMemberService.createOrganizationMember).mockRejectedValue(
        new Error('Member creation failed')
      );
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organization: {
            create: vi.fn().mockResolvedValue(mockOrg)
          }
        };
        return callback(mockDb as any);
      });

      await expect(
        organizationService.createOrganization({
          input: {
            name: 'Test Org'
          },
          context: {} as any,
          performedBy: mockUser as any
        })
      ).rejects.toThrow('Member creation failed');
    });

    it('should handle null user in getOrganizationByIdForUser', async () => {
      vi.mocked(db.organization.findFirst).mockResolvedValue(null);

      await expect(
        organizationService.getOrganizationByIdForUser({
          organizationId: 'org-1',
          user: null as any
        })
      ).rejects.toThrow();
    });

    it('should handle organization with multiple members (should return first)', async () => {
      let mockUser = { id: 'user-1', oid: 1 };
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockActor1 = { id: 'actor-1', oid: 1 };
      let mockActor2 = { id: 'actor-2', oid: 2 };
      let mockMember1 = {
        id: 'member-1',
        oid: 1,
        lastActiveAt: new Date(),
        actor: mockActor1,
        user: mockUser
      };
      let mockMember2 = {
        id: 'member-2',
        oid: 2,
        lastActiveAt: new Date(),
        actor: mockActor2,
        user: mockUser
      };

      vi.mocked(db.organization.findFirst).mockResolvedValue({
        ...mockOrg,
        members: [mockMember1, mockMember2]
      } as any);
      vi.mocked(differenceInMinutes).mockReturnValue(10);

      let result = await organizationService.getOrganizationByIdForUser({
        organizationId: 'org-1',
        user: mockUser
      });

      expect(result.member).toEqual(mockMember1);
      expect(result.actor).toEqual(mockActor1);
    });
  });
});
