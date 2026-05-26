import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@metorial/db';
import type { User } from '@metorial/db';
import { userService } from '../src/services/user';
import { userSessionService } from '../src/services/userSession';

let createdUsers: User[] = [];

let context = {
  requestId: 'control-e2e-user-session',
  ip: '127.0.0.1'
} as any;

let cleanupUser = async (user: User) => {
  await db.userSession.deleteMany({ where: { userOid: user.oid } });
  await db.user.deleteMany({ where: { id: user.id } });
};

afterEach(async () => {
  for (let user of createdUsers.splice(0)) {
    await cleanupUser(user);
  }
});

describe('user session e2e', () => {
  it('creates a user session that can be resolved by client secret', async () => {
    let email = `control-user-session-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;

    let user = await userService.createUser({
      input: {
        name: 'Control E2E User',
        email
      },
      context
    });
    createdUsers.push(user);

    let session = await userSessionService.createUserSession({ user, context });
    let resolved = await userSessionService.getSessionByClientSecretSafe({
      clientSecret: session.clientSecret,
      context
    });

    expect(session.clientSecret).toMatch(/^metorial_ses_/);
    expect(resolved?.id).toBe(session.id);
    expect(resolved?.user.email).toBe(email);
  });
});
