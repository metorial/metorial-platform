import { uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { profileService } from '../src';

describe('module-community', () => {
  let org = useOrganization();

  it('ensures one profile per user and organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let userProfile = await profileService.ensureProfile({
      for: { type: 'user', user: fixture.user }
    });
    expect(userProfile.type).toBe('user');
    expect(userProfile.userOid).toBe(fixture.user.oid);
    expect(userProfile.name).toBe(fixture.user.name);

    let orgProfile = await profileService.ensureProfile({
      for: { type: 'organization', organization: fixture.organization }
    });
    expect(orgProfile.type).toBe('organization');
    expect(orgProfile.organizationOid).toBe(fixture.organization.oid);

    let again = await profileService.ensureProfile({
      for: { type: 'organization', organization: fixture.organization }
    });
    expect(again.id).toBe(orgProfile.id);
  });

  it('keeps customized profile names when syncing', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let profile = await profileService.ensureProfile({
      for: { type: 'organization', organization: fixture.organization }
    });
    let name = uniqueId('Profile');

    let updated = await profileService.updateProfile({
      profile,
      input: { name, description: 'E2E description' },
      performedBy: fixture.actor
    });
    expect(updated.name).toBe(name);
    expect(updated.isCustomized).toBe(true);

    let history = await db.profileUpdate.findMany({ where: { profileOid: profile.oid } });
    expect(history.some(item => item.createdByOid === fixture.actor.oid)).toBe(true);

    await profileService.syncProfile({
      for: { type: 'organization', organization: fixture.organization }
    });
    let synced = await db.profile.findUniqueOrThrow({ where: { oid: profile.oid } });
    expect(synced.name).toBe(name);
    expect(synced.description).toBe('E2E description');
  });
});
