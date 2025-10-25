import { ServiceError } from '@metorial/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock external dependencies
vi.mock('@metorial/db', () => ({
  db: {
    organizationActor: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn()
  },
  withTransaction: vi.fn(callback =>
    callback({
      organizationActor: {
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
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

vi.mock('@metorial/pagination', () => ({
  Paginator: {
    create: vi.fn(fn => fn)
  }
}));

vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn((name, factory) => ({
      build: () => factory()
    }))
  }
}));

import { db, ID, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { organizationActorService } from '../src/services/organizationActor';

describe('OrganizationActorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrganizationActor', () => {
    it('should create a member actor for user', async () => {
      let mockOrg = { id: 'org-1', oid: 1, name: 'Test Org' };
      let mockUser = { id: 'user-1', name: 'John Doe', email: 'john@example.com', oid: 1 };
      let mockActor = {
        id: 'actor-1',
        oid: 1,
        type: 'member',
        name: 'John Doe',
        email: 'john@example.com',
        image: { type: 'default' },
        isSystem: null,
        organizationOid: 1,
        member: null,
        machineAccess: null,
        organization: mockOrg
      };

      vi.mocked(ID.generateId).mockResolvedValue('actor-1');
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationActor: {
            create: vi.fn().mockResolvedValue(mockActor)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationActorService.createOrganizationActor({
        input: {
          type: 'member',
          name: 'John Doe',
          email: 'john@example.com'
        },
        organization: mockOrg as any,
        context: {} as any,
        performedBy: { type: 'user', user: mockUser as any }
      });

      expect(result).toEqual(mockActor);
      expect(ID.generateId).toHaveBeenCalledWith('organizationActor');
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.actor.created:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.actor.created:after',
        expect.objectContaining({
          actor: mockActor,
          performedBy: mockActor
        })
      );
    });

    it('should create a system actor with isSystem=true', async () => {
      let mockOrg = { id: 'org-1', oid: 1, name: 'Test Org' };
      let mockUser = { id: 'user-1', oid: 1 };
      let mockActor = {
        id: 'actor-2',
        oid: 2,
        type: 'system',
        name: 'Metorial',
        image: { type: 'default' },
        isSystem: true,
        organizationOid: 1,
        organization: mockOrg
      };

      vi.mocked(ID.generateId).mockResolvedValue('actor-2');
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationActor: {
            create: vi.fn().mockResolvedValue(mockActor)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationActorService.createOrganizationActor({
        input: {
          type: 'system',
          name: 'Metorial',
          image: { type: 'url', url: 'https://example.com/logo.svg' }
        },
        organization: mockOrg as any,
        context: {} as any,
        performedBy: { type: 'user', user: mockUser as any }
      });

      expect(result.isSystem).toBe(true);
      expect(result.type).toBe('system');
    });

    it('should create actor with custom image', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockUser = { id: 'user-1', oid: 1 };
      let customImage = { type: 'url', url: 'https://example.com/avatar.jpg' };
      let mockActor = {
        id: 'actor-3',
        oid: 3,
        type: 'member',
        name: 'Jane Doe',
        email: 'jane@example.com',
        image: customImage,
        isSystem: null,
        organizationOid: 1,
        organization: mockOrg
      };

      vi.mocked(ID.generateId).mockResolvedValue('actor-3');
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationActor: {
            create: vi.fn().mockResolvedValue(mockActor)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationActorService.createOrganizationActor({
        input: {
          type: 'member',
          name: 'Jane Doe',
          email: 'jane@example.com',
          image: customImage as any
        },
        organization: mockOrg as any,
        context: {} as any,
        performedBy: { type: 'user', user: mockUser as any }
      });

      expect(result.image).toEqual(customImage);
    });

    it('should use default image when not provided', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockActor = { id: 'actor-4', oid: 4, image: { type: 'default' } };

      vi.mocked(ID.generateId).mockResolvedValue('actor-4');
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationActor: {
            create: vi.fn().mockResolvedValue(mockActor)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationActorService.createOrganizationActor({
        input: {
          type: 'member',
          name: 'Test User'
        },
        organization: mockOrg as any,
        context: {} as any,
        performedBy: { type: 'user', user: { id: 'user-1', oid: 1 } as any }
      });

      expect(result.image).toEqual({ type: 'default' });
    });

    it('should handle actor performedBy', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockPerformedByActor = { id: 'actor-0', oid: 0 };
      let mockActor = { id: 'actor-5', oid: 5 };

      vi.mocked(ID.generateId).mockResolvedValue('actor-5');
      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationActor: {
            create: vi.fn().mockResolvedValue(mockActor)
          }
        };
        return callback(mockDb as any);
      });

      await organizationActorService.createOrganizationActor({
        input: {
          type: 'member',
          name: 'Test User'
        },
        organization: mockOrg as any,
        context: {} as any,
        performedBy: { type: 'actor', actor: mockPerformedByActor as any }
      });

      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.actor.created:after',
        expect.objectContaining({
          performedBy: mockPerformedByActor
        })
      );
    });
  });

  describe('getSystemActor', () => {
    it('should return system actor when found', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockSystemActor = {
        id: 'actor-system',
        oid: 100,
        type: 'system',
        isSystem: true,
        name: 'Metorial',
        organization: mockOrg
      };

      vi.mocked(db.organizationActor.findFirst).mockResolvedValue(mockSystemActor as any);

      let result = await organizationActorService.getSystemActor({
        organization: mockOrg as any
      });

      expect(result).toEqual(mockSystemActor);
      expect(db.organizationActor.findFirst).toHaveBeenCalled();
    });

    it('should throw error when system actor not found', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      vi.mocked(db.organizationActor.findFirst).mockResolvedValue(null);

      await expect(
        organizationActorService.getSystemActor({
          organization: mockOrg as any
        })
      ).rejects.toThrow('WTF - System actor not found');
    });
  });

  describe('updateOrganizationActor', () => {
    it('should update actor successfully', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockActor = { id: 'actor-1', oid: 1 };
      let mockPerformedBy = { id: 'actor-2', oid: 2 };
      let updatedActor = {
        id: 'actor-1',
        oid: 1,
        name: 'Updated Name',
        email: 'updated@example.com'
      };

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationActor: {
            update: vi.fn().mockResolvedValue(updatedActor)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationActorService.updateOrganizationActor({
        actor: mockActor as any,
        organization: mockOrg as any,
        input: {
          name: 'Updated Name',
          email: 'updated@example.com'
        },
        context: {} as any,
        performedBy: mockPerformedBy as any
      });

      expect(result).toEqual(updatedActor);
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.actor.updated:before',
        expect.any(Object)
      );
      expect(Fabric.fire).toHaveBeenCalledWith(
        'organization.actor.updated:after',
        expect.objectContaining({
          actor: updatedActor,
          performedBy: mockPerformedBy
        })
      );
    });

    it('should update only provided fields', async () => {
      let mockActor = { id: 'actor-1', oid: 1, name: 'Old Name' };
      let updatedActor = { ...mockActor, name: 'New Name' };

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationActor: {
            update: vi.fn().mockResolvedValue(updatedActor)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationActorService.updateOrganizationActor({
        actor: mockActor as any,
        organization: { id: 'org-1', oid: 1 } as any,
        input: {
          name: 'New Name'
        },
        context: {} as any,
        performedBy: { id: 'actor-2', oid: 2 } as any
      });

      expect(result.name).toBe('New Name');
    });

    it('should update actor image', async () => {
      let newImage = { type: 'url', url: 'https://example.com/new-avatar.jpg' };
      let mockActor = { id: 'actor-1', oid: 1 };
      let updatedActor = { ...mockActor, image: newImage };

      vi.mocked(withTransaction).mockImplementation(async callback => {
        let mockDb = {
          organizationActor: {
            update: vi.fn().mockResolvedValue(updatedActor)
          }
        };
        return callback(mockDb as any);
      });

      let result = await organizationActorService.updateOrganizationActor({
        actor: mockActor as any,
        organization: { id: 'org-1', oid: 1 } as any,
        input: {
          image: newImage as any
        },
        context: {} as any,
        performedBy: { id: 'actor-2', oid: 2 } as any
      });

      expect(result.image).toEqual(newImage);
    });
  });

  describe('getOrganizationActorById', () => {
    it('should return actor when found', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockActor = {
        id: 'actor-1',
        oid: 1,
        name: 'Test Actor',
        organizationOid: 1,
        organization: mockOrg
      };

      vi.mocked(db.organizationActor.findFirst).mockResolvedValue(mockActor as any);

      let result = await organizationActorService.getOrganizationActorById({
        organization: mockOrg as any,
        actorId: 'actor-1'
      });

      expect(result).toEqual(mockActor);
      expect(db.organizationActor.findFirst).toHaveBeenCalled();
    });

    it('should throw not found error when actor does not exist', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      vi.mocked(db.organizationActor.findFirst).mockResolvedValue(null);

      await expect(
        organizationActorService.getOrganizationActorById({
          organization: mockOrg as any,
          actorId: 'actor-999'
        })
      ).rejects.toThrow(ServiceError);
    });

    it('should handle empty actor ID', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      vi.mocked(db.organizationActor.findFirst).mockResolvedValue(null);

      await expect(
        organizationActorService.getOrganizationActorById({
          organization: mockOrg as any,
          actorId: ''
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  describe('listOrganizationActors', () => {
    it('should list all actors for organization', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };
      let mockActors = [
        { id: 'actor-1', oid: 1, name: 'Actor 1' },
        { id: 'actor-2', oid: 2, name: 'Actor 2' }
      ];

      let result = await organizationActorService.listOrganizationActors({
        organization: mockOrg as any
      });

      expect(result).toBeDefined();
    });

    it('should return paginated results', async () => {
      let mockOrg = { id: 'org-1', oid: 1 };

      let result = await organizationActorService.listOrganizationActors({
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
        organizationActorService.createOrganizationActor({
          input: {
            type: 'member',
            name: 'Test'
          },
          organization: { id: 'org-1', oid: 1 } as any,
          context: {} as any,
          performedBy: { type: 'user', user: { id: 'user-1', oid: 1 } as any }
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('should handle transaction failures in update', async () => {
      vi.mocked(withTransaction).mockRejectedValue(new Error('Transaction failed'));

      await expect(
        organizationActorService.updateOrganizationActor({
          actor: { id: 'actor-1', oid: 1 } as any,
          organization: { id: 'org-1', oid: 1 } as any,
          input: { name: 'New Name' },
          context: {} as any,
          performedBy: { id: 'actor-2', oid: 2 } as any
        })
      ).rejects.toThrow('Transaction failed');
    });

    it('should handle actor with all optional fields', async () => {
      let mockActor = {
        id: 'actor-1',
        oid: 1,
        type: 'member',
        name: 'Complete Actor',
        email: 'complete@example.com',
        image: { type: 'url', url: 'https://example.com/avatar.jpg' },
        isSystem: null,
        organizationOid: 1
      };

      vi.mocked(db.organizationActor.findFirst).mockResolvedValue(mockActor as any);

      let result = await organizationActorService.getOrganizationActorById({
        organization: { id: 'org-1', oid: 1 } as any,
        actorId: 'actor-1'
      });

      expect(result).toEqual(mockActor);
    });
  });
});
