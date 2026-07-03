import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockDb = vi.hoisted(() => ({
  ssoUser: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn()
  },
  ssoUserProfile: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn()
  },
  ssoDirectory: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn()
  },
  ssoDirectoryUserProfile: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn()
  },
  ssoGroup: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn()
  },
  ssoRole: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn()
  },
  ssoUserProfileGroup: {
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
    create: vi.fn()
  },
  ssoUserProfileRole: {
    deleteMany: vi.fn(),
    create: vi.fn()
  },
  ssoConnection: {
    findUniqueOrThrow: vi.fn()
  },
  ssoTenantDomain: {
    findFirst: vi.fn()
  }
}));

vi.mock('../db', () => ({
  db: mockDb,
  withTransaction: async (cb: (db: typeof mockDb) => Promise<unknown>) => await cb(mockDb)
}));

vi.mock('../lib/jackson', () => ({
  jackson: {
    directorySyncController: {
      directories: {
        create: vi.fn()
      },
      requests: {
        handle: vi.fn()
      }
    }
  }
}));

describe('ssoService SCIM membership ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not overwrite memberships from auth when a directory owns the profile', async () => {
    let { ssoService } = await import('./sso');

    mockDb.ssoUserProfile.findFirst.mockResolvedValue({
      oid: 1n,
      ownerDirectoryOid: 99n
    });
    mockDb.ssoUserProfile.update.mockResolvedValue({
      oid: 1n,
      ownerDirectoryOid: 99n
    });

    await ssoService.upsertUserProfile({
      tenant: { oid: 10n } as any,
      connection: { oid: 20n } as any,
      user: { oid: 30n } as any,
      data: {
        email: 'user@example.com',
        uid: 'uid',
        uidHash: 'uid_hash',
        firstName: 'User',
        lastName: 'Example',
        roles: ['admin'],
        groups: ['engineering'],
        raw: {}
      }
    });

    expect(mockDb.ssoUserProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roles: undefined,
          groups: undefined
        })
      })
    );
    expect(mockDb.ssoUserProfileGroup.deleteMany).not.toHaveBeenCalled();
    expect(mockDb.ssoUserProfileRole.deleteMany).not.toHaveBeenCalled();
  });

  it('moves ownership to the reporting directory and syncs roles from user events', async () => {
    let { ssoService } = await import('./sso');

    let directory = {
      oid: 1n,
      connectionOid: 2n,
      connection: {
        oid: 2n,
        tenantOid: 3n,
        tenant: { oid: 3n }
      }
    };
    let user = {
      oid: 4n,
      email: 'user@example.com',
      firstName: 'Old',
      lastName: 'Name'
    };
    let profile = {
      oid: 5n,
      ownerDirectoryOid: 99n,
      groups: [],
      roles: []
    };
    let group = {
      oid: 6n,
      value: 'Engineering'
    };
    let role = {
      oid: 8n,
      value: 'admin'
    };

    mockDb.ssoDirectory.findUnique.mockResolvedValue(directory);
    mockDb.ssoDirectoryUserProfile.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockDb.ssoDirectoryUserProfile.create.mockResolvedValue({ oid: 7n });
    mockDb.ssoUser.findFirst.mockResolvedValue(user);
    mockDb.ssoUser.update.mockResolvedValue({
      ...user,
      firstName: 'Ada',
      lastName: 'Lovelace'
    });
    mockDb.ssoUserProfile.findFirst.mockResolvedValue(profile);
    mockDb.ssoUserProfile.update.mockImplementation(async ({ data }: any) => ({
      ...profile,
      ...data
    }));
    mockDb.ssoGroup.findFirst.mockResolvedValue(null);
    mockDb.ssoGroup.create.mockResolvedValue(group);
    mockDb.ssoRole.findFirst.mockResolvedValue(null);
    mockDb.ssoRole.create.mockResolvedValue(role);

    await ssoService.syncUserFromDirectoryEvent({
      directory: directory as any,
      event: {
        event: 'user.updated',
        data: {
          id: 'scim_user_1',
          email: 'user@example.com',
          first_name: 'Ada',
          last_name: 'Lovelace',
          active: true,
          roles: ['admin']
        }
      } as any
    });

    expect(mockDb.ssoDirectoryUserProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          directoryOid: 1n,
          userProfileOid: 5n,
          externalId: 'scim_user_1'
        })
      })
    );
    expect(mockDb.ssoUserProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerDirectoryOid: 1n
        })
      })
    );
    expect(mockDb.ssoUserProfileRole.deleteMany).toHaveBeenCalledWith({
      where: { userProfileOid: 5n }
    });
  });

  it('syncs group membership events from UserWithGroup payloads', async () => {
    let { ssoService } = await import('./sso');

    let directory = {
      oid: 1n,
      connectionOid: 2n,
      connection: {
        oid: 2n,
        tenantOid: 3n,
        tenant: { oid: 3n }
      }
    };
    let user = {
      oid: 4n,
      email: 'user@example.com',
      firstName: 'Old',
      lastName: 'Name'
    };
    let profile = {
      oid: 5n,
      ownerDirectoryOid: 99n,
      groups: [],
      roles: []
    };
    let group = {
      oid: 6n,
      value: 'group_1'
    };

    mockDb.ssoDirectory.findUnique.mockResolvedValue(directory);
    mockDb.ssoDirectoryUserProfile.findFirst.mockResolvedValue(null);
    mockDb.ssoDirectoryUserProfile.create.mockResolvedValue({ oid: 7n });
    mockDb.ssoUser.findFirst.mockResolvedValue(user);
    mockDb.ssoUser.update.mockResolvedValue({
      ...user,
      firstName: 'Ada',
      lastName: 'Lovelace'
    });
    mockDb.ssoUserProfile.findFirst.mockResolvedValue(profile);
    mockDb.ssoUserProfile.update.mockImplementation(async ({ data }: any) => ({
      ...profile,
      ...data
    }));
    mockDb.ssoGroup.findFirst.mockResolvedValue(null);
    mockDb.ssoGroup.create.mockResolvedValue(group);
    mockDb.ssoUserProfileGroup.findFirst.mockResolvedValue(null);

    await ssoService.syncGroupMembershipFromDirectoryEvent({
      directory: directory as any,
      member: true,
      event: {
        event: 'group.user_added',
        data: {
          id: 'scim_user_1',
          email: 'user@example.com',
          first_name: 'Ada',
          last_name: 'Lovelace',
          active: true,
          group: {
            id: 'group_1',
            name: 'Engineering'
          }
        }
      } as any
    });

    expect(mockDb.ssoGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          value: 'group_1',
          displayName: 'Engineering'
        })
      })
    );
    expect(mockDb.ssoUserProfileGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userProfileOid: 5n,
          groupOid: 6n
        })
      })
    );
  });
});

describe('ssoService.getTenantByDomain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('only returns tenants that have at least one connection configured', async () => {
    let tenant = { id: 'sso_tenant_123' };
    mockDb.ssoTenantDomain.findFirst.mockResolvedValue({
      tenant
    });

    let { ssoService } = await import('./sso');

    let result = await ssoService.getTenantByDomain({
      app: { oid: 42n } as any,
      domain: ' Example.com '
    });

    expect(result).toBe(tenant);
    expect(mockDb.ssoTenantDomain.findFirst).toHaveBeenCalledWith({
      where: {
        appOid: 42n,
        domain: 'example.com',
        tenant: {
          status: 'completed',
          connections: {
            some: {}
          }
        }
      },
      include: {
        tenant: true
      }
    });
  });

  it('returns null when no eligible tenant domain exists', async () => {
    mockDb.ssoTenantDomain.findFirst.mockResolvedValue(null);

    let { ssoService } = await import('./sso');

    await expect(
      ssoService.getTenantByDomain({
        app: { oid: 42n } as any,
        domain: 'example.com'
      })
    ).resolves.toBeNull();
  });
});
