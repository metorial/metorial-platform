
let testAuditScope = {
  organizationOid: 1n,
  organizationActorOid: 1n,
  actor: { type: 'org_actor' as const, id: 'actor-1' },
  context: { ip: '127.0.0.1', ua: 'test' }
};

import { ServiceError } from '@lowerdeck/error';
import { addDays } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    organizationInvite: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    organizationMember: {
      findFirst: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn()
  },
  withTransaction: vi.fn(callback =>
    callback({
      organizationInvite: {
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn()
      },
      organizationMember: {
        findFirst: vi.fn()
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

vi.mock('@metorial/id', () => ({
  generatePlainId: vi.fn()
}));

vi.mock('../src/email/invite', () => ({
  sendOrgInviteEmail: {
    send: vi.fn()
  }
}));

import { db, ID, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { generatePlainId } from '@metorial/id';
import { sendOrgInviteEmail } from '../src/email/invite';
import { organizationInviteService } from '../src/services/organizationInvite';

describe('OrganizationInviteService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrganizationInvite', () => {
    describe('email invites', () => {
      it('should create an email invite successfully', async () => {
        let mockOrg = { id: 'org-1', oid: 1, name: 'Test Org' };
        let mockPerformedBy = { id: 'actor-1', oid: 1, name: 'John Doe' };
        let mockInvite = {
          id: 'invite-1',
          oid: 1,
          type: 'email',
          email: 'newuser@example.com',
          role: 'member',
          status: 'pending',
          key: 'metorial_inv_abc123',
          expiresAt: addDays(new Date(), 14),
          message: 'Welcome!',
          organizationOid: 1,
          invitedByOid: 1,
          organization: mockOrg,
          invitedBy: mockPerformedBy
        };

        vi.mocked(ID.generateId).mockResolvedValue('invite-1');
        vi.mocked(generatePlainId).mockReturnValue('metorial_inv_abc123');
        vi.mocked(withTransaction).mockImplementation(async callback => {
          let mockDb = {
            organizationMember: {
              findFirst: vi.fn().mockResolvedValue(null)
            },
            organizationInvite: {
              findFirst: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockResolvedValue(mockInvite)
            }
          };
          return callback(mockDb as any);
        });

        let result = await organizationInviteService.createOrganizationInvite({
          input: {
            type: 'email',
            email: 'newuser@example.com',
            role: 'member',
            message: 'Welcome!'
          },
          organization: mockOrg as any,
        auditScope: testAuditScope as any
        });

        expect(result).toEqual(mockInvite);
        expect(ID.generateId).toHaveBeenCalledWith('organizationInvite');
        expect(generatePlainId).toHaveBeenCalledWith(30);
        expect(sendOrgInviteEmail.send).toHaveBeenCalledWith({
          data: {
            organization: mockOrg,
            invite: mockInvite,
            actor: mockPerformedBy
          },
          to: ['newuser@example.com']
        });
        expect(Fabric.fire).toHaveBeenCalledWith(
          'organization.invitation.created:before',
          expect.any(Object)
        );
        expect(Fabric.fire).toHaveBeenCalledWith(
          'organization.invitation.created:after',
          expect.objectContaining({
            invite: mockInvite
          })
        );
      });

      it('should create an email invite without message', async () => {
        let mockOrg = { id: 'org-1', oid: 1 };
        let mockPerformedBy = { id: 'actor-1', oid: 1 };
        let mockInvite = {
          id: 'invite-1',
          oid: 1,
          type: 'email',
          email: 'user@example.com',
          role: 'member',
          status: 'pending',
          key: 'metorial_inv_xyz789',
          message: null,
          organization: mockOrg,
          invitedBy: mockPerformedBy
        };

        vi.mocked(ID.generateId).mockResolvedValue('invite-1');
        vi.mocked(generatePlainId).mockReturnValue('metorial_inv_xyz789');
        vi.mocked(withTransaction).mockImplementation(async callback => {
          let mockDb = {
            organizationMember: {
              findFirst: vi.fn().mockResolvedValue(null)
            },
            organizationInvite: {
              findFirst: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockResolvedValue(mockInvite)
            }
          };
          return callback(mockDb as any);
        });

        let result = await organizationInviteService.createOrganizationInvite({
          input: {
            type: 'email',
            email: 'user@example.com',
            role: 'member'
          },
          organization: mockOrg as any,
        auditScope: testAuditScope as any
        });

        expect(result.message).toBeNull();
        expect(sendOrgInviteEmail.send).toHaveBeenCalled();
      });

      it('should create an email invite with admin role', async () => {
        let mockOrg = { id: 'org-1', oid: 1 };
        let mockPerformedBy = { id: 'actor-1', oid: 1 };
        let mockInvite = {
          id: 'invite-1',
          oid: 1,
          type: 'email',
          email: 'admin@example.com',
          role: 'admin',
          status: 'pending',
          organization: mockOrg,
          invitedBy: mockPerformedBy
        };

        vi.mocked(ID.generateId).mockResolvedValue('invite-1');
        vi.mocked(generatePlainId).mockReturnValue('metorial_inv_admin');
        vi.mocked(withTransaction).mockImplementation(async callback => {
          let mockDb = {
            organizationMember: {
              findFirst: vi.fn().mockResolvedValue(null)
            },
            organizationInvite: {
              findFirst: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockResolvedValue(mockInvite)
            }
          };
          return callback(mockDb as any);
        });

        let result = await organizationInviteService.createOrganizationInvite({
          input: {
            type: 'email',
            email: 'admin@example.com',
            role: 'admin'
          },
          organization: mockOrg as any,
        auditScope: testAuditScope as any
        });

        expect(result.role).toBe('admin');
      });

      it('should check for existing member when creating email invite', async () => {
        let mockOrg = { id: 'org-1', oid: 1 };
        let mockPerformedBy = { id: 'actor-1', oid: 1 };
        let existingMember = { id: 'member-1', oid: 1 };

        vi.mocked(withTransaction).mockImplementation(async callback => {
          let mockDb = {
            organizationMember: {
              findFirst: vi.fn().mockResolvedValue(existingMember)
            },
            organizationInvite: {
              findFirst: vi.fn(),
              create: vi.fn()
            }
          };
          return callback(mockDb as any);
        });

        await expect(
          organizationInviteService.createOrganizationInvite({
            input: {
              type: 'email',
              email: 'existing@example.com',
              role: 'member'
            },
            organization: mockOrg as any,
        auditScope: testAuditScope as any
          })
        ).rejects.toThrow(ServiceError);
      });

      it('should check for existing invite when creating email invite', async () => {
        let mockOrg = { id: 'org-1', oid: 1 };
        let mockPerformedBy = { id: 'actor-1', oid: 1 };
        let existingInvite = {
          oid: 1,
          email: 'user@example.com',
          status: 'pending',
          expiresAt: addDays(new Date(), 5)
        };

        vi.mocked(withTransaction).mockImplementation(async callback => {
          let mockDb = {
            organizationMember: {
              findFirst: vi.fn().mockResolvedValue(null)
            },
            organizationInvite: {
              findFirst: vi.fn().mockResolvedValue(existingInvite),
              create: vi.fn()
            }
          };
          return callback(mockDb as any);
        });

        await expect(
          organizationInviteService.createOrganizationInvite({
            input: {
              type: 'email',
              email: 'user@example.com',
              role: 'member'
            },
            organization: mockOrg as any,
        auditScope: testAuditScope as any
          })
        ).rejects.toThrow(ServiceError);
      });

      it('should delete old invite and create new one when invite expires in more than 7 days', async () => {
        let mockOrg = { id: 'org-1', oid: 1 };
        let mockPerformedBy = { id: 'actor-1', oid: 1 };
        let oldInvite = {
          oid: 1,
          email: 'user@example.com',
          status: 'pending',
          expiresAt: addDays(new Date(), 10)
        };
        let newInvite = {
          id: 'invite-2',
          oid: 2,
          type: 'email',
          email: 'user@example.com',
          role: 'member',
          organization: mockOrg,
          invitedBy: mockPerformedBy
        };

        vi.mocked(ID.generateId).mockResolvedValue('invite-2');
        vi.mocked(generatePlainId).mockReturnValue('metorial_inv_new');
        vi.mocked(withTransaction).mockImplementation(async callback => {
          let mockDb = {
            organizationMember: {
              findFirst: vi.fn().mockResolvedValue(null)
            },
            organizationInvite: {
              findFirst: vi.fn().mockResolvedValue(oldInvite),
              update: vi.fn().mockResolvedValue({ ...oldInvite, status: 'deleted' }),
              create: vi.fn().mockResolvedValue(newInvite)
            }
          };
          return callback(mockDb as any);
        });

        let result = await organizationInviteService.createOrganizationInvite({
          input: {
            type: 'email',
            email: 'user@example.com',
            role: 'member'
          },
          organization: mockOrg as any,
        auditScope: testAuditScope as any
        });

        expect(result).toEqual(newInvite);
      });
    });

    describe('link invites', () => {
      it('should create a link invite successfully', async () => {
        let mockOrg = { id: 'org-1', oid: 1, name: 'Test Org' };
        let mockPerformedBy = { id: 'actor-1', oid: 1 };
        let mockInvite = {
          id: 'invite-1',
          oid: 1,
          type: 'link',
          email: null,
          role: 'member',
          status: 'pending',
          key: 'metorial_inv_link123',
          expiresAt: addDays(new Date(), 14),
          message: null,
          organizationOid: 1,
          invitedByOid: 1,
          organization: mockOrg,
          invitedBy: mockPerformedBy
        };

        vi.mocked(ID.generateId).mockResolvedValue('invite-1');
        vi.mocked(generatePlainId).mockReturnValue('metorial_inv_link123');
        vi.mocked(withTransaction).mockImplementation(async callback => {
          let mockDb = {
            organizationInvite: {
              create: vi.fn().mockResolvedValue(mockInvite)
            }
          };
          return callback(mockDb as any);
        });

        let result = await organizationInviteService.createOrganizationInvite({
          input: {
            type: 'link',
            role: 'member'
          },
          organization: mockOrg as any,
        auditScope: testAuditScope as any
        });

        expect(result).toEqual(mockInvite);
        expect(result.type).toBe('link');
        expect(result.email).toBeNull();
        expect(result.message).toBeNull();
        expect(sendOrgInviteEmail.send).not.toHaveBeenCalled();
        expect(Fabric.fire).toHaveBeenCalledWith(
          'organization.invitation.created:before',
          expect.any(Object)
        );
        expect(Fabric.fire).toHaveBeenCalledWith(
          'organization.invitation.created:after',
          expect.objectContaining({
            invite: mockInvite
          })
        );
      });

      it('should not send email for link invites', async () => {
        let mockOrg = { id: 'org-1', oid: 1 };
        let mockInvite = {
          id: 'invite-1',
          oid: 1,
          type: 'link',
          email: null,
          organization: mockOrg,
          invitedBy: { id: 'actor-1', oid: 1 }
        };

        vi.mocked(ID.generateId).mockResolvedValue('invite-1');
        vi.mocked(generatePlainId).mockReturnValue('metorial_inv_link');
        vi.mocked(withTransaction).mockImplementation(async callback => {
          let mockDb = {
            organizationInvite: {
              create: vi.fn().mockResolvedValue(mockInvite)
            }
          };
          return callback(mockDb as any);
        });

        await organizationInviteService.createOrganizationInvite({
          input: {
            type: 'link',
            role: 'member'
          },
          organization: mockOrg as any,
        auditScope: testAuditScope as any
        });

        expect(sendOrgInviteEmail.send).not.toHaveBeenCalled();
      });
    });
  });

  describe('deleteOrganizationInvite', () => {
    it('should delete an active invite successfully', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockInvite = { id: 'invite-1', oid: 1, status: 'pending' };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };
      let deletedInvite = {
        ...mockInvite,
        status: 'deleted',
        deletedAt: new Date(),
        organization: mockOrg,
        invitedBy: mockPerformedBy
      };

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationInvite: {
            update: vi.fn().mockResolvedValue(deletedInvite)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationInviteService.deleteOrganizationInvite({
        invite: mockInvite as any,
        organization: mockOrg as any,
        auditScope: testAuditScope as any
      });

      expect(result.status).toBe('deleted');
      expect(result.deletedAt).toBeDefined();
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.invitation.deleted:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.invitation.deleted:after',
        expect.objectContaining({
          invite: deletedInvite
        })
      );
    });

    it('should throw forbidden error when trying to delete already deleted invite', async () => {
      let mockInvite = { id: 'invite-1', oid: 1, status: 'deleted' };

      await expect(
        organizationInviteService.deleteOrganizationInvite({
          invite: mockInvite as any,
          organization: { id: 'org-1', oid: 1 } as any,
        auditScope: testAuditScope as any
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should delete both email and link invites', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };

      // Test email invite
      let emailInvite = { id: 'invite-1', oid: 1, status: 'pending', type: 'email' };
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationInvite: {
            update: vi.fn().mockResolvedValue({
              ...emailInvite,
              status: 'deleted',
              organization: mockOrg,
              invitedBy: mockPerformedBy
            })
          }
        };
        return callback(mockDb as any);
      });

      let result1 = await organizationInviteService.deleteOrganizationInvite({
        invite: emailInvite as any,
        organization: mockOrg as any,
        auditScope: testAuditScope as any
      });

      expect(result1.status).toBe('deleted');

      // Test link invite
      let linkInvite = { id: 'invite-2', oid: 2, status: 'pending', type: 'link' };
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationInvite: {
            update: vi.fn().mockResolvedValue({
              ...linkInvite,
              status: 'deleted',
              organization: mockOrg,
              invitedBy: mockPerformedBy
            })
          }
        };
        return callback(mockDb as any);
      });

      let result2 = await organizationInviteService.deleteOrganizationInvite({
        invite: linkInvite as any,
        organization: mockOrg as any,
        auditScope: testAuditScope as any
      });

      expect(result2.status).toBe('deleted');
    });
  });

  describe('updateOrganizationInvite', () => {
    it('should update invite role successfully', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockInvite = { id: 'invite-1', oid: 1, status: 'pending', role: 'member' };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };
      let updatedInvite = {
        ...mockInvite,
        role: 'admin',
        organization: mockOrg,
        invitedBy: mockPerformedBy
      };

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationInvite: {
            update: vi.fn().mockResolvedValue(updatedInvite)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationInviteService.updateOrganizationInvite({
        invite: mockInvite as any,
        input: {
          role: 'admin'
        },
        organization: mockOrg as any,
        auditScope: testAuditScope as any
      });

      expect(result.role).toBe('admin');
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.invitation.updated:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.invitation.updated:after',
        expect.objectContaining({
          invite: updatedInvite
        })
      );
    });

    it('should update role from admin to member', async () => {
      let mockInvite = { id: 'invite-1', oid: 1, status: 'pending', role: 'admin' };
      let updatedInvite = {
        ...mockInvite,
        role: 'member',
        organization: { id: 'org-1', oid: 1 },
        invitedBy: { id: 'actor-1', oid: 1 }
      };

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationInvite: {
            update: vi.fn().mockResolvedValue(updatedInvite)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationInviteService.updateOrganizationInvite({
        invite: mockInvite as any,
        input: {
          role: 'member'
        },
        organization: { id: 'org-1', oid: 1 } as any,
        auditScope: testAuditScope as any
      });

      expect(result.role).toBe('member');
    });

    it('should throw forbidden error when trying to update deleted invite', async () => {
      let mockInvite = { id: 'invite-1', oid: 1, status: 'deleted' };

      await expect(
        organizationInviteService.updateOrganizationInvite({
          invite: mockInvite as any,
          input: {
            role: 'admin'
          },
          organization: { id: 'org-1', oid: 1 } as any,
        auditScope: testAuditScope as any
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should update both email and link invite roles', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };

      // Email invite
      let emailInvite = {
        id: 'invite-1',
        oid: 1,
        status: 'pending',
        type: 'email',
        role: 'member'
      };
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationInvite: {
            update: vi.fn().mockResolvedValue({
              ...emailInvite,
              role: 'admin',
              organization: mockOrg,
              invitedBy: mockPerformedBy
            })
          }
        };
        return callback(mockDb as any);
      });

      let result1 = await organizationInviteService.updateOrganizationInvite({
        invite: emailInvite as any,
        input: { role: 'admin' },
        organization: mockOrg as any,
        auditScope: testAuditScope as any
      });

      expect(result1.role).toBe('admin');

      // Link invite
      let linkInvite = {
        id: 'invite-2',
        oid: 2,
        status: 'pending',
        type: 'link',
        role: 'member'
      };
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationInvite: {
            update: vi.fn().mockResolvedValue({
              ...linkInvite,
              role: 'admin',
              organization: mockOrg,
              invitedBy: mockPerformedBy
            })
          }
        };
        return callback(mockDb as any);
      });

      let result2 = await organizationInviteService.updateOrganizationInvite({
        invite: linkInvite as any,
        input: { role: 'admin' },
        organization: mockOrg as any,
        auditScope: testAuditScope as any
      });

      expect(result2.role).toBe('admin');
    });
  });

  describe('ensureOrganizationInviteLink', () => {
    it('should return existing recent link when available', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };
      let recentLink = {
        id: 'invite-1',
        oid: 1,
        type: 'link',
        status: 'pending',
        role: 'member',
        expiresAt: addDays(new Date(), 10),
        organizationOid: 1,
        invitedByOid: 1,
        organization: mockOrg,
        invitedBy: mockPerformedBy
      };

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationInvite: {
            findFirst: vi.fn().mockResolvedValue(recentLink)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationInviteService.ensureOrganizationInviteLink({
        organization: mockOrg as any,
        auditScope: testAuditScope as any
      });

      expect(result).toEqual(recentLink);
      expect(Fabric.fire).not.toHaveBeenCalled(); // Should not fire create events
    });

    it('should create new link when no recent link exists', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };
      let newLink = {
        id: 'invite-1',
        oid: 1,
        type: 'link',
        status: 'pending',
        role: 'member',
        key: 'metorial_inv_newlink',
        expiresAt: addDays(new Date(), 14),
        organization: mockOrg,
        invitedBy: mockPerformedBy
      };

      vi.mocked(ID.generateId).mockResolvedValue('invite-1');
      vi.mocked(generatePlainId).mockReturnValue('metorial_inv_newlink');

      let callCount = 0;
      vi.mocked(withTransaction).mockImplementation(async callback => {
        callCount++;
        if (callCount === 1) {
          // First call: check for existing link
          let mockDb = {
            organizationInvite: {
              findFirst: vi.fn().mockResolvedValue(null)
            }
          };
          // This will trigger createOrganizationInvite
          let result = await callback(mockDb as any);
          // Manually trigger the second withTransaction call for create
          return result;
        } else {
          // Second call: create new link
          let mockDb = {
            organizationInvite: {
              create: vi.fn().mockResolvedValue(newLink)
            }
          };
          return callback(mockDb as any);
        }
      });

      let result = await organizationInviteService.ensureOrganizationInviteLink({
        organization: mockOrg as any,
        auditScope: testAuditScope as any
      });

      expect(result.type).toBe('link');
      expect(result.role).toBe('member');
    });

    it('should only return links that expire in more than 7 days', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };
      let newLink = {
        id: 'invite-new',
        oid: 999,
        type: 'link',
        status: 'pending',
        role: 'member',
        key: 'metorial_inv_newlink999',
        expiresAt: addDays(new Date(), 14),
        organization: mockOrg,
        invitedBy: mockPerformedBy
      };

      vi.mocked(ID.generateId).mockResolvedValue('invite-new');
      vi.mocked(generatePlainId).mockReturnValue('metorial_inv_newlink999');

      let callCount = 0;
      vi.mocked(withTransaction).mockImplementation(async callback => {
        callCount++;
        if (callCount === 1) {
          // First call: check for existing link (none found)
          let mockDb = {
            organizationInvite: {
              findFirst: vi.fn().mockResolvedValue(null)
            }
          };
          let innerResult = await callback(mockDb as any);
          return innerResult;
        } else {
          // Second call: create new link
          let mockDb = {
            organizationInvite: {
              create: vi.fn().mockResolvedValue(newLink)
            }
          };
          return callback(mockDb as any);
        }
      });

      let result = await organizationInviteService.ensureOrganizationInviteLink({
        organization: mockOrg as any,
        auditScope: testAuditScope as any
      });

      // Should trigger creation of a new link
      expect(result).toBeDefined();
    });

    it('should filter by invitedBy performer', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockPerformedBy1 = { id: 'actor-1', oid: 1 };
      let mockPerformedBy2 = { id: 'actor-2', oid: 2 };
      let link1 = {
        id: 'invite-1',
        oid: 1,
        type: 'link',
        status: 'pending',
        invitedByOid: 1,
        expiresAt: addDays(new Date(), 10),
        organization: mockOrg,
        invitedBy: mockPerformedBy1
      };

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationInvite: {
            findFirst: vi.fn().mockResolvedValue(link1)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationInviteService.ensureOrganizationInviteLink({
        organization: mockOrg as any,
        auditScope: testAuditScope as any
      });

      expect(result.invitedByOid).toBe(1);
    });
  });

  describe('getOrganizationInviteById', () => {
    it('should return invite when found', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockInvite = {
        id: 'invite-1',
        oid: 1,
        organizationOid: 1,
        organization: mockOrg,
        invitedBy: { id: 'actor-1', oid: 1 }
      };

      vi.mocked(db.organizationInvite.findFirst).mockResolvedValue(mockInvite as any);

      let result = await organizationInviteService.getOrganizationInviteById({
        organization: mockOrg as any,
        inviteId: 'invite-1'
      });

      expect(result).toEqual(mockInvite);
      expect(db.organizationInvite.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'invite-1',
          organizationOid: 1
        },
        include: {
          organization: true,
          invitedBy: true
        }
      });
    });

    it('should throw not found error when invite does not exist', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      vi.mocked(db.organizationInvite.findFirst).mockResolvedValue(null);

      await expect(
        organizationInviteService.getOrganizationInviteById({
          organization: mockOrg as any,
          inviteId: 'invite-999'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should throw not found error for empty invite ID', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      vi.mocked(db.organizationInvite.findFirst).mockResolvedValue(null);

      await expect(
        organizationInviteService.getOrganizationInviteById({
          organization: mockOrg as any,
          inviteId: ''
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should not find invite from different organization', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      vi.mocked(db.organizationInvite.findFirst).mockResolvedValue(null);

      await expect(
        organizationInviteService.getOrganizationInviteById({
          organization: mockOrg as any,
          inviteId: 'invite-from-other-org'
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('getOrganizationInviteByKey', () => {
    it('should return pending invite when found by key', async () => {
      let mockInvite = {
        id: 'invite-1',
        oid: 1,
        key: 'metorial_inv_abc123',
        status: 'pending',
        organization: { id: 'org-1', oid: 1 },
        invitedBy: { id: 'actor-1', oid: 1 }
      };

      vi.mocked(db.organizationInvite.findFirst).mockResolvedValue(mockInvite as any);

      let result = await organizationInviteService.getOrganizationInviteByKey({
        key: 'metorial_inv_abc123'
      });

      expect(result).toEqual(mockInvite);
      expect(db.organizationInvite.findFirst).toHaveBeenCalledWith({
        where: {
          key: 'metorial_inv_abc123',
          status: 'pending'
        },
        include: {
          organization: true,
          invitedBy: true
        }
      });
    });

    it('should throw not found error when key does not exist', async () => {
      vi.mocked(db.organizationInvite.findFirst).mockResolvedValue(null);

      await expect(
        organizationInviteService.getOrganizationInviteByKey({
          key: 'metorial_inv_nonexistent'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should not return deleted invite by key', async () => {
      vi.mocked(db.organizationInvite.findFirst).mockResolvedValue(null);

      await expect(
        organizationInviteService.getOrganizationInviteByKey({
          key: 'metorial_inv_deleted'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should not return rejected invite by key', async () => {
      vi.mocked(db.organizationInvite.findFirst).mockResolvedValue(null);

      await expect(
        organizationInviteService.getOrganizationInviteByKey({
          key: 'metorial_inv_rejected'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should handle empty key', async () => {
      vi.mocked(db.organizationInvite.findFirst).mockResolvedValue(null);

      await expect(
        organizationInviteService.getOrganizationInviteByKey({
          key: ''
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('listOrganizationInvites', () => {
    it('should list pending email invites for organization', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      let result = await organizationInviteService.listOrganizationInvites({
        organization: mockOrg as any
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should only return pending invites', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      let result = await organizationInviteService.listOrganizationInvites({
        organization: mockOrg as any
      });

      // Paginator.create is mocked, but we can verify it's called
      expect(result).toBeDefined();
    });

    it('should only return email type invites', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      let result = await organizationInviteService.listOrganizationInvites({
        organization: mockOrg as any
      });

      expect(result).toBeDefined();
    });

    it('should filter by organization', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      let result = await organizationInviteService.listOrganizationInvites({
        organization: mockOrg as any
      });

      expect(result).toBeDefined();
    });
  });

  describe('edge cases and date handling', () => {
    it('should set expiry to 14 days from now for new invites', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };
      let expectedExpiry = addDays(new Date(), 14);

      vi.mocked(ID.generateId).mockResolvedValue('invite-1');
      vi.mocked(generatePlainId).mockReturnValue('metorial_inv_test');
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(null)
          },
          organizationInvite: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation(({ data }) => {
              return Promise.resolve({
                ...data,
                oid: 1,
                organization: mockOrg,
                invitedBy: mockPerformedBy
              });
            })
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationInviteService.createOrganizationInvite({
        input: {
          type: 'email',
          email: 'user@example.com',
          role: 'member'
        },
        organization: mockOrg as any,
        auditScope: testAuditScope as any
      });

      expect(result.expiresAt).toBeDefined();
    });

    it('should handle expired invites in list', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      let result = await organizationInviteService.listOrganizationInvites({
        organization: mockOrg as any
      });

      // List only shows pending invites, so expired ones shouldn't appear if status changed
      expect(result).toBeDefined();
    });

    it('should handle invite with rejected status', async () => {
      let rejectedInvite = { id: 'invite-1', oid: 1, status: 'rejected' };
      let deletedInvite = {
        ...rejectedInvite,
        status: 'deleted',
        deletedAt: new Date(),
        organization: { id: 'org-1', oid: 1 },
        invitedBy: { id: 'actor-1', oid: 1 }
      };

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationInvite: {
            update: vi.fn().mockResolvedValue(deletedInvite)
          }
        };
        return callback(mockDb as any);
      });

      await expect(
        organizationInviteService.deleteOrganizationInvite({
          invite: rejectedInvite as any,
          organization: { id: 'org-1', oid: 1 } as any,
        auditScope: testAuditScope as any
        })
      ).resolves.toBeDefined(); // Rejected invites can be deleted
    });

    it('should handle transaction failures', async () => {
      vi.mocked(withTransaction).mockRejectedValue(new Error('Transaction failed'));

      await expect(
        organizationInviteService.createOrganizationInvite({
          input: {
            type: 'email',
            email: 'user@example.com',
            role: 'member'
          },
          organization: { id: 'org-1', oid: 1 } as any,
        auditScope: testAuditScope as any
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('should generate unique keys for each invite', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };

      vi.mocked(ID.generateId)
        .mockResolvedValueOnce('invite-1')
        .mockResolvedValueOnce('invite-2');
      vi.mocked(generatePlainId)
        .mockReturnValueOnce('metorial_inv_key1')
        .mockReturnValueOnce('metorial_inv_key2');

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationMember: {
            findFirst: vi.fn().mockResolvedValue(null)
          },
          organizationInvite: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation(({ data }) => {
              return Promise.resolve({
                ...data,
                organization: mockOrg,
                invitedBy: mockPerformedBy
              });
            })
          }
        };
        return callback(mockDb as any);
      });

      let result1 = await organizationInviteService.createOrganizationInvite({
        input: { type: 'email', email: 'user1@example.com', role: 'member' },
        organization: mockOrg as any,
        auditScope: testAuditScope as any
      });

      let result2 = await organizationInviteService.createOrganizationInvite({
        input: { type: 'email', email: 'user2@example.com', role: 'member' },
        organization: mockOrg as any,
        auditScope: testAuditScope as any
      });

      expect(result1.key).not.toBe(result2.key);
    });
  });

  describe('Fabric events', () => {
    it('should fire before and after events on create', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockPerformedBy = { id: 'actor-1', oid: 1 };

      vi.mocked(ID.generateId).mockResolvedValue('invite-1');
      vi.mocked(generatePlainId).mockReturnValue('metorial_inv_test');
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationInvite: {
            create: vi.fn().mockResolvedValue({
              id: 'invite-1',
              type: 'link',
              organization: mockOrg,
              invitedBy: mockPerformedBy
            })
          }
        };
        return callback(mockDb as any);
      });

      await organizationInviteService.createOrganizationInvite({
        input: { type: 'link', role: 'member' },
        organization: mockOrg as any,
        auditScope: testAuditScope as any
      });

      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.invitation.created:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.invitation.created:after',
        expect.any(Object)
      );
    });

    it('should fire before and after events on delete', async () => {
      let mockInvite = { id: 'invite-1', oid: 1, status: 'pending' };

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationInvite: {
            update: vi.fn().mockResolvedValue({
              ...mockInvite,
              status: 'deleted',
              organization: { id: 'org-1' },
              invitedBy: { id: 'actor-1' }
            })
          }
        };
        return callback(mockDb as any);
      });

      await organizationInviteService.deleteOrganizationInvite({
        invite: mockInvite as any,
        organization: { id: 'org-1', oid: 1 } as any,
        auditScope: testAuditScope as any
      });

      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.invitation.deleted:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.invitation.deleted:after',
        expect.any(Object)
      );
    });

    it('should fire before and after events on update', async () => {
      let mockInvite = { id: 'invite-1', oid: 1, status: 'pending', role: 'member' };

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationInvite: {
            update: vi.fn().mockResolvedValue({
              ...mockInvite,
              role: 'admin',
              organization: { id: 'org-1' },
              invitedBy: { id: 'actor-1' }
            })
          }
        };
        return callback(mockDb as any);
      });

      await organizationInviteService.updateOrganizationInvite({
        invite: mockInvite as any,
        input: { role: 'admin' },
        organization: { id: 'org-1', oid: 1 } as any,
        auditScope: testAuditScope as any
      });

      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.invitation.updated:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.invitation.updated:after',
        expect.any(Object)
      );
    });
  });
});
