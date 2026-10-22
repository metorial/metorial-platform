import { expectServiceError, testContext, uniqueEmail, uniqueId } from '@metorial/e2e';
import { db } from '@metorial/e2e/db';
import { Fabric } from '@metorial/fabric';
import { describe, expect, it, onTestFinished } from 'vitest';
import { userAuthService, userService, userSessionService } from '../src';

let signUp = async () => {
  let email = uniqueEmail('session');
  let password = uniqueId('password');

  let session = await userAuthService.signupWithPassword({
    input: { name: uniqueId('E2E User'), email, password },
    context: testContext()
  });
  let user = await db.user.findUniqueOrThrow({ where: { oid: session.userOid } });

  return { email, password, session, user };
};

let login = (email: string, password: string) =>
  userAuthService.loginWithPassword({ input: { email, password }, context: testContext() });

let authenticate = (sessionClientSecret: string) =>
  userAuthService.authenticateWithSessionSecret({
    sessionClientSecret,
    context: testContext()
  });

describe('module-user sessions', () => {
  it('creates a separate session with a unique secret for every sign-in', async () => {
    let { email, password, session, user } = await signUp();

    let second = await login(email, password);
    let third = await login(email, password);

    let stored = await db.userSession.findMany({ where: { userOid: user.oid } });
    expect(stored.map(item => item.id).sort()).toEqual(
      [session.id, second.id, third.id].sort()
    );

    let secrets = stored.map(item => item.clientSecret);
    expect(new Set(secrets).size).toBe(3);
    for (let secret of secrets) {
      expect(secret).toMatch(/^metorial_ses_/);
      expect(secret.length).toBeGreaterThan(40);
    }
  });

  it('authenticates a session secret as its user and rejects unknown secrets', async () => {
    let { session, user } = await signUp();

    let authenticated = await authenticate(session.clientSecret);
    expect(authenticated.user.id).toBe(user.id);
    expect(authenticated.session.id).toBe(session.id);

    await expectServiceError(
      authenticate(`metorial_ses_${uniqueId('unknown')}`),
      'unauthorized'
    );
    await expectServiceError(authenticate(''), 'unauthorized');
  });

  it('revokes only the logged-out session', async () => {
    let { email, password, session, user } = await signUp();
    let other = await login(email, password);

    let { session: current } = await authenticate(session.clientSecret);
    await userAuthService.logout({ session: current, context: testContext() });

    await expectServiceError(authenticate(session.clientSecret), 'unauthorized');
    expect(await db.userSession.findUnique({ where: { id: session.id } })).toBeNull();

    expect((await authenticate(other.clientSecret)).user.id).toBe(user.id);
  });

  it('answers wrong passwords and unknown emails with the same error', async () => {
    let { email } = await signUp();

    let wrongPassword = await expectServiceError(
      login(email, 'wrong-password'),
      'bad_request'
    );
    let unknownEmail = await expectServiceError(
      login(uniqueEmail('nobody'), 'wrong-password'),
      'bad_request'
    );

    expect(wrongPassword.message).toBe('Invalid email or password');
    expect(unknownEmail.message).toBe(wrongPassword.message);
  });

  it('does not create a session when signing up with a taken email', async () => {
    let { email, user } = await signUp();

    await expectServiceError(
      userAuthService.signupWithPassword({
        input: { name: 'Second', email, password: uniqueId('password') },
        context: testContext()
      }),
      'conflict'
    );

    expect(await db.userSession.count({ where: { userOid: user.oid } })).toBe(1);
  });

  it('rolls the sign-up back when creating its session fails', async () => {
    let email = uniqueEmail('atomic');
    let password = uniqueId('password');
    let veto = true;

    onTestFinished(
      Fabric.listen('user.session.created:before', event => {
        if (veto && event.user.email === email) throw new Error('session veto');
      })
    );

    await expect(
      userAuthService.signupWithPassword({
        input: { name: 'Atomic', email, password },
        context: testContext()
      })
    ).rejects.toThrow('session veto');
    expect(await db.user.count({ where: { email } })).toBe(0);

    veto = false;
    let session = await userAuthService.signupWithPassword({
      input: { name: 'Atomic', email, password },
      context: testContext()
    });
    expect((await authenticate(session.clientSecret)).user.email).toBe(email);
  });

  it('fires session created and deleted events', async () => {
    let { email, password, user } = await signUp();
    let events: { event: string; sessionId: string; performedById: string }[] = [];

    onTestFinished(
      Fabric.listen('user.session.created:after', event => {
        if (event.user.id === user.id) {
          events.push({
            event: 'created',
            sessionId: event.session.id,
            performedById: event.performedBy.id
          });
        }
      })
    );
    onTestFinished(
      Fabric.listen('user.session.deleted:after', event => {
        if (event.user.id === user.id) {
          events.push({
            event: 'deleted',
            sessionId: event.session.id,
            performedById: event.performedBy.id
          });
        }
      })
    );

    let session = await login(email, password);
    let { session: current } = await authenticate(session.clientSecret);
    await userAuthService.logout({ session: current, context: testContext() });

    expect(events).toEqual([
      { event: 'created', sessionId: session.id, performedById: user.id },
      { event: 'deleted', sessionId: session.id, performedById: user.id }
    ]);
  });

  it('does not give system users sessions', async () => {
    let user = await userService.createUser({
      input: { name: uniqueId('System'), email: uniqueEmail('system') },
      type: 'system',
      context: testContext()
    });

    await expectServiceError(
      userSessionService.createUserSession({ user, context: testContext() }),
      'not_implemented'
    );

    let planted = await db.userSession.create({
      data: {
        id: uniqueId('ses'),
        userOid: user.oid,
        clientSecret: `metorial_ses_${uniqueId('planted')}`
      }
    });

    await expectServiceError(authenticate(planted.clientSecret), 'not_implemented');
    await expectServiceError(
      userSessionService.deleteUserSession({ user, session: planted, context: testContext() }),
      'not_implemented'
    );
  });

  it('stops authenticating a user once the user is deleted', async () => {
    let { email, password, session, user } = await signUp();

    await db.user.update({
      where: { oid: user.oid },
      data: { status: 'deleted', deletedAt: new Date() }
    });

    await expectServiceError(authenticate(session.clientSecret), 'unauthorized');
    await expectServiceError(login(email, password), 'bad_request');
  });
});
