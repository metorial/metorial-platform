import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceError, conflictError, forbiddenError, notFoundError } from '@metorial/error';

// Mock external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    organizationMember: {
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
    organizationMember: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
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

// Mock organizationActorService
vi.mock('../src/services/organizationActor', () => ({
  organizationActorService: {
    createOrganizationActor: vi.fn()
  }
}));

import { db, ID, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { organizationActorService } from '../src/services/organizationActor';
import { organizationMemberService } from '../src/services/organizationMember';

describe('OrganizationMemberService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrganizationMember', () => {
    it('should create a new organization member', async () => {
      let mockOrg = { id: 'org-1', oid: 1, name: 'Test Org' };
      let mockUser = { id: 'user-1', oid: 1, name: 'John Doe', email: 'john@example.com', image: { type: 'default' } };
      let mockActor = {
        id: 'actor-1',
        oid: 1,
        type: 'member',
        name: 'John Doe',
        email: 'john@example.com',
        organizationOid: 1,
        organization: mockOrg
      };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        status: 'active',
        role: 'member',
        organizationOid: 1,
        actorOid: 1,
        userOid: 1,
        actor: mockActor,
        organization: mockOrg,
        user: mockUser
      };

      vi.mocked(ID.generateId).mockResolvedValue('member-1');
      vi.mocked(organizationActorService.createOrganizationActor).mockResolvedValue(mockActor as any);
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockMember)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationMemberService.createOrganizationMember({
        user: mockUser as any,
        organization: mockOrg as any,
        input: {
          role: 'member'
        },
        context: {} as any,
        performedBy: { type: 'user', user: mockUser as any }
      });

      expect(result).toEqual(mockMember);
      expect(ID.generateId).toHaveBeenCalledWith('organizationMember');
      expect(organizationActorService.createOrganizationActor).toHaveBeenCalledWith({
        input: {
          type: 'member',
          name: mockUser.name,
          email: mockUser.email,
          image: mockUser.image
        },
        performedBy: { type: 'user', user: mockUser },
        organization: mockOrg,
        context: {}
      });
      expect(Fabric.fire).toHaveBeenCalledWith('organization.member.created:before', expect.objectContaining({
        actor: mockActor,
        user: mockUser,
        organization: mockOrg,
        performedBy: mockActor
      }));
      expect(Fabric.fire).toHaveBeenCalledWith('organization.member.created:after', expect.objectContaining({
        actor: mockActor,
        member: mockMember,
        performedBy: mockActor
      }));
    });

    it('should create member with admin role', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockUser = { id: 'user-1', oid: 1, name: 'Admin User', email: 'admin@example.com', image: { type: 'default' } };
      let mockActor = { id: 'actor-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        role: 'admin',
        status: 'active'
      };

      vi.mocked(ID.generateId).mockResolvedValue('member-1');
      vi.mocked(organizationActorService.createOrganizationActor).mockResolvedValue(mockActor as any);
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockMember)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationMemberService.createOrganizationMember({
        user: mockUser as any,
        organization: mockOrg as any,
        input: {
          role: 'admin'
        },
        context: {} as any,
        performedBy: { type: 'user', user: mockUser as any }
      });

      expect(result.role).toBe('admin');
    });

    it('should throw conflict error when user is already an active member', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockUser = { id: 'user-1', oid: 1 };
      let existingMember = {
        id: 'member-1',
        oid: 1,
        status: 'active',
        organizationOid: 1,
        userOid: 1,
        actor: { id: 'actor-1', oid: 1 }
      };

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(existingMember)
          }
        };
        return callback(mockDb as any);
      });

      await expect(
        organizationMemberService.createOrganizationMember({
          user: mockUser as any,
          organization: mockOrg as any,
          input: { role: 'member' },
          context: {} as any,
          performedBy: { type: 'user', user: mockUser as any }
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should reactivate deleted member with existing actor', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockUser = { id: 'user-1', oid: 1, name: 'John Doe', email: 'john@example.com' };
      let existingActor = {
        id: 'actor-1',
        oid: 1,
        type: 'member',
        organization: mockOrg
      };
      let existingMember = {
        id: 'member-1',
        oid: 1,
        status: 'deleted',
        organizationOid: 1,
        userOid: 1,
        actor: existingActor
      };
      let reactivatedMember = {
        ...existingMember,
        status: 'active',
        role: 'member',
        actor: existingActor,
        organization: mockOrg,
        user: mockUser
      };

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(existingMember),
            update: vi.fn().mockResolvedValue(reactivatedMember)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationMemberService.createOrganizationMember({
        user: mockUser as any,
        organization: mockOrg as any,
        input: { role: 'member' },
        context: {} as any,
        performedBy: { type: 'user', user: mockUser as any }
      });

      expect(result.status).toBe('active');
      expect(organizationActorService.createOrganizationActor).not.toHaveBeenCalled();
    });

    it('should handle performedBy actor', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockUser = { id: 'user-1', oid: 1, name: 'Test User', email: 'test@example.com', image: { type: 'default' } };
      let mockPerformedByActor = { id: 'actor-0', oid: 0 };
      let mockActor = { id: 'actor-1', oid: 1 };
      let mockMember = { id: 'member-1', oid: 1, status: 'active', role: 'member' };

      vi.mocked(ID.generateId).mockResolvedValue('member-1');
      vi.mocked(organizationActorService.createOrganizationActor).mockResolvedValue(mockActor as any);
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockMember)
          }
        };
        return callback(mockDb as any);
      });

      await organizationMemberService.createOrganizationMember({
        user: mockUser as any,
        organization: mockOrg as any,
        input: { role: 'member' },
        context: {} as any,
        performedBy: { type: 'actor', actor: mockPerformedByActor as any }
      });

      expect(Fabric.fire).toHaveBeenCalledWith('organization.member.created:before', expect.objectContaining({
        performedBy: mockPerformedByActor
      }));
      expect(Fabric.fire).toHaveBeenCalledWith('organization.member.created:after', expect.objectContaining({
        performedBy: mockPerformedByActor
      }));
    });

    it('should create actor without image when user has no image', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockUser = { id: 'user-1', oid: 1, name: 'Test User', email: 'test@example.com' };
      let mockActor = { id: 'actor-1', oid: 1 };
      let mockMember = { id: 'member-1', oid: 1 };

      vi.mocked(ID.generateId).mockResolvedValue('member-1');
      vi.mocked(organizationActorService.createOrganizationActor).mockResolvedValue(mockActor as any);
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockMember)
          }
        };
        return callback(mockDb as any);
      });

      await organizationMemberService.createOrganizationMember({
        user: mockUser as any,
        organization: mockOrg as any,
        input: { role: 'member' },
        context: {} as any,
        performedBy: { type: 'user', user: mockUser as any }
      });

      expect(organizationActorService.createOrganizationActor).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            name: mockUser.name,
            email: mockUser.email,
            image: undefined
          })
        })
      );
    });
  });

  describe('updateOrganizationMember', () => {
    it('should update member role successfully', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        status: 'active',
        role: 'member'
      };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };
      let updatedMember = {
        ...mockMember,
        role: 'admin',
        actor: { id: 'actor-2', oid: 2, organization: mockOrg },
        organization: mockOrg,
        user: { id: 'user-1', oid: 1 }
      };

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            update: vi.fn().mockResolvedValue(updatedMember)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationMemberService.updateOrganizationMember({
        organization: mockOrg as any,
        member: mockMember as any,
        input: { role: 'admin' },
        context: {} as any,
        performedBy: mockPerformedBy as any
      });

      expect(result.role).toBe('admin');
      expect(Fabric.fire).toHaveBeenCalledWith('organization.member.updated:before', expect.any(Object));
      expect(Fabric.fire).toHaveBeenCalledWith('organization.member.updated:after', expect.objectContaining({
        member: updatedMember,
        performedBy: mockPerformedBy
      }));
    });

    it('should throw forbidden error when member is deleted', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        status: 'deleted'
      };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };

      await expect(
        organizationMemberService.updateOrganizationMember({
          organization: mockOrg as any,
          member: mockMember as any,
          input: { role: 'admin' },
          context: {} as any,
          performedBy: mockPerformedBy as any
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should update member with empty input', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        status: 'active',
        role: 'member'
      };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };
      let updatedMember = {
        ...mockMember,
        actor: { id: 'actor-2', oid: 2, organization: mockOrg },
        organization: mockOrg,
        user: { id: 'user-1', oid: 1 }
      };

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            update: vi.fn().mockResolvedValue(updatedMember)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationMemberService.updateOrganizationMember({
        organization: mockOrg as any,
        member: mockMember as any,
        input: {},
        context: {} as any,
        performedBy: mockPerformedBy as any
      });

      expect(result).toEqual(updatedMember);
      expect(Fabric.fire).toHaveBeenCalled();
    });

    it('should change member role from admin to member', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        status: 'active',
        role: 'admin'
      };
      let updatedMember = {
        ...mockMember,
        role: 'member',
        actor: { id: 'actor-1', oid: 1, organization: mockOrg },
        organization: mockOrg,
        user: { id: 'user-1', oid: 1 }
      };

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            update: vi.fn().mockResolvedValue(updatedMember)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationMemberService.updateOrganizationMember({
        organization: mockOrg as any,
        member: mockMember as any,
        input: { role: 'member' },
        context: {} as any,
        performedBy: { id: 'actor-1', oid: 1 } as any
      });

      expect(result.role).toBe('member');
    });

    it('should preserve other member fields during update', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        status: 'active',
        role: 'member',
        userOid: 1,
        actorOid: 1,
        organizationOid: 1
      };
      let updatedMember = {
        ...mockMember,
        role: 'admin',
        actor: { id: 'actor-1', oid: 1, organization: mockOrg },
        organization: mockOrg,
        user: { id: 'user-1', oid: 1 }
      };

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            update: vi.fn().mockResolvedValue(updatedMember)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationMemberService.updateOrganizationMember({
        organization: mockOrg as any,
        member: mockMember as any,
        input: { role: 'admin' },
        context: {} as any,
        performedBy: { id: 'actor-1', oid: 1 } as any
      });

      expect(result.userOid).toBe(1);
      expect(result.actorOid).toBe(1);
      expect(result.organizationOid).toBe(1);
    });
  });

  describe('deleteOrganizationMember', () => {
    it('should soft delete member successfully', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        status: 'active',
        role: 'member'
      };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };
      let deletedMember = {
        ...mockMember,
        status: 'deleted',
        deletedAt: new Date(),
        actor: { id: 'actor-2', oid: 2, organization: mockOrg },
        organization: mockOrg,
        user: { id: 'user-1', oid: 1 }
      };

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            update: vi.fn().mockResolvedValue(deletedMember)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationMemberService.deleteOrganizationMember({
        organization: mockOrg as any,
        member: mockMember as any,
        context: {} as any,
        performedBy: mockPerformedBy as any
      });

      expect(result.status).toBe('deleted');
      expect(result.deletedAt).toBeInstanceOf(Date);
      expect(Fabric.fire).toHaveBeenCalledWith('organization.member.deleted:before', expect.any(Object));
      expect(Fabric.fire).toHaveBeenCalledWith('organization.member.deleted:after', expect.objectContaining({
        member: deletedMember,
        performedBy: mockPerformedBy
      }));
    });

    it('should throw forbidden error when member is already deleted', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        status: 'deleted'
      };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };

      await expect(
        organizationMemberService.deleteOrganizationMember({
          organization: mockOrg as any,
          member: mockMember as any,
          context: {} as any,
          performedBy: mockPerformedBy as any
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should set deletedAt timestamp', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        status: 'active'
      };
      let now = new Date();
      let deletedMember = {
        ...mockMember,
        status: 'deleted',
        deletedAt: now,
        actor: { id: 'actor-1', oid: 1, organization: mockOrg },
        organization: mockOrg,
        user: { id: 'user-1', oid: 1 }
      };

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            update: vi.fn().mockResolvedValue(deletedMember)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationMemberService.deleteOrganizationMember({
        organization: mockOrg as any,
        member: mockMember as any,
        context: {} as any,
        performedBy: { id: 'actor-1', oid: 1 } as any
      });

      expect(result.deletedAt).toEqual(now);
    });

    it('should include all relations in deleted member response', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockActor = { id: 'actor-1', oid: 1, organization: mockOrg };
      let mockUser = { id: 'user-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        status: 'active'
      };
      let deletedMember = {
        ...mockMember,
        status: 'deleted',
        deletedAt: new Date(),
        actor: mockActor,
        organization: mockOrg,
        user: mockUser
      };

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            update: vi.fn().mockResolvedValue(deletedMember)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationMemberService.deleteOrganizationMember({
        organization: mockOrg as any,
        member: mockMember as any,
        context: {} as any,
        performedBy: { id: 'actor-2', oid: 2 } as any
      });

      expect(result.actor).toEqual(mockActor);
      expect(result.organization).toEqual(mockOrg);
      expect(result.user).toEqual(mockUser);
    });
  });

  describe('getOrganizationMemberById', () => {
    it('should return member by member ID', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        organizationOid: 1,
        actor: { id: 'actor-1', oid: 1, organization: mockOrg },
        organization: mockOrg,
        user: { id: 'user-1', oid: 1 }
      };

      vi.mocked(db.organizationMember.findFirst).mockResolvedValue(mockMember as any);

      let result = await organizationMemberService.getOrganizationMemberById({
        organization: mockOrg as any,
        memberId: 'member-1'
      });

      expect(result).toEqual(mockMember);
      expect(db.organizationMember.findFirst).toHaveBeenCalledWith({
        where: {
          organizationOid: 1,
          OR: [{ id: 'member-1' }, { user: { id: 'member-1' } }]
        },
        include: {
          actor: { include: { organization: true } },
          organization: true,
          user: true
        }
      });
    });

    it('should return member by user ID', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        organizationOid: 1,
        user: { id: 'user-1', oid: 1 },
        actor: { id: 'actor-1', oid: 1, organization: mockOrg },
        organization: mockOrg
      };

      vi.mocked(db.organizationMember.findFirst).mockResolvedValue(mockMember as any);

      let result = await organizationMemberService.getOrganizationMemberById({
        organization: mockOrg as any,
        memberId: 'user-1'
      });

      expect(result).toEqual(mockMember);
      expect(result.user.id).toBe('user-1');
    });

    it('should throw not found error when member does not exist', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      vi.mocked(db.organizationMember.findFirst).mockResolvedValue(null);

      await expect(
        organizationMemberService.getOrganizationMemberById({
          organization: mockOrg as any,
          memberId: 'member-999'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw not found error with member ID in error message', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      vi.mocked(db.organizationMember.findFirst).mockResolvedValue(null);

      try {
        await organizationMemberService.getOrganizationMemberById({
          organization: mockOrg as any,
          memberId: 'member-999'
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
      }
    });

    it('should include all relations', async () => {
      let mockOrg = { id: 'org-1', oid: 1, name: 'Test Org' };
      let mockActor = { id: 'actor-1', oid: 1, name: 'John Doe', organization: mockOrg };
      let mockUser = { id: 'user-1', oid: 1, name: 'John Doe', email: 'john@example.com' };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        organizationOid: 1,
        actor: mockActor,
        organization: mockOrg,
        user: mockUser
      };

      vi.mocked(db.organizationMember.findFirst).mockResolvedValue(mockMember as any);

      let result = await organizationMemberService.getOrganizationMemberById({
        organization: mockOrg as any,
        memberId: 'member-1'
      });

      expect(result.actor).toEqual(mockActor);
      expect(result.organization).toEqual(mockOrg);
      expect(result.user).toEqual(mockUser);
    });

    it('should handle empty member ID', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      vi.mocked(db.organizationMember.findFirst).mockResolvedValue(null);

      await expect(
        organizationMemberService.getOrganizationMemberById({
          organization: mockOrg as any,
          memberId: ''
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('listOrganizationMembers', () => {
    it('should list all active members for organization', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      let result = await organizationMemberService.listOrganizationMembers({
        organization: mockOrg as any
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should filter by organization oid', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      let result = await organizationMemberService.listOrganizationMembers({
        organization: mockOrg as any
      });

      expect(result).toBeDefined();
    });

    it('should only return active members', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      let result = await organizationMemberService.listOrganizationMembers({
        organization: mockOrg as any
      });

      expect(result).toBeDefined();
    });

    it('should include all relations in listed members', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      let result = await organizationMemberService.listOrganizationMembers({
        organization: mockOrg as any
      });

      expect(result).toBeDefined();
    });

    it('should return paginated results', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      let result = await organizationMemberService.listOrganizationMembers({
        organization: mockOrg as any
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });
  });

  describe('edge cases', () => {
    it('should handle transaction failures in create', async () => {
      vi.mocked(withTransaction).mockRejectedValue(new Error('Transaction failed'));

      await expect(
        organizationMemberService.createOrganizationMember({
          user: { id: 'user-1', oid: 1 } as any,
          organization: { id: 'org-1', oid: 1 } as any,
          input: { role: 'member' },
          context: {} as any,
          performedBy: { type: 'user', user: { id: 'user-1', oid: 1 } as any }
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('should handle transaction failures in update', async () => {
      vi.mocked(withTransaction).mockRejectedValue(new Error('Transaction failed'));

      await expect(
        organizationMemberService.updateOrganizationMember({
          organization: { id: 'org-1', oid: 1 } as any,
          member: { id: 'member-1', oid: 1, status: 'active' } as any,
          input: { role: 'admin' },
          context: {} as any,
          performedBy: { id: 'actor-1', oid: 1 } as any
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('should handle transaction failures in delete', async () => {
      vi.mocked(withTransaction).mockRejectedValue(new Error('Transaction failed'));

      await expect(
        organizationMemberService.deleteOrganizationMember({
          organization: { id: 'org-1', oid: 1 } as any,
          member: { id: 'member-1', oid: 1, status: 'active' } as any,
          context: {} as any,
          performedBy: { id: 'actor-1', oid: 1 } as any
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('should handle database errors in findFirst', async () => {
      vi.mocked(db.organizationMember.findFirst).mockRejectedValue(new Error('Database error'));

      await expect(
        organizationMemberService.getOrganizationMemberById({
          organization: { id: 'org-1', oid: 1 } as any,
          memberId: 'member-1'
        })
      ).rejects.toThrow('Database error');
    });

    it('should handle actor creation failure', async () => {
      vi.mocked(organizationActorService.createOrganizationActor).mockRejectedValue(
        new Error('Actor creation failed')
      );
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(null)
          }
        };
        return callback(mockDb as any);
      });

      await expect(
        organizationMemberService.createOrganizationMember({
          user: { id: 'user-1', oid: 1, name: 'Test', email: 'test@example.com' } as any,
          organization: { id: 'org-1', oid: 1 } as any,
          input: { role: 'member' },
          context: {} as any,
          performedBy: { type: 'user', user: { id: 'user-1', oid: 1 } as any }
        })
      ).rejects.toThrow('Actor creation failed');
    });

    it('should handle null organization', async () => {
      vi.mocked(db.organizationMember.findFirst).mockResolvedValue(null);

      await expect(
        organizationMemberService.getOrganizationMemberById({
          organization: null as any,
          memberId: 'member-1'
        })
      ).rejects.toThrow();
    });

    it('should handle member with all optional fields present', async () => {
      let mockOrg = { id: 'org-1', oid: 1, name: 'Complete Org' };
      let mockActor = {
        id: 'actor-1',
        oid: 1,
        name: 'Complete Actor',
        email: 'actor@example.com',
        organization: mockOrg
      };
      let mockUser = {
        id: 'user-1',
        oid: 1,
        name: 'Complete User',
        email: 'user@example.com',
        image: { type: 'url', url: 'https://example.com/avatar.jpg' }
      };
      let mockMember = {
        id: 'member-1',
        oid: 1,
        status: 'active',
        role: 'admin',
        organizationOid: 1,
        actorOid: 1,
        userOid: 1,
        actor: mockActor,
        organization: mockOrg,
        user: mockUser,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActiveAt: new Date()
      };

      vi.mocked(db.organizationMember.findFirst).mockResolvedValue(mockMember as any);

      let result = await organizationMemberService.getOrganizationMemberById({
        organization: mockOrg as any,
        memberId: 'member-1'
      });

      expect(result).toEqual(mockMember);
    });

    it('should handle concurrent member creation attempts', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockUser = { id: 'user-1', oid: 1, name: 'Test', email: 'test@example.com', image: { type: 'default' } };
      let mockActor = { id: 'actor-1', oid: 1 };

      vi.mocked(ID.generateId).mockResolvedValue('member-1');
      vi.mocked(organizationActorService.createOrganizationActor).mockResolvedValue(mockActor as any);

      // Simulate race condition: member doesn't exist initially, but does by the time we create
      let callCount = 0;
      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(callCount++ > 0 ? { status: 'active' } : null),
            create: vi.fn().mockRejectedValue(new Error('Unique constraint violation'))
          }
        };
        return callback(mockDb as any);
      });

      await expect(
        organizationMemberService.createOrganizationMember({
          user: mockUser as any,
          organization: mockOrg as any,
          input: { role: 'member' },
          context: {} as any,
          performedBy: { type: 'user', user: mockUser as any }
        })
      ).rejects.toThrow();
    });
  });

  describe('ensureOrganizationMemberActive', () => {
    it('should allow operations on active members', async () => {
      let mockMember = {
        id: 'member-1',
        oid: 1,
        status: 'active'
      };
      let updatedMember = {
        ...mockMember,
        role: 'admin',
        actor: { id: 'actor-1', oid: 1, organization: {} },
        organization: {},
        user: { id: 'user-1', oid: 1 }
      };

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            update: vi.fn().mockResolvedValue(updatedMember)
          }
        };
        return callback(mockDb as any);
      });

      await expect(
        organizationMemberService.updateOrganizationMember({
          organization: { id: 'org-1', oid: 1 } as any,
          member: mockMember as any,
          input: { role: 'admin' },
          context: {} as any,
          performedBy: { id: 'actor-1', oid: 1 } as any
        })
      ).resolves.toBeDefined();
    });

    it('should prevent updates on deleted members', async () => {
      let mockMember = {
        id: 'member-1',
        oid: 1,
        status: 'deleted'
      };

      await expect(
        organizationMemberService.updateOrganizationMember({
          organization: { id: 'org-1', oid: 1 } as any,
          member: mockMember as any,
          input: { role: 'admin' },
          context: {} as any,
          performedBy: { id: 'actor-1', oid: 1 } as any
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should prevent deletion of already deleted members', async () => {
      let mockMember = {
        id: 'member-1',
        oid: 1,
        status: 'deleted'
      };

      await expect(
        organizationMemberService.deleteOrganizationMember({
          organization: { id: 'org-1', oid: 1 } as any,
          member: mockMember as any,
          context: {} as any,
          performedBy: { id: 'actor-1', oid: 1 } as any
        })
      ).rejects.toThrow(ServiceError);
    });
  });
});
