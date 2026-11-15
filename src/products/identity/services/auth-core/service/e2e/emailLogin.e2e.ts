import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { ares } from './client';
import {
  createApp,
  createDevice,
  expectRpcStatus,
  readEmailCode,
  REDIRECT_URL,
  signUp,
  startEmailLogin,
  uniqueEmail
} from './fixtures';

describe('ares email login', () => {
  it('signs up a new user through the email code flow', async () => {
    let app = await createApp();
    let email = uniqueEmail();

    let result = await signUp(app, { email, firstName: 'Ada', lastName: 'Lovelace' });

    let user = await ares.user.get({ id: result.userId });
    expect(user).toMatchObject({
      status: 'active',
      email,
      firstName: 'Ada',
      lastName: 'Lovelace',
      signupMethod: 'email'
    });

    let row = await db.user.findUniqueOrThrow({
      where: { id: result.userId },
      include: { app: true }
    });
    expect(row.app.id).toBe(app.id);

    expect(result.session.loggedOutAt).toBeNull();
    expect(result.session.deviceId).toBe(result.device.deviceId);
  });

  it('starts an auth intent with a pending email code step for a new address', async () => {
    let app = await createApp();
    let device = await createDevice();
    let email = uniqueEmail();

    let started = await startEmailLogin(device, { clientId: app.clientId, email });

    expect(started.type).toBe('auth_intent');
    if (started.type != 'auth_intent') return;

    expect(started.authIntent).toMatchObject({
      status: 'needs_verification',
      type: 'email_code',
      identifier: { type: 'email', value: email }
    });
    expect(started.authIntent.steps).toHaveLength(1);
    expect(started.authIntent.steps[0]).toMatchObject({
      type: 'email_code',
      status: 'current',
      email
    });
    expect(started.authIntent.steps[0]!.codes.every(c => c.code == '••••••')).toBe(true);
  });

  it('rejects a wrong code and accepts the right one afterwards', async () => {
    let app = await createApp();
    let device = await createDevice();

    let started = await startEmailLogin(device, {
      clientId: app.clientId,
      email: uniqueEmail()
    });
    if (started.type != 'auth_intent') throw new Error('expected auth intent');

    let intent = started.authIntent;
    let stepId = intent.steps[0]!.id;
    let code = await readEmailCode(stepId);
    let wrong = code == '000000' ? '000001' : '000000';

    await expectRpcStatus(
      device.auth.authIntent.verifyStep({
        authIntentId: intent.id,
        clientSecret: intent.clientSecret,
        stepId,
        input: { type: 'email_code', code: wrong }
      }),
      400
    );

    let stillPending = await device.auth.authIntent.get({
      authIntentId: intent.id,
      clientSecret: intent.clientSecret
    });
    expect(stillPending.status).toBe('needs_verification');

    let verified = await device.auth.authIntent.verifyStep({
      authIntentId: intent.id,
      clientSecret: intent.clientSecret,
      stepId,
      input: { type: 'email_code', code }
    });
    expect(verified.status).toBe('needs_user');
    expect(verified.steps[0]!.status).toBe('complete');
  });

  it('does not expose an auth intent with the wrong client secret', async () => {
    let app = await createApp();
    let device = await createDevice();

    let started = await startEmailLogin(device, {
      clientId: app.clientId,
      email: uniqueEmail()
    });
    if (started.type != 'auth_intent') throw new Error('expected auth intent');

    await expect(
      device.auth.authIntent.get({
        authIntentId: started.authIntent.id,
        clientSecret: 'wrong-secret'
      })
    ).rejects.toThrow();
  });

  it('requires accepted terms to create a user', async () => {
    let app = await createApp();
    let device = await createDevice();
    let email = uniqueEmail();

    let started = await startEmailLogin(device, { clientId: app.clientId, email });
    if (started.type != 'auth_intent') throw new Error('expected auth intent');

    let intent = started.authIntent;
    let ref = { authIntentId: intent.id, clientSecret: intent.clientSecret };
    let stepId = intent.steps[0]!.id;

    await device.auth.authIntent.verifyStep({
      ...ref,
      stepId,
      input: { type: 'email_code', code: await readEmailCode(stepId) }
    });

    await expectRpcStatus(
      device.auth.authIntent.createUser({
        ...ref,
        input: { firstName: 'No', lastName: 'Terms', acceptedTerms: false }
      }),
      403
    );

    expect(await db.userEmail.count({ where: { email } })).toBe(0);
  });

  it('refuses to create an auth attempt before the intent is verified', async () => {
    let app = await createApp();
    let device = await createDevice();

    let started = await startEmailLogin(device, {
      clientId: app.clientId,
      email: uniqueEmail()
    });
    if (started.type != 'auth_intent') throw new Error('expected auth intent');

    await expectRpcStatus(
      device.auth.authAttempt.create({
        from: 'auth_intent',
        authIntent: {
          id: started.authIntent.id,
          clientSecret: started.authIntent.clientSecret
        }
      }),
      403
    );
  });

  it('logs an existing user in again through a new intent', async () => {
    let app = await createApp();
    let first = await signUp(app);

    let device = await createDevice();
    let started = await startEmailLogin(device, {
      clientId: app.clientId,
      email: first.email
    });
    if (started.type != 'auth_intent') throw new Error('expected auth intent');

    let intent = started.authIntent;
    let ref = { authIntentId: intent.id, clientSecret: intent.clientSecret };
    let stepId = intent.steps[0]!.id;

    let verified = await device.auth.authIntent.verifyStep({
      ...ref,
      stepId,
      input: { type: 'email_code', code: await readEmailCode(stepId) }
    });
    expect(verified.status).toBe('verified');

    let attempt = await device.auth.authAttempt.create({
      from: 'auth_intent',
      authIntent: { id: intent.id, clientSecret: intent.clientSecret }
    });
    let exchanged = await device.auth.authAttempt.exchange({
      authAttemptId: attempt.id,
      clientSecret: attempt.clientSecret
    });

    let session = await ares.session.get({ sessionId: exchanged.sessionId });
    expect(session.userId).toBe(first.userId);
    expect(session.id).not.toBe(first.sessionId);
  });

  it('skips verification when the user is already logged in on the device', async () => {
    let app = await createApp();
    let result = await signUp(app);

    let started = await startEmailLogin(result.device, {
      clientId: app.clientId,
      email: result.email
    });

    expect(started.type).toBe('auth_attempt');
  });

  it('rejects redirect urls outside the allowed domains', async () => {
    let app = await createApp({ redirectDomains: ['example.com'] });
    let device = await createDevice();

    await expectRpcStatus(
      device.auth.authentication.start({
        type: 'email',
        clientId: app.clientId,
        email: uniqueEmail(),
        redirectUrl: 'https://evil.example.net/callback'
      }),
      400
    );
  });

  it('rejects email login for an unknown client', async () => {
    let device = await createDevice();

    await expectRpcStatus(
      device.auth.authentication.start({
        type: 'email',
        clientId: 'unknown_client',
        email: uniqueEmail(),
        redirectUrl: REDIRECT_URL
      }),
      404
    );
  });

  it('rejects email login when the app disables email auth', async () => {
    let app = await createApp({ disableEmailAuth: true });
    let device = await createDevice();

    await expect(
      startEmailLogin(device, { clientId: app.clientId, email: uniqueEmail() })
    ).rejects.toThrow();
  });

  it('keeps the same email separate across apps', async () => {
    let appA = await createApp();
    let appB = await createApp();
    let email = uniqueEmail();

    let a = await signUp(appA, { email });
    let b = await signUp(appB, { email });

    expect(a.userId).not.toBe(b.userId);
  });

  it('rejects an exchange with the wrong attempt secret', async () => {
    let app = await createApp();
    let result = await signUp(app);

    await expect(
      result.device.auth.authAttempt.exchange({
        authAttemptId: result.attempt.id,
        clientSecret: 'wrong-secret'
      })
    ).rejects.toThrow();
  });
});
