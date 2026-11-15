import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { ares } from './client';
import { createApp, expectRpcStatus, signUp } from './fixtures';

let owner = (app: { slug: string | null }, sessionId: string, overrides = {}) => ({
  sessionId,
  owner: uniqueId('owner'),
  ownerSessionId: uniqueId('osess'),
  ownerRevision: '1',
  appSlug: app.slug!,
  state: 'active' as const,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  logoutUrl: 'https://app.example.com/logout',
  ...overrides
});

describe('ares session', () => {
  it('gets a session and rejects unknown ids', async () => {
    let app = await createApp();
    let { sessionId, userId, device } = await signUp(app);

    let session = await ares.session.get({ sessionId });
    expect(session).toMatchObject({
      id: sessionId,
      userId,
      deviceId: device.deviceId,
      loggedOutAt: null,
      lifecycleOwner: null
    });

    await expectRpcStatus(ares.session.get({ sessionId: 'session_missing' }), 404);
  });

  it('lists the logged-in users of the device behind a session', async () => {
    let app = await createApp();
    let { sessionId, userId } = await signUp(app);

    let users = await ares.session.getLoggedInUsers({ sessionId });

    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ sessionId });
    expect(users[0]!.user.id).toBe(userId);
  });

  it('logs a session out through the internal api', async () => {
    let app = await createApp();
    let { sessionId } = await signUp(app);

    await ares.session.logout({ sessionId });

    let session = await ares.session.get({ sessionId });
    expect(session.loggedOutAt).not.toBeNull();

    let row = await db.authDeviceUserSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(row.loggedOutAt).not.toBeNull();
  });

  it('rejects logging out an unknown session', async () => {
    await expectRpcStatus(ares.session.logout({ sessionId: 'session_missing' }), 404);
  });

  it('logs out through the public api and returns a logout hook', async () => {
    let app = await createApp();
    let { auth, sessionId } = await signUp(app);

    let result = await auth.session.logout({});
    expect(result.type).toBe('hook');

    expect((await ares.session.get({ sessionId })).loggedOutAt).not.toBeNull();
  });

  it('rejects public logout without a session cookie', async () => {
    let app = await createApp();
    let { device } = await signUp(app);

    await expectRpcStatus(device.auth.session.logout({}), 401);
  });

  it('lets an owner claim a session and records the lifecycle owner', async () => {
    let app = await createApp();
    let { sessionId } = await signUp(app);
    let input = owner(app, sessionId);

    let result = await ares.session.applyOwnerState(input);
    expect(result).toMatchObject({ applied: true });

    let session = await ares.session.get({ sessionId });
    expect(session).toMatchObject({
      lifecycleOwner: input.owner,
      lifecycleOwnerSessionId: input.ownerSessionId
    });
  });

  it('ignores a stale revision from the current owner session', async () => {
    let app = await createApp();
    let { sessionId } = await signUp(app);
    let input = owner(app, sessionId, { ownerRevision: '5' });

    await ares.session.applyOwnerState(input);
    let stale = await ares.session.applyOwnerState({ ...input, ownerRevision: '5' });

    expect(stale).toMatchObject({ applied: false, reason: 'stale_revision' });
  });

  it('refuses a second owner on a claimed session', async () => {
    let app = await createApp();
    let { sessionId } = await signUp(app);

    await ares.session.applyOwnerState(owner(app, sessionId));
    let result = await ares.session.applyOwnerState(owner(app, sessionId));

    expect(result).toMatchObject({ applied: false, reason: 'owned_by_other' });
  });

  it('refuses owner state from an app that does not own the session', async () => {
    let app = await createApp();
    let other = await createApp();
    let { sessionId } = await signUp(app);

    await expectRpcStatus(ares.session.applyOwnerState(owner(other, sessionId)), 403);
  });

  it('ends the session when the owner reports a terminal state', async () => {
    let app = await createApp();
    let { sessionId } = await signUp(app);
    let input = owner(app, sessionId);

    await ares.session.applyOwnerState(input);
    let ended = await ares.session.applyOwnerState({
      ...input,
      ownerRevision: '2',
      state: 'logged_out'
    });

    expect(ended).toMatchObject({ applied: true });
    expect((await ares.session.get({ sessionId })).loggedOutAt).not.toBeNull();
  });

  it('sends an owned session to its owner for public logout', async () => {
    let app = await createApp();
    let { sessionId, auth } = await signUp(app);

    await ares.session.applyOwnerState(owner(app, sessionId));

    let result = await auth.session.logout({});
    expect(result).toEqual({ type: 'hook', url: 'https://app.example.com/logout' });
    expect((await ares.session.get({ sessionId })).loggedOutAt).toBeNull();
  });
});
