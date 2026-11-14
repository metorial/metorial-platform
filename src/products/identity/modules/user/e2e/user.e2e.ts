import { testContext, uniqueEmail } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import { userAuthService, userService } from '../src';

describe('module-user', () => {
  it('signs up, authenticates and logs out a user', async () => {
    let context = testContext();
    let email = uniqueEmail('user');
    let password = 'e2e-password-123';

    let session = await userAuthService.signupWithPassword({
      input: { name: 'E2E User', email, password },
      context
    });

    let authenticated = await userAuthService.authenticateWithSessionSecret({
      sessionClientSecret: session.clientSecret,
      context
    });
    expect(authenticated.user.email).toBe(email);
    expect((await userService.getUser({ userId: authenticated.user.id })).email).toBe(email);

    let login = await userAuthService.loginWithPassword({
      input: { email, password },
      context
    });
    expect(login.userOid).toBe(authenticated.user.oid);

    await userAuthService.logout({ session: authenticated.session, context });
    await expect(
      userAuthService.authenticateWithSessionSecret({
        sessionClientSecret: session.clientSecret,
        context
      })
    ).rejects.toThrow();

    await expect(
      userAuthService.loginWithPassword({ input: { email, password: 'wrong' }, context })
    ).rejects.toThrow(/Invalid email or password/);
  });

  it('rejects duplicate emails', async () => {
    let context = testContext();
    let email = uniqueEmail('dup');
    await userService.createUser({ input: { name: 'First', email }, context });

    await expect(
      userService.createUser({ input: { name: 'Second', email }, context })
    ).rejects.toThrow(/already exists/);
  });
});
