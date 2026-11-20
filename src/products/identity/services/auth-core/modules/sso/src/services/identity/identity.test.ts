import type { SsoConnection, SsoTenant, SsoUser } from '@mtsrc/auth-core-db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db } = vi.hoisted(() => ({
  db: {
    ssoUser: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    ssoUserProfile: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() }
  }
}));

vi.mock('@mtsrc/auth-core-db', () => ({
  db,
  getId: (type: string) => ({ oid: 100n, id: `${type}_generated` })
}));

vi.mock('../../queues/reconcileSsoUsers', () => ({
  reconcileSingleSsoUserQueue: { add: vi.fn() }
}));

vi.mock('./groupRole', () => ({
  ssoGroupRoleService: { replaceUserProfileGroups: vi.fn(), replaceUserProfileRoles: vi.fn() }
}));

import { ssoIdentityService } from './identity';

let tenant = { oid: 1n } as SsoTenant;

let connection = { oid: 2n } as SsoConnection;

let user = { oid: 3n } as SsoUser;

let profile = { oid: 4n, id: 'profile_1' };

let profileData = {
  email: 'user@example.com',
  uid: 'subject_1',
  uidHash: 'subject_hash_1',
  roles: [],
  groups: [],
  raw: {}
};

describe('SSO user provisioning', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.ssoUser.findUnique.mockResolvedValue({ ownerProfile: { ownerDirectoryOid: 5n } });
    db.ssoUserProfile.create.mockResolvedValue(profile);
    db.ssoUserProfile.update.mockResolvedValue(profile);
  });

  it.each([
    [{}, { firstName: 'user', lastName: '' }],
    [
      { firstName: null, lastName: null },
      { firstName: 'user', lastName: '' }
    ],
    [{ firstName: 'Ada' }, { firstName: 'Ada', lastName: '' }],
    [{ lastName: 'Lovelace' }, { firstName: '', lastName: 'Lovelace' }],
    [
      { firstName: 'Ada', lastName: 'Lovelace' },
      { firstName: 'Ada', lastName: 'Lovelace' }
    ]
  ])('provisions a user and profile with name claims %j', async (claims, names) => {
    db.ssoUserProfile.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(profile);

    await ssoIdentityService.upsertUser({ tenant, email: profileData.email, ...claims });
    await ssoIdentityService.upsertUserProfile({
      tenant,
      connection,
      user,
      data: { ...profileData, ...claims }
    });

    let create = expect.objectContaining({ data: expect.objectContaining(names) });
    expect(db.ssoUser.create).toHaveBeenCalledWith(create);
    expect(db.ssoUserProfile.create).toHaveBeenCalledWith(create);
  });

  it('preserves stored names when a subsequent sign-in omits them', async () => {
    db.ssoUser.findFirst.mockResolvedValue(user);
    db.ssoUserProfile.findFirst.mockResolvedValue(profile);
    let claims = { lastName: null };

    await ssoIdentityService.upsertUser({ tenant, email: profileData.email, ...claims });
    await ssoIdentityService.upsertUserProfile({
      tenant,
      connection,
      user,
      data: { ...profileData, ...claims }
    });

    let update = expect.objectContaining({
      data: expect.objectContaining({ firstName: undefined, lastName: undefined })
    });
    expect(db.ssoUser.update).toHaveBeenCalledWith(update);
    expect(db.ssoUserProfile.update).toHaveBeenCalledWith(update);
  });
});
