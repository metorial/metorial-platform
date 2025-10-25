import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceError, badRequestError, notFoundError } from '@metorial/error';

// Mock external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    organizationInvite: {
      update: vi.fn(),
      findFirst: vi.fn()
    },
    organizationMember: {
      findFirst: vi.fn()
    },
    organizationInviteJoin: {
      create: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn()
  },
  withTransaction: vi.fn((callback) => callback({
    organizationInvite: {
      update: vi.fn(),
      findFirst: vi.fn()
    },
    organizationMember: {
      findFirst: vi.fn()
    },
    organizationInviteJoin: {
      create: vi.fn()
    }
  }))
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    fire: vi.fn()
  }
}));

vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn((name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('../src/services/organizationInvite', () => ({
  organizationInviteService: {
    getOrganizationInviteByKey: vi.fn()
  }
}));

vi.mock('../src/services/organizationMember', () => ({
  organizationMemberService: {
    createOrganizationMember: vi.fn()
  }
}));

import { ID, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { organizationInviteService } from '../src/services/organizationInvite';
import { organizationMemberService } from '../src/services/organizationMember';
import { organizationInviteJoinService } from '../src/services/organizationInviteJoin';

describe('OrganizationInviteJoinService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrganizationInvite', () => {
    it('should return invite when status is pending', async () => {
      let mockInvite = {
        id: 'inv-1',
        oid: 1,
        status: 'pending',
        key: 'invite-key-123',
        type: 'email',
        email: 'user@example.com',
        role: 'member',
        organization: { id: 'org-1', oid: 1, name: 'Test Org' },
        invitedBy: { id: 'actor-1', oid: 1, name: 'Inviter' }
      };

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(mockInvite as any);

      let result = await organizationInviteJoinService.getOrganizationInvite({
        inviteKey: 'invite-key-123'
      });

      expect(result.invite).toEqual(mockInvite);
      expect(organizationInviteService.getOrganizationInviteByKey).toHaveBeenCalledWith({
        key: 'invite-key-123'
      });
    });

    it('should return invite when status is rejected', async () => {
      let mockInvite = {
        id: 'inv-1',
        oid: 1,
        status: 'rejected',
        key: 'invite-key-123',
        type: 'email',
        email: 'user@example.com',
        role: 'member',
        organization: { id: 'org-1', oid: 1 },
        invitedBy: { id: 'actor-1', oid: 1 }
      };

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(mockInvite as any);

      let result = await organizationInviteJoinService.getOrganizationInvite({
        inviteKey: 'invite-key-123'
      });

      expect(result.invite).toEqual(mockInvite);
    });

    it('should throw error when invite status is accepted', async () => {
      let mockInvite = {
        id: 'inv-1',
        oid: 1,
        status: 'accepted',
        key: 'invite-key-123'
      };

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(mockInvite as any);

      await expect(
        organizationInviteJoinService.getOrganizationInvite({
          inviteKey: 'invite-key-123'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw error when invite status is expired', async () => {
      let mockInvite = {
        id: 'inv-1',
        oid: 1,
        status: 'expired',
        key: 'invite-key-123'
      };

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(mockInvite as any);

      await expect(
        organizationInviteJoinService.getOrganizationInvite({
          inviteKey: 'invite-key-123'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw error when invite status is deleted', async () => {
      let mockInvite = {
        id: 'inv-1',
        oid: 1,
        status: 'deleted',
        key: 'invite-key-123'
      };

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(mockInvite as any);

      await expect(
        organizationInviteJoinService.getOrganizationInvite({
          inviteKey: 'invite-key-123'
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('acceptOrganizationInvite', () => {
    let mockUser: any;
    let mockOrg: any;
    let mockInvite: any;
    let mockInvitedBy: any;
    let mockContext: any;

    beforeEach(() => {
      mockUser = { id: 'user-1', oid: 1, name: 'John Doe', email: 'john@example.com' };
      mockOrg = { id: 'org-1', oid: 1, name: 'Test Org' };
      mockInvitedBy = { id: 'actor-1', oid: 1, name: 'Inviter' };
      mockInvite = {
        id: 'inv-1',
        oid: 1,
        status: 'pending',
        key: 'invite-key-123',
        type: 'email',
        email: 'john@example.com',
        role: 'member',
        organization: mockOrg,
        invitedBy: mockInvitedBy
      };
      mockContext = {};
    });

    it('should accept email invite and create new member', async () => {
      let mockMember = {
        id: 'member-1',
        oid: 1,
        userOid: 1,
        organizationOid: 1,
        role: 'member',
        status: 'active',
        actor: { id: 'actor-2', oid: 2 }
      };

      let updatedInvite = {
        ...mockInvite,
        status: 'accepted',
        acceptedAt: new Date(),
        useCount: 1
      };

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(mockInvite);
      vi.mocked(ID.generateId).mockResolvedValue('join-1');

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(null)
          },
          organizationInviteJoin: {
            create: vi.fn().mockResolvedValue({
              id: 'join-1',
              oid: 1,
              inviteOid: 1,
              memberOid: 1
            })
          },
          organizationInvite: {
            update: vi.fn()
              .mockResolvedValueOnce(updatedInvite)
              .mockResolvedValueOnce(updatedInvite)
          }
        };
        return callback(mockDb as any);
      });

      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue(mockMember as any);

      let result = await organizationInviteJoinService.acceptOrganizationInvite({
        user: mockUser,
        inviteKey: 'invite-key-123',
        context: mockContext
      });

      expect(result.organization).toEqual(mockOrg);
      expect(result.member).toEqual(mockMember);
      expect(result.actor).toEqual(mockMember.actor);
      expect(organizationMemberService.createOrganizationMember).toHaveBeenCalledWith({
        user: mockUser,
        organization: mockOrg,
        input: { role: 'member' },
        context: mockContext,
        performedBy: { type: 'actor', actor: mockInvitedBy }
      });
      expect(Fabric.fire).toHaveBeenCalledWith('organization.invitation.accepted:before', expect.any(Object));
      expect(Fabric.fire).toHaveBeenCalledWith('organization.invitation.join.created:before', expect.any(Object));
      expect(Fabric.fire).toHaveBeenCalledWith('organization.invitation.join.created:after', expect.any(Object));
      expect(Fabric.fire).toHaveBeenCalledWith('organization.invitation.accepted:after', expect.any(Object));
    });

    it('should accept link invite and create new member', async () => {
      let linkInvite = {
        ...mockInvite,
        type: 'link',
        email: null
      };

      let mockMember = {
        id: 'member-1',
        oid: 1,
        userOid: 1,
        organizationOid: 1,
        role: 'member',
        status: 'active',
        actor: { id: 'actor-2', oid: 2 }
      };

      let updatedInvite = {
        ...linkInvite,
        useCount: 1
      };

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(linkInvite as any);
      vi.mocked(ID.generateId).mockResolvedValue('join-1');

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(null)
          },
          organizationInviteJoin: {
            create: vi.fn().mockResolvedValue({
              id: 'join-1',
              oid: 1,
              inviteOid: 1,
              memberOid: 1
            })
          },
          organizationInvite: {
            update: vi.fn().mockResolvedValue(updatedInvite)
          }
        };
        return callback(mockDb as any);
      });

      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue(mockMember as any);

      let result = await organizationInviteJoinService.acceptOrganizationInvite({
        user: mockUser,
        inviteKey: 'invite-key-123',
        context: mockContext
      });

      expect(result.member).toEqual(mockMember);
      expect(organizationMemberService.createOrganizationMember).toHaveBeenCalled();
    });

    it('should return existing active member without creating new one', async () => {
      let existingMember = {
        id: 'member-1',
        oid: 1,
        userOid: 1,
        organizationOid: 1,
        role: 'member',
        status: 'active',
        actor: { id: 'actor-2', oid: 2 },
        organization: mockOrg
      };

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(mockInvite);

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(existingMember)
          },
          organizationInviteJoin: {
            create: vi.fn()
          },
          organizationInvite: {
            update: vi.fn()
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationInviteJoinService.acceptOrganizationInvite({
        user: mockUser,
        inviteKey: 'invite-key-123',
        context: mockContext
      });

      expect(result.member).toEqual(existingMember);
      expect(result.actor).toEqual(existingMember.actor);
      expect(result.organization).toEqual(mockOrg);
      expect(organizationMemberService.createOrganizationMember).not.toHaveBeenCalled();
      expect(Fabric.fire).not.toHaveBeenCalled();
    });

    it('should create new member if existing member is not active', async () => {
      let inactiveMember = {
        id: 'member-1',
        oid: 1,
        userOid: 1,
        organizationOid: 1,
        role: 'member',
        status: 'deleted',
        actor: { id: 'actor-2', oid: 2 }
      };

      let mockMember = {
        id: 'member-2',
        oid: 2,
        userOid: 1,
        organizationOid: 1,
        role: 'member',
        status: 'active',
        actor: { id: 'actor-3', oid: 3 }
      };

      let updatedInvite = {
        ...mockInvite,
        status: 'accepted',
        acceptedAt: new Date(),
        useCount: 1
      };

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(mockInvite);
      vi.mocked(ID.generateId).mockResolvedValue('join-1');

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(inactiveMember)
          },
          organizationInviteJoin: {
            create: vi.fn().mockResolvedValue({
              id: 'join-1',
              oid: 1,
              inviteOid: 1,
              memberOid: 2
            })
          },
          organizationInvite: {
            update: vi.fn()
              .mockResolvedValueOnce(updatedInvite)
              .mockResolvedValueOnce(updatedInvite)
          }
        };
        return callback(mockDb as any);
      });

      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue(mockMember as any);

      let result = await organizationInviteJoinService.acceptOrganizationInvite({
        user: mockUser,
        inviteKey: 'invite-key-123',
        context: mockContext
      });

      expect(result.member).toEqual(mockMember);
      expect(organizationMemberService.createOrganizationMember).toHaveBeenCalled();
    });

    it('should throw error when invite status is accepted', async () => {
      let acceptedInvite = {
        ...mockInvite,
        status: 'accepted'
      };

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(acceptedInvite as any);

      await expect(
        organizationInviteJoinService.acceptOrganizationInvite({
          user: mockUser,
          inviteKey: 'invite-key-123',
          context: mockContext
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw error when invite status is expired', async () => {
      let expiredInvite = {
        ...mockInvite,
        status: 'expired'
      };

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(expiredInvite as any);

      await expect(
        organizationInviteJoinService.acceptOrganizationInvite({
          user: mockUser,
          inviteKey: 'invite-key-123',
          context: mockContext
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should update invite status and acceptedAt for email invites', async () => {
      let mockMember = {
        id: 'member-1',
        oid: 1,
        actor: { id: 'actor-2', oid: 2 }
      };

      let updateMock = vi.fn()
        .mockResolvedValueOnce({ ...mockInvite, status: 'accepted', acceptedAt: new Date() })
        .mockResolvedValueOnce({ ...mockInvite, useCount: 1 });

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(mockInvite);
      vi.mocked(ID.generateId).mockResolvedValue('join-1');

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(null)
          },
          organizationInviteJoin: {
            create: vi.fn().mockResolvedValue({
              id: 'join-1',
              oid: 1
            })
          },
          organizationInvite: {
            update: updateMock
          }
        };
        return callback(mockDb as any);
      });

      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue(mockMember as any);

      await organizationInviteJoinService.acceptOrganizationInvite({
        user: mockUser,
        inviteKey: 'invite-key-123',
        context: mockContext
      });

      expect(updateMock).toHaveBeenCalledTimes(2);
      expect(updateMock).toHaveBeenCalledWith({
        where: { oid: 1 },
        data: {
          status: 'accepted',
          acceptedAt: expect.any(Date)
        }
      });
    });

    it('should not update status for link invites', async () => {
      let linkInvite = {
        ...mockInvite,
        type: 'link',
        email: null
      };

      let mockMember = {
        id: 'member-1',
        oid: 1,
        actor: { id: 'actor-2', oid: 2 }
      };

      let updateMock = vi.fn().mockResolvedValue({ ...linkInvite, useCount: 1 });

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(linkInvite as any);
      vi.mocked(ID.generateId).mockResolvedValue('join-1');

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(null)
          },
          organizationInviteJoin: {
            create: vi.fn().mockResolvedValue({
              id: 'join-1',
              oid: 1
            })
          },
          organizationInvite: {
            update: updateMock
          }
        };
        return callback(mockDb as any);
      });

      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue(mockMember as any);

      await organizationInviteJoinService.acceptOrganizationInvite({
        user: mockUser,
        inviteKey: 'invite-key-123',
        context: mockContext
      });

      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(updateMock).toHaveBeenCalledWith({
        where: { oid: 1 },
        data: { useCount: { increment: 1 } },
        include: {
          organization: true,
          invitedBy: true
        }
      });
    });

    it('should increment useCount for all invite types', async () => {
      let mockMember = {
        id: 'member-1',
        oid: 1,
        actor: { id: 'actor-2', oid: 2 }
      };

      let updateMock = vi.fn()
        .mockResolvedValueOnce({ ...mockInvite, status: 'accepted', acceptedAt: new Date() })
        .mockResolvedValueOnce({ ...mockInvite, useCount: 1 });

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(mockInvite);
      vi.mocked(ID.generateId).mockResolvedValue('join-1');

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(null)
          },
          organizationInviteJoin: {
            create: vi.fn().mockResolvedValue({
              id: 'join-1',
              oid: 1
            })
          },
          organizationInvite: {
            update: updateMock
          }
        };
        return callback(mockDb as any);
      });

      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue(mockMember as any);

      await organizationInviteJoinService.acceptOrganizationInvite({
        user: mockUser,
        inviteKey: 'invite-key-123',
        context: mockContext
      });

      expect(updateMock).toHaveBeenCalledWith({
        where: { oid: 1 },
        data: { useCount: { increment: 1 } },
        include: {
          organization: true,
          invitedBy: true
        }
      });
    });

    it('should create organizationInviteJoin record', async () => {
      let mockMember = {
        id: 'member-1',
        oid: 1,
        actor: { id: 'actor-2', oid: 2 }
      };

      let createJoinMock = vi.fn().mockResolvedValue({
        id: 'join-1',
        oid: 1,
        inviteOid: 1,
        memberOid: 1
      });

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(mockInvite);
      vi.mocked(ID.generateId).mockResolvedValue('join-1');

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(null)
          },
          organizationInviteJoin: {
            create: createJoinMock
          },
          organizationInvite: {
            update: vi.fn()
              .mockResolvedValueOnce({ ...mockInvite, status: 'accepted', acceptedAt: new Date() })
              .mockResolvedValueOnce({ ...mockInvite, useCount: 1 })
          }
        };
        return callback(mockDb as any);
      });

      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue(mockMember as any);

      await organizationInviteJoinService.acceptOrganizationInvite({
        user: mockUser,
        inviteKey: 'invite-key-123',
        context: mockContext
      });

      expect(ID.generateId).toHaveBeenCalledWith('organizationInviteJoin');
      expect(createJoinMock).toHaveBeenCalledWith({
        data: {
          id: 'join-1',
          inviteOid: 1,
          memberOid: 1
        }
      });
    });

    it('should accept invite with admin role', async () => {
      let adminInvite = {
        ...mockInvite,
        role: 'admin'
      };

      let mockMember = {
        id: 'member-1',
        oid: 1,
        role: 'admin',
        actor: { id: 'actor-2', oid: 2 }
      };

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(adminInvite as any);
      vi.mocked(ID.generateId).mockResolvedValue('join-1');

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(null)
          },
          organizationInviteJoin: {
            create: vi.fn().mockResolvedValue({
              id: 'join-1',
              oid: 1
            })
          },
          organizationInvite: {
            update: vi.fn()
              .mockResolvedValueOnce({ ...adminInvite, status: 'accepted', acceptedAt: new Date() })
              .mockResolvedValueOnce({ ...adminInvite, useCount: 1 })
          }
        };
        return callback(mockDb as any);
      });

      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue(mockMember as any);

      await organizationInviteJoinService.acceptOrganizationInvite({
        user: mockUser,
        inviteKey: 'invite-key-123',
        context: mockContext
      });

      expect(organizationMemberService.createOrganizationMember).toHaveBeenCalledWith({
        user: mockUser,
        organization: mockOrg,
        input: { role: 'admin' },
        context: mockContext,
        performedBy: { type: 'actor', actor: mockInvitedBy }
      });
    });
  });

  describe('rejectOrganizationInvite', () => {
    let mockUser: any;
    let mockOrg: any;
    let mockInvite: any;
    let mockInvitedBy: any;
    let mockContext: any;

    beforeEach(() => {
      mockUser = { id: 'user-1', oid: 1, name: 'John Doe', email: 'john@example.com' };
      mockOrg = { id: 'org-1', oid: 1, name: 'Test Org' };
      mockInvitedBy = { id: 'actor-1', oid: 1, name: 'Inviter' };
      mockInvite = {
        id: 'inv-1',
        oid: 1,
        status: 'pending',
        key: 'invite-key-123',
        type: 'email',
        email: 'john@example.com',
        role: 'member',
        organization: mockOrg,
        invitedBy: mockInvitedBy
      };
      mockContext = {};
    });

    it('should reject email invite successfully', async () => {
      let rejectedInvite = {
        ...mockInvite,
        status: 'rejected',
        rejectedAt: new Date()
      };

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(mockInvite);

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationInvite: {
            update: vi.fn().mockResolvedValue(rejectedInvite)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationInviteJoinService.rejectOrganizationInvite({
        user: mockUser,
        inviteKey: 'invite-key-123',
        context: mockContext
      });

      expect(result.organization).toEqual(mockOrg);
      expect(result.invite).toEqual(rejectedInvite);
      expect(Fabric.fire).toHaveBeenCalledWith('organization.invitation.rejected:before', expect.objectContaining({
        user: mockUser,
        performedBy: mockInvitedBy,
        organization: mockOrg,
        invite: mockInvite
      }));
      expect(Fabric.fire).toHaveBeenCalledWith('organization.invitation.rejected:after', expect.objectContaining({
        user: mockUser,
        performedBy: mockInvitedBy,
        organization: mockOrg,
        invite: rejectedInvite
      }));
    });

    it('should update invite status to rejected for email invites', async () => {
      let updateMock = vi.fn().mockResolvedValue({
        ...mockInvite,
        status: 'rejected',
        rejectedAt: expect.any(Date)
      });

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(mockInvite);

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationInvite: {
            update: updateMock
          }
        };
        return callback(mockDb as any);
      });

      await organizationInviteJoinService.rejectOrganizationInvite({
        user: mockUser,
        inviteKey: 'invite-key-123',
        context: mockContext
      });

      expect(updateMock).toHaveBeenCalledWith({
        where: { oid: 1 },
        data: {
          status: 'rejected',
          rejectedAt: expect.any(Date)
        },
        include: {
          organization: true,
          invitedBy: true
        }
      });
    });

    it('should not update status for link invites', async () => {
      let linkInvite = {
        ...mockInvite,
        type: 'link',
        email: null
      };

      let updateMock = vi.fn();

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(linkInvite as any);

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationInvite: {
            update: updateMock
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationInviteJoinService.rejectOrganizationInvite({
        user: mockUser,
        inviteKey: 'invite-key-123',
        context: mockContext
      });

      expect(updateMock).not.toHaveBeenCalled();
      expect(result.organization).toEqual(mockOrg);
      expect(result.invite).toEqual(linkInvite);
    });

    it('should allow rejecting already rejected invite', async () => {
      let rejectedInvite = {
        ...mockInvite,
        status: 'rejected',
        rejectedAt: new Date()
      };

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(rejectedInvite as any);

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationInvite: {
            update: vi.fn().mockResolvedValue(rejectedInvite)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationInviteJoinService.rejectOrganizationInvite({
        user: mockUser,
        inviteKey: 'invite-key-123',
        context: mockContext
      });

      expect(result.organization).toEqual(mockOrg);
    });

    it('should throw error when invite status is accepted', async () => {
      let acceptedInvite = {
        ...mockInvite,
        status: 'accepted'
      };

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(acceptedInvite as any);

      await expect(
        organizationInviteJoinService.rejectOrganizationInvite({
          user: mockUser,
          inviteKey: 'invite-key-123',
          context: mockContext
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw error when invite status is expired', async () => {
      let expiredInvite = {
        ...mockInvite,
        status: 'expired'
      };

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(expiredInvite as any);

      await expect(
        organizationInviteJoinService.rejectOrganizationInvite({
          user: mockUser,
          inviteKey: 'invite-key-123',
          context: mockContext
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should fire fabric events in correct order', async () => {
      let mockFireOrder: string[] = [];
      vi.mocked(Fabric.fire).mockImplementation((event: string) => {
        mockFireOrder.push(event);
        return Promise.resolve();
      });

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(mockInvite);

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationInvite: {
            update: vi.fn().mockResolvedValue({
              ...mockInvite,
              status: 'rejected',
              rejectedAt: new Date()
            })
          }
        };
        return callback(mockDb as any);
      });

      await organizationInviteJoinService.rejectOrganizationInvite({
        user: mockUser,
        inviteKey: 'invite-key-123',
        context: mockContext
      });

      expect(mockFireOrder).toEqual([
        'organization.invitation.rejected:before',
        'organization.invitation.rejected:after'
      ]);
    });
  });

  describe('edge cases', () => {
    it('should handle transaction failures in getOrganizationInvite', async () => {
      vi.mocked(withTransaction).mockRejectedValue(new Error('Transaction failed'));

      await expect(
        organizationInviteJoinService.getOrganizationInvite({
          inviteKey: 'invite-key-123'
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('should handle transaction failures in acceptOrganizationInvite', async () => {
      vi.mocked(withTransaction).mockRejectedValue(new Error('Transaction failed'));

      await expect(
        organizationInviteJoinService.acceptOrganizationInvite({
          user: { id: 'user-1', oid: 1 } as any,
          inviteKey: 'invite-key-123',
          context: {} as any
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('should handle transaction failures in rejectOrganizationInvite', async () => {
      vi.mocked(withTransaction).mockRejectedValue(new Error('Transaction failed'));

      await expect(
        organizationInviteJoinService.rejectOrganizationInvite({
          user: { id: 'user-1', oid: 1 } as any,
          inviteKey: 'invite-key-123',
          context: {} as any
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('should handle invalid invite key in getOrganizationInvite', async () => {
      let error = new ServiceError(notFoundError('organization_invite', null));
      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockRejectedValue(error);

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockRejectedValue(error);
        return callback({} as any);
      });

      await expect(
        organizationInviteJoinService.getOrganizationInvite({
          inviteKey: 'invalid-key'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should handle invalid invite key in acceptOrganizationInvite', async () => {
      let error = new ServiceError(notFoundError('organization_invite', null));
      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockRejectedValue(error);

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockRejectedValue(error);
        return callback({} as any);
      });

      await expect(
        organizationInviteJoinService.acceptOrganizationInvite({
          user: { id: 'user-1', oid: 1 } as any,
          inviteKey: 'invalid-key',
          context: {} as any
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should handle invalid invite key in rejectOrganizationInvite', async () => {
      let error = new ServiceError(notFoundError('organization_invite', null));
      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockRejectedValue(error);

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockRejectedValue(error);
        return callback({} as any);
      });

      await expect(
        organizationInviteJoinService.rejectOrganizationInvite({
          user: { id: 'user-1', oid: 1 } as any,
          inviteKey: 'invalid-key',
          context: {} as any
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should preserve invite data through accept flow', async () => {
      let mockInvite = {
        id: 'inv-1',
        oid: 1,
        status: 'pending',
        key: 'invite-key-123',
        type: 'email',
        email: 'user@example.com',
        role: 'member',
        message: 'Welcome to our organization!',
        organization: { id: 'org-1', oid: 1, name: 'Test Org' },
        invitedBy: { id: 'actor-1', oid: 1, name: 'Inviter' }
      };

      let mockMember = {
        id: 'member-1',
        oid: 1,
        actor: { id: 'actor-2', oid: 2 }
      };

      vi.mocked(organizationInviteService.getOrganizationInviteByKey).mockResolvedValue(mockInvite as any);
      vi.mocked(ID.generateId).mockResolvedValue('join-1');

      vi.mocked(withTransaction).mockImplementation(async (callback) => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(null)
          },
          organizationInviteJoin: {
            create: vi.fn().mockResolvedValue({ id: 'join-1', oid: 1 })
          },
          organizationInvite: {
            update: vi.fn()
              .mockResolvedValueOnce({ ...mockInvite, status: 'accepted', acceptedAt: new Date() })
              .mockResolvedValueOnce({ ...mockInvite, useCount: 1 })
          }
        };
        return callback(mockDb as any);
      });

      vi.mocked(organizationMemberService.createOrganizationMember).mockResolvedValue(mockMember as any);

      let result = await organizationInviteJoinService.acceptOrganizationInvite({
        user: { id: 'user-1', oid: 1 } as any,
        inviteKey: 'invite-key-123',
        context: {} as any
      });

      expect(result.invite).toBeDefined();
      expect(result.organization).toBeDefined();
      expect(result.member).toBeDefined();
      expect(result.actor).toBeDefined();
    });
  });
});
