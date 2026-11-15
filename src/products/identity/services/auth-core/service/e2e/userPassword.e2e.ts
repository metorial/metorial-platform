import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { ares } from './client';
import {
  createApp,
  createDevice,
  expectRpcStatus,
  signUp,
  startEmailLogin,
  validPassword
} from './fixtures';

let context = { ip: '127.0.0.1', ua: 'e2e' };

describe('ares user password', () => {
  it('reports no password for a fresh user', async () => {
    let app = await createApp();
    let { userId } = await signUp(app);

    let state = await ares.userPassword.get({ appId: app.id, userId });
    expect(state).toMatchObject({ hasPassword: false, canManagePassword: true });
  });

  it('sets, reads and removes a password', async () => {
    let app = await createApp();
    let { userId } = await signUp(app);
    let identity = { appId: app.id, userId };

    await ares.userPassword.set({ ...identity, password: validPassword, context });

    let state = await ares.userPassword.get(identity);
    expect(state.hasPassword).toBe(true);
    expect(state.updatedAt).not.toBeNull();

    let user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    let row = await db.userPassword.findUniqueOrThrow({ where: { userOid: user.oid } });
    expect(Object.values(row).map(String)).not.toContain(validPassword);

    await ares.userPassword.remove({ ...identity, context });
    expect((await ares.userPassword.get(identity)).hasPassword).toBe(false);
    expect(await db.userPassword.count({ where: { userOid: user.oid } })).toBe(0);
  });

  it.each(['short1!A', 'alllowercase-123!', 'ALLUPPERCASE-123!', 'NoDigits-Here-Please!'])(
    'rejects the weak password %j',
    async password => {
      let app = await createApp();
      let { userId } = await signUp(app);

      await expectRpcStatus(
        ares.userPassword.set({ appId: app.id, userId, password, context }),
        400
      );
      expect((await ares.userPassword.get({ appId: app.id, userId })).hasPassword).toBe(false);
    }
  );

  it('does not reach a user through another app', async () => {
    let app = await createApp();
    let other = await createApp();
    let { userId } = await signUp(app);

    await expectRpcStatus(ares.userPassword.get({ appId: other.id, userId }), 404);
    await expectRpcStatus(
      ares.userPassword.set({ appId: other.id, userId, password: validPassword, context }),
      404
    );
  });

  it('rejects an unknown user', async () => {
    let app = await createApp();
    await expectRpcStatus(
      ares.userPassword.get({ appId: app.id, userId: 'user_missing' }),
      404
    );
  });

  it('offers a password step at login once a password is set', async () => {
    let app = await createApp();
    let { userId, email } = await signUp(app);

    await ares.userPassword.set({
      appId: app.id,
      userId,
      password: validPassword,
      context
    });

    let device = await createDevice();
    let started = await startEmailLogin(device, { clientId: app.clientId, email });
    if (started.type != 'auth_intent') throw new Error('expected auth intent');

    expect(started.authIntent.type).toBe('password');
    expect(started.authIntent.steps[0]!.type).toBe('password');

    let intent = started.authIntent;
    await expect(
      device.auth.authIntent.verifyStep({
        authIntentId: intent.id,
        clientSecret: intent.clientSecret,
        stepId: intent.steps[0]!.id,
        input: { type: 'password', password: `${validPassword}-wrong` }
      })
    ).rejects.toThrow();

    let verified = await device.auth.authIntent.verifyStep({
      authIntentId: intent.id,
      clientSecret: intent.clientSecret,
      stepId: intent.steps[0]!.id,
      input: { type: 'password', password: validPassword }
    });
    expect(verified.status).toBe('verified');
  });
});
