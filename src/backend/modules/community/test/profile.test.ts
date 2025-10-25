import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { profileService } from '../src/services/profile';

// Mock dependencies
vi.mock('@metorial/db', () => ({
  db: {
    profile: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    profileUpdate: {
      create: vi.fn()
    },
    serverVariantProvider: {
      findUnique: vi.fn(),
      create: vi.fn()
    }
  },
  ID: {
    generateId: vi.fn()
  }
}));

vi.mock('@metorial/slugify', () => ({
  createSlugGenerator: vi.fn(() => vi.fn(async ({ input }: { input: string }) => `${input}-slug`))
}));

vi.mock('@metorial/service', () => ({
  Service: {
    create: vi.fn((name: string, factory: () => any) => ({
      build: vi.fn(() => factory())
    }))
  }
}));

import { db, ID } from '@metorial/db';

describe('ProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureProfile', () => {
    it('should return existing user profile if found', async () => {
      const mockUser = { oid: 'user-oid-123', name: 'John Doe', image: null };
      const mockProfile = {
        oid: 'profile-oid-123',
        userOid: 'user-oid-123',
        organizationOid: null,
        type: 'user',
        name: 'John Doe',
        slug: 'john-doe-slug',
        image: null,
        attributes: []
      };

      (db.profile.findFirst as Mock).mockResolvedValue(mockProfile);

      const result = await profileService.ensureProfile({
        for: { type: 'user', user: mockUser as any }
      });

      expect(result).toEqual(mockProfile);
      expect(db.profile.findFirst).toHaveBeenCalledWith({
        where: {
          userOid: 'user-oid-123',
          organizationOid: undefined
        }
      });
      expect(db.profile.upsert).not.toHaveBeenCalled();
    });

    it('should return existing organization profile if found', async () => {
      const mockOrg = { oid: 'org-oid-456', name: 'Acme Corp', slug: 'acme', image: null };
      const mockProfile = {
        oid: 'profile-oid-456',
        userOid: null,
        organizationOid: 'org-oid-456',
        type: 'organization',
        name: 'Acme Corp',
        slug: 'acme-slug',
        image: null,
        attributes: []
      };

      (db.profile.findFirst as Mock).mockResolvedValue(mockProfile);

      const result = await profileService.ensureProfile({
        for: { type: 'organization', organization: mockOrg as any }
      });

      expect(result).toEqual(mockProfile);
      expect(db.profile.findFirst).toHaveBeenCalledWith({
        where: {
          userOid: undefined,
          organizationOid: 'org-oid-456'
        }
      });
    });

    it('should create new user profile if not found', async () => {
      const mockUser = { oid: 'user-oid-789', name: 'Jane Smith', image: 'http://example.com/avatar.jpg' };
      const newProfile = {
        oid: 'new-profile-oid',
        id: 'profile_abc123',
        userOid: 'user-oid-789',
        organizationOid: null,
        type: 'user',
        name: 'Jane Smith',
        slug: 'Jane Smith-slug',
        image: 'http://example.com/avatar.jpg',
        attributes: []
      };

      (db.profile.findFirst as Mock).mockResolvedValue(null);
      (ID.generateId as Mock).mockResolvedValue('profile_abc123');
      (db.profile.upsert as Mock).mockResolvedValue(newProfile);

      const result = await profileService.ensureProfile({
        for: { type: 'user', user: mockUser as any }
      });

      expect(result).toEqual(newProfile);
      expect(ID.generateId).toHaveBeenCalledWith('profile');
      expect(db.profile.upsert).toHaveBeenCalledWith({
        where: { userOid: 'user-oid-789' },
        update: {},
        create: expect.objectContaining({
          id: 'profile_abc123',
          userOid: 'user-oid-789',
          organizationOid: undefined,
          type: 'user',
          name: 'Jane Smith',
          image: 'http://example.com/avatar.jpg',
          attributes: []
        })
      });
    });

    it('should create new organization profile with slug from org slug', async () => {
      const mockOrg = {
        oid: 'org-oid-999',
        name: 'Tech Company',
        slug: 'tech-co',
        image: null
      };
      const newProfile = {
        oid: 'new-profile-oid',
        id: 'profile_xyz789',
        userOid: null,
        organizationOid: 'org-oid-999',
        type: 'organization',
        name: 'Tech Company',
        slug: 'tech-co-slug',
        image: null,
        attributes: []
      };

      (db.profile.findFirst as Mock).mockResolvedValue(null);
      (ID.generateId as Mock).mockResolvedValue('profile_xyz789');
      (db.profile.upsert as Mock).mockResolvedValue(newProfile);

      const result = await profileService.ensureProfile({
        for: { type: 'organization', organization: mockOrg as any }
      });

      expect(result).toEqual(newProfile);
      expect(db.profile.upsert).toHaveBeenCalledWith({
        where: { organizationOid: 'org-oid-999' },
        update: {},
        create: expect.objectContaining({
          organizationOid: 'org-oid-999',
          userOid: undefined,
          type: 'organization',
          name: 'Tech Company'
        })
      });
    });

    it('should handle user without image', async () => {
      const mockUser = { oid: 'user-oid-111', name: 'Bob Brown', image: null };

      (db.profile.findFirst as Mock).mockResolvedValue(null);
      (ID.generateId as Mock).mockResolvedValue('profile_new123');
      (db.profile.upsert as Mock).mockResolvedValue({});

      await profileService.ensureProfile({
        for: { type: 'user', user: mockUser as any }
      });

      expect(db.profile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            image: null
          })
        })
      );
    });
  });

  describe('updateProfile', () => {
    it('should update profile name only', async () => {
      const mockProfile = {
        oid: 'profile-oid-123',
        name: 'Old Name',
        description: 'Old Description',
        image: null,
        slug: 'old-slug'
      };
      const mockActor = { oid: 'actor-oid-123' };
      const updatedProfile = { ...mockProfile, name: 'New Name', isCustomized: true };

      (ID.generateId as Mock).mockResolvedValue('update_123');
      (db.profileUpdate.create as Mock).mockResolvedValue({});
      (db.profile.update as Mock).mockResolvedValue(updatedProfile);

      const result = await profileService.updateProfile({
        profile: mockProfile as any,
        input: { name: 'New Name' },
        performedBy: mockActor as any
      });

      expect(db.profileUpdate.create).toHaveBeenCalledWith({
        data: {
          id: 'update_123',
          profileOid: 'profile-oid-123',
          createdByOid: 'actor-oid-123',
          before: {
            name: 'Old Name',
            description: 'Old Description',
            image: null,
            slug: 'old-slug'
          },
          after: {
            name: 'New Name',
            description: 'Old Description',
            image: null,
            slug: 'old-slug'
          }
        }
      });

      expect(db.profile.update).toHaveBeenCalledWith({
        where: { oid: 'profile-oid-123' },
        data: {
          name: 'New Name',
          description: undefined,
          isCustomized: true
        }
      });

      expect(result).toEqual(updatedProfile);
    });

    it('should update profile description only', async () => {
      const mockProfile = {
        oid: 'profile-oid-456',
        name: 'Current Name',
        description: 'Old Description',
        image: 'http://example.com/img.jpg',
        slug: 'current-slug'
      };
      const mockActor = { oid: 'actor-oid-456' };

      (ID.generateId as Mock).mockResolvedValue('update_456');
      (db.profileUpdate.create as Mock).mockResolvedValue({});
      (db.profile.update as Mock).mockResolvedValue({});

      await profileService.updateProfile({
        profile: mockProfile as any,
        input: { description: 'New Description' },
        performedBy: mockActor as any
      });

      expect(db.profileUpdate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          after: expect.objectContaining({
            name: 'Current Name',
            description: 'New Description'
          })
        })
      });

      expect(db.profile.update).toHaveBeenCalledWith({
        where: { oid: 'profile-oid-456' },
        data: {
          name: undefined,
          description: 'New Description',
          isCustomized: true
        }
      });
    });

    it('should update both name and description', async () => {
      const mockProfile = {
        oid: 'profile-oid-789',
        name: 'Old Name',
        description: 'Old Description',
        image: null,
        slug: 'old-slug'
      };
      const mockActor = { oid: 'actor-oid-789' };

      (ID.generateId as Mock).mockResolvedValue('update_789');
      (db.profileUpdate.create as Mock).mockResolvedValue({});
      (db.profile.update as Mock).mockResolvedValue({});

      await profileService.updateProfile({
        profile: mockProfile as any,
        input: { name: 'Brand New Name', description: 'Brand New Description' },
        performedBy: mockActor as any
      });

      expect(db.profile.update).toHaveBeenCalledWith({
        where: { oid: 'profile-oid-789' },
        data: {
          name: 'Brand New Name',
          description: 'Brand New Description',
          isCustomized: true
        }
      });
    });

    it('should handle null description update', async () => {
      const mockProfile = {
        oid: 'profile-oid-999',
        name: 'Profile Name',
        description: 'Some Description',
        image: null,
        slug: 'profile-slug'
      };
      const mockActor = { oid: 'actor-oid-999' };

      (ID.generateId as Mock).mockResolvedValue('update_999');
      (db.profileUpdate.create as Mock).mockResolvedValue({});
      (db.profile.update as Mock).mockResolvedValue({});

      await profileService.updateProfile({
        profile: mockProfile as any,
        input: { description: null },
        performedBy: mockActor as any
      });

      // When description is null, the ?? operator returns the old description value
      expect(db.profileUpdate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          after: expect.objectContaining({
            description: 'Some Description' // Preserves old value when null is passed
          })
        })
      });

      // However, the actual update should set description to null
      expect(db.profile.update).toHaveBeenCalledWith({
        where: { oid: 'profile-oid-999' },
        data: {
          name: undefined,
          description: null,
          isCustomized: true
        }
      });
    });

    it('should always mark profile as customized', async () => {
      const mockProfile = {
        oid: 'profile-oid-111',
        name: 'Test',
        description: null,
        image: null,
        slug: 'test'
      };
      const mockActor = { oid: 'actor-oid-111' };

      (ID.generateId as Mock).mockResolvedValue('update_111');
      (db.profileUpdate.create as Mock).mockResolvedValue({});
      (db.profile.update as Mock).mockResolvedValue({});

      await profileService.updateProfile({
        profile: mockProfile as any,
        input: { name: 'Test Updated' },
        performedBy: mockActor as any
      });

      expect(db.profile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isCustomized: true
          })
        })
      );
    });
  });

  describe('syncProfile', () => {
    it('should sync non-customized user profile name', async () => {
      const mockUser = { oid: 'user-oid-123', name: 'Updated User Name', image: 'new-image.jpg' };
      const mockProfile = {
        oid: 'profile-oid-123',
        userOid: 'user-oid-123',
        isCustomized: false,
        name: 'Old User Name',
        image: 'old-image.jpg'
      };

      (db.profile.findFirst as Mock).mockResolvedValue(mockProfile);
      (db.profile.updateMany as Mock).mockResolvedValue({ count: 1 });

      await profileService.syncProfile({
        for: { type: 'user', user: mockUser as any }
      });

      expect(db.profile.updateMany).toHaveBeenCalledWith({
        where: { oid: 'profile-oid-123' },
        data: {
          name: 'Updated User Name',
          image: 'new-image.jpg'
        }
      });
    });

    it('should not sync name for customized profile', async () => {
      const mockUser = { oid: 'user-oid-456', name: 'Updated Name', image: 'image.jpg' };
      const mockProfile = {
        oid: 'profile-oid-456',
        userOid: 'user-oid-456',
        isCustomized: true,
        name: 'Custom Name',
        image: 'old-image.jpg'
      };

      (db.profile.findFirst as Mock).mockResolvedValue(mockProfile);
      (db.profile.updateMany as Mock).mockResolvedValue({ count: 1 });

      await profileService.syncProfile({
        for: { type: 'user', user: mockUser as any }
      });

      expect(db.profile.updateMany).toHaveBeenCalledWith({
        where: { oid: 'profile-oid-456' },
        data: {
          image: 'image.jpg'
        }
      });
    });

    it('should sync organization profile', async () => {
      const mockOrg = {
        oid: 'org-oid-789',
        name: 'Updated Org',
        slug: 'updated-org',
        image: 'org-image.jpg'
      };
      const mockProfile = {
        oid: 'profile-oid-789',
        organizationOid: 'org-oid-789',
        isCustomized: false
      };

      (db.profile.findFirst as Mock).mockResolvedValue(mockProfile);
      (db.profile.updateMany as Mock).mockResolvedValue({ count: 1 });

      await profileService.syncProfile({
        for: { type: 'organization', organization: mockOrg as any }
      });

      expect(db.profile.updateMany).toHaveBeenCalledWith({
        where: { oid: 'profile-oid-789' },
        data: {
          name: 'Updated Org',
          image: 'org-image.jpg'
        }
      });
    });

    it('should create profile if not exists before syncing', async () => {
      const mockUser = { oid: 'user-oid-new', name: 'New User', image: null };

      (db.profile.findFirst as Mock).mockResolvedValueOnce(null);
      (db.profile.findFirst as Mock).mockResolvedValueOnce(null);
      (ID.generateId as Mock).mockResolvedValue('profile_new');
      (db.profile.upsert as Mock).mockResolvedValue({
        oid: 'profile-oid-new',
        isCustomized: false
      });
      (db.profile.updateMany as Mock).mockResolvedValue({ count: 1 });

      await profileService.syncProfile({
        for: { type: 'user', user: mockUser as any }
      });

      expect(db.profile.upsert).toHaveBeenCalled();
      expect(db.profile.updateMany).toHaveBeenCalled();
    });

    it('should always update image regardless of customization', async () => {
      const mockUser = { oid: 'user-oid-777', name: 'User', image: 'brand-new-image.jpg' };
      const mockProfile = {
        oid: 'profile-oid-777',
        userOid: 'user-oid-777',
        isCustomized: true,
        image: 'old-image.jpg'
      };

      (db.profile.findFirst as Mock).mockResolvedValue(mockProfile);
      (db.profile.updateMany as Mock).mockResolvedValue({ count: 1 });

      await profileService.syncProfile({
        for: { type: 'user', user: mockUser as any }
      });

      expect(db.profile.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            image: 'brand-new-image.jpg'
          })
        })
      );
    });
  });

  describe('ensureProfileVariantProvider', () => {
    it('should return existing provider if profile has providerOid', async () => {
      const mockProfile = {
        oid: 'profile-oid-123',
        providerOid: 'provider-oid-123',
        name: 'Profile Name',
        description: 'Profile Description',
        image: null,
        attributes: []
      };
      const mockProvider = {
        oid: 'provider-oid-123',
        name: 'Provider Name'
      };

      (db.serverVariantProvider.findUnique as Mock).mockResolvedValue(mockProvider);

      const result = await profileService.ensureProfileVariantProvider({
        profile: mockProfile as any
      });

      expect(result).toEqual(mockProvider);
      expect(db.serverVariantProvider.findUnique).toHaveBeenCalledWith({
        where: { oid: 'provider-oid-123' }
      });
      expect(db.serverVariantProvider.create).not.toHaveBeenCalled();
    });

    it('should create new provider if profile has no providerOid', async () => {
      const mockProfile = {
        oid: 'profile-oid-456',
        providerOid: null,
        id: 'profile_abc123',
        name: 'New Profile',
        description: 'New Description',
        image: 'image.jpg',
        attributes: [{ key: 'value' }]
      };
      const newProvider = {
        oid: 'new-provider-oid',
        id: 'provider_xyz789',
        name: 'New Profile',
        description: 'New Description',
        image: 'image.jpg',
        attributes: [{ key: 'value' }],
        identifier: 'profile-profile_abc123'
      };

      (ID.generateId as Mock).mockResolvedValue('provider_xyz789');
      (db.serverVariantProvider.create as Mock).mockResolvedValue(newProvider);
      (db.profile.updateMany as Mock).mockResolvedValue({ count: 1 });

      const result = await profileService.ensureProfileVariantProvider({
        profile: mockProfile as any
      });

      expect(result).toEqual(newProvider);
      expect(db.serverVariantProvider.create).toHaveBeenCalledWith({
        data: {
          id: 'provider_xyz789',
          name: 'New Profile',
          description: 'New Description',
          image: 'image.jpg',
          attributes: [{ key: 'value' }],
          identifier: 'profile-profile_abc123'
        }
      });
      expect(db.profile.updateMany).toHaveBeenCalledWith({
        where: { oid: 'profile-oid-456' },
        data: { providerOid: 'new-provider-oid' }
      });
    });

    it('should create provider with null description', async () => {
      const mockProfile = {
        oid: 'profile-oid-789',
        providerOid: undefined,
        id: 'profile_test',
        name: 'Test Profile',
        description: null,
        image: null,
        attributes: []
      };

      (ID.generateId as Mock).mockResolvedValue('provider_test');
      (db.serverVariantProvider.create as Mock).mockResolvedValue({
        oid: 'provider-oid-789'
      });
      (db.profile.updateMany as Mock).mockResolvedValue({ count: 1 });

      await profileService.ensureProfileVariantProvider({
        profile: mockProfile as any
      });

      expect(db.serverVariantProvider.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: null,
          image: null
        })
      });
    });

    it('should use profile id in provider identifier', async () => {
      const mockProfile = {
        oid: 'profile-oid-unique',
        providerOid: null,
        id: 'profile_unique_id_12345',
        name: 'Profile',
        description: null,
        image: null,
        attributes: []
      };

      (ID.generateId as Mock).mockResolvedValue('provider_new');
      (db.serverVariantProvider.create as Mock).mockResolvedValue({ oid: 'new-oid' });
      (db.profile.updateMany as Mock).mockResolvedValue({ count: 1 });

      await profileService.ensureProfileVariantProvider({
        profile: mockProfile as any
      });

      expect(db.serverVariantProvider.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          identifier: 'profile-profile_unique_id_12345'
        })
      });
    });

    it('should update profile with new providerOid', async () => {
      const mockProfile = {
        oid: 'profile-oid-update',
        providerOid: null,
        id: 'profile_update',
        name: 'Profile',
        description: null,
        image: null,
        attributes: []
      };
      const newProvider = { oid: 'brand-new-provider-oid' };

      (ID.generateId as Mock).mockResolvedValue('provider_update');
      (db.serverVariantProvider.create as Mock).mockResolvedValue(newProvider);
      (db.profile.updateMany as Mock).mockResolvedValue({ count: 1 });

      await profileService.ensureProfileVariantProvider({
        profile: mockProfile as any
      });

      expect(db.profile.updateMany).toHaveBeenCalledWith({
        where: { oid: 'profile-oid-update' },
        data: { providerOid: 'brand-new-provider-oid' }
      });
    });
  });
});
