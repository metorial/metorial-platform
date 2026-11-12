import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { ares } from './client';
import { createApp, expectRpcStatus, signUp, uniqueEmail } from './fixtures';

describe('ares user', () => {
  it('gets a user with their emails', async () => {
    let app = await createApp();
    let { userId, email } = await signUp(app, { firstName: 'Grace', lastName: 'Hopper' });

    let user = await ares.user.get({ id: userId });

    expect(user).toMatchObject({ id: userId, email, firstName: 'Grace', lastName: 'Hopper' });
    expect(user.emails.map(e => e.email)).toContain(email);
  });

  it('rejects an unknown user', async () => {
    await expectRpcStatus(ares.user.get({ id: 'user_missing' }), 404);
  });

  it('lists only the users of the app and supports search', async () => {
    let app = await createApp();
    let other = await createApp();

    let first = await signUp(app, { firstName: 'Zebulon' });
    let second = await signUp(app);
    let foreign = await signUp(other);

    let list = await ares.user.list({ appId: app.id, limit: 50 });
    let ids = list.items.map(i => i.id);

    expect(ids).toHaveLength(2);
    expect(ids).toEqual(expect.arrayContaining([first.userId, second.userId]));
    expect(ids).not.toContain(foreign.userId);

    let searched = await ares.user.list({ appId: app.id, limit: 50, search: 'Zebulon' });
    expect(searched.items.map(i => i.id)).toEqual([first.userId]);
  });

  it('pages through users', async () => {
    let app = await createApp();
    let created = await Promise.all([signUp(app), signUp(app), signUp(app)]);

    let seen: string[] = [];
    let after: string | undefined;

    for (let page = 0; page < 5; page++) {
      let result = await ares.user.list({ appId: app.id, limit: 1, after });
      seen.push(...result.items.map(i => i.id));
      if (!result.pagination.has_more_after) break;
      after = result.items[result.items.length - 1]!.id;
    }

    expect([...seen].sort()).toEqual(created.map(c => c.userId).sort());
  });

  it('rejects listing users of an unknown app', async () => {
    await expectRpcStatus(ares.user.list({ appId: 'app_missing', limit: 10 }), 404);
  });

  it('updates the user name', async () => {
    let app = await createApp();
    let { userId } = await signUp(app);

    let updated = await ares.user.update({ userId, firstName: 'Renamed', lastName: 'Person' });
    expect(updated).toMatchObject({ id: userId, firstName: 'Renamed', lastName: 'Person' });

    let row = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(row.firstName).toBe('Renamed');
    expect(row.lastName).toBe('Person');
  });

  it('rejects updating an unknown user', async () => {
    await expectRpcStatus(ares.user.update({ userId: 'user_missing', firstName: 'x' }), 404);
  });

  it('replaces the emails of a user', async () => {
    let app = await createApp();
    let { userId, email } = await signUp(app);
    let added = uniqueEmail();

    let emails = await ares.user.setEmails({
      userId,
      emails: [
        { email, isPrimary: true, isVerified: true },
        { email: added, isPrimary: false, isVerified: false }
      ]
    });

    expect(emails.map(e => e.email).sort()).toEqual([email, added].sort());

    let listed = await ares.user.listEmails({ userId });
    expect(listed.map(e => e.email).sort()).toEqual([email, added].sort());
    expect(listed.find(e => e.email == email)).toMatchObject({
      isPrimary: true,
      verifiedAt: expect.anything()
    });
    expect(listed.find(e => e.email == added)!.verifiedAt).toBeNull();
  });

  it('lists identities and a sync snapshot for a user', async () => {
    let app = await createApp();
    let { userId } = await signUp(app);

    expect(Array.isArray(await ares.user.listIdentities({ userId }))).toBe(true);

    let snapshot = await ares.user.getSyncSnapshot({ userId });
    expect(JSON.stringify(snapshot)).toContain(userId);
  });

  it('rejects identities and snapshots for an unknown user', async () => {
    await expectRpcStatus(ares.user.listIdentities({ userId: 'user_missing' }), 404);
    await expectRpcStatus(ares.user.getSyncSnapshot({ userId: 'user_missing' }), 404);
  });
});
