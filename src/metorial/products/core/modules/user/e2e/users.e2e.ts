import {
  eventually,
  expectServiceError,
  testContext,
  uniqueEmail,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { Fabric } from '@metorial/fabric';
import { describe, expect, it, onTestFinished } from 'vitest';
import { userAuthService, userService } from '../src';

let createUser = async (input: { email?: string; password?: string } = {}) =>
  userService.createUser({
    input: {
      name: uniqueId('E2E User'),
      email: input.email ?? uniqueEmail('user'),
      password: input.password
    },
    context: testContext()
  });

let login = (email: string, password: string) =>
  userAuthService.loginWithPassword({ input: { email, password }, context: testContext() });

describe('module-user users', () => {
  it('creates an active user with a hashed password and the default image', async () => {
    let email = uniqueEmail('create');
    let password = uniqueId('password');

    let user = await createUser({ email, password });

    let stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored).toMatchObject({
      email,
      name: user.name,
      status: 'active',
      type: 'user',
      image: { type: 'default' },
      deletedAt: null
    });
    expect(stored.passwordHash).toBeTruthy();
    expect(stored.passwordHash).not.toContain(password);
    expect(await Bun.password.verify(password, stored.passwordHash!)).toBe(true);
  });

  it('creates password-less users that cannot log in with a password', async () => {
    let user = await createUser();

    let stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).toBeNull();

    await expectServiceError(login(user.email, ''), 'bad_request');
    await expectServiceError(login(user.email, 'any-password'), 'bad_request');
  });

  it('rejects a duplicate email with a conflict and keeps a single row', async () => {
    let email = uniqueEmail('dup');
    await createUser({ email });

    await expectServiceError(createUser({ email }), 'conflict');
    expect(await db.user.count({ where: { email } })).toBe(1);
  });

  it.fails(
    'treats emails that differ only in case as the same account (bug: email uniqueness is case-sensitive)',
    async () => {
      let email = uniqueEmail('case');
      await createUser({ email });

      await expectServiceError(createUser({ email: email.toUpperCase() }), 'conflict');
    }
  );

  it.fails(
    'logs in regardless of the email case used at sign-up (bug: login matches the email case-sensitively)',
    async () => {
      let email = uniqueEmail('login-case');
      let password = uniqueId('password');
      let user = await createUser({ email, password });

      let session = await login(email.toUpperCase(), password);
      expect(session.userOid).toBe(user.oid);
    }
  );

  it('fires user.created events with the created user as the performer', async () => {
    let email = uniqueEmail('events');
    let before: unknown[] = [];
    let after: { userId: string; performedById: string }[] = [];

    onTestFinished(
      Fabric.listen('user.created:before', event => {
        if ((event as any).input?.email === email) before.push(event);
      })
    );
    onTestFinished(
      Fabric.listen('user.created:after', event => {
        if (event.user.email === email) {
          after.push({ userId: event.user.id, performedById: event.performedBy.id });
        }
      })
    );

    let user = await createUser({ email });

    expect(before).toHaveLength(1);
    expect(after).toEqual([{ userId: user.id, performedById: user.id }]);
  });

  it('rolls the user back when a user.created:after listener fails', async () => {
    let email = uniqueEmail('rollback');

    onTestFinished(
      Fabric.listen('user.created:after', event => {
        if (event.user.email === email) throw new Error('listener veto');
      })
    );

    await expect(createUser({ email })).rejects.toThrow('listener veto');
    expect(await db.user.count({ where: { email } })).toBe(0);
  });

  it('gets users by id and rejects unknown ids', async () => {
    let user = await createUser();

    expect((await userService.getUser({ userId: user.id })).email).toBe(user.email);
    await expectServiceError(
      userService.getUser({ userId: `usr_${uniqueId('missing')}` }),
      'not_found'
    );
  });

  it('updates profile fields and fires user.updated events', async () => {
    let user = await createUser();
    let updatedEvents: { userId: string; name: string; performedById: string }[] = [];

    onTestFinished(
      Fabric.listen('user.updated:after', event => {
        if (event.user.id === user.id) {
          updatedEvents.push({
            userId: event.user.id,
            name: event.user.name,
            performedById: event.performedBy.id
          });
        }
      })
    );

    let updated = await userService.updateUser({
      user,
      input: { name: 'Renamed User', firstName: 'Renamed', lastName: 'User' },
      context: testContext()
    });
    expect(updated).toMatchObject({
      name: 'Renamed User',
      firstName: 'Renamed',
      lastName: 'User',
      email: user.email
    });

    let stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored).toMatchObject({
      name: 'Renamed User',
      firstName: 'Renamed',
      lastName: 'User'
    });
    expect(updatedEvents).toEqual([
      { userId: user.id, name: 'Renamed User', performedById: user.id }
    ]);
  });

  it('changes the password so only the new one logs in', async () => {
    let email = uniqueEmail('password');
    let oldPassword = uniqueId('old-password');
    let newPassword = uniqueId('new-password');
    let user = await createUser({ email, password: oldPassword });

    await userService.updateUser({
      user,
      input: { password: newPassword },
      context: testContext()
    });

    let stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).not.toBe(user.passwordHash);
    expect(stored.passwordHash).not.toContain(newPassword);

    expect((await login(email, newPassword)).userOid).toBe(user.oid);
    await expectServiceError(login(email, oldPassword), 'bad_request');
  });

  it('changes the email so only the new address logs in', async () => {
    let password = uniqueId('password');
    let user = await createUser({ password });
    let nextEmail = uniqueEmail('moved');

    await userService.updateUser({
      user,
      input: { email: nextEmail },
      context: testContext()
    });

    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(
      nextEmail
    );
    expect((await login(nextEmail, password)).userOid).toBe(user.oid);
    await expectServiceError(login(user.email, password), 'bad_request');
  });

  it('rejects changing the email to one another user already has', async () => {
    let taken = await createUser();
    let user = await createUser();

    await expectServiceError(
      userService.updateUser({
        user,
        input: { email: taken.email },
        context: testContext()
      }),
      'conflict'
    );

    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(
      user.email
    );
    expect(await db.user.count({ where: { email: taken.email } })).toBe(1);
  });

  it('keeps the email when a user re-submits their own address', async () => {
    let user = await createUser();

    let updated = await userService.updateUser({
      user,
      input: { email: user.email, name: 'Same Email' },
      context: testContext()
    });

    expect(updated).toMatchObject({ email: user.email, name: 'Same Email' });
  });

  it('refuses to update a deleted user', async () => {
    let user = await createUser();
    let deleted = await db.user.update({
      where: { id: user.id },
      data: { status: 'deleted', deletedAt: new Date() }
    });

    await expectServiceError(
      userService.updateUser({
        user: deleted,
        input: { name: 'Revived' },
        context: testContext()
      }),
      'forbidden'
    );
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).name).toBe(user.name);
  });

  it('does not support deleting users yet', async () => {
    let user = await createUser();

    await expectServiceError(
      userService.deleteUser({ user, context: testContext() }),
      'not_implemented'
    );
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe(
      'active'
    );
  });

  it('creates system users that cannot log in', async () => {
    let email = uniqueEmail('system');
    let password = uniqueId('password');

    let user = await userService.createUser({
      input: { name: uniqueId('System'), email, password },
      type: 'system',
      context: testContext()
    });
    expect(user.type).toBe('system');

    await expectServiceError(login(email, password), 'bad_request');
    expect(await db.userSession.count({ where: { userOid: user.oid } })).toBe(0);
  });
});

describe('module-user profile sync', () => {
  let org = useOrganization();

  it('mirrors name and email changes onto the organization actor', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('Synced Name');
    let email = uniqueEmail('synced');

    await userService.updateUser({
      user: fixture.user,
      input: { name, email },
      context: testContext()
    });

    await eventually(
      async () => {
        let actor = await db.organizationActor.findUniqueOrThrow({
          where: { oid: fixture.actor.oid }
        });
        expect(actor).toMatchObject({ name, email });
      },
      { timeoutMs: 30_000, intervalMs: 250 }
    );
  });
});
