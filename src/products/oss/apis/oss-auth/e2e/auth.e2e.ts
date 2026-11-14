import {
  expectOk,
  metorialEndpoints,
  readSessionCookie,
  rest,
  uniqueEmail
} from '@metorial/e2e';
import { describe, expect, it } from 'vitest';

describe('api-auth', () => {
  it('signs up, logs in and logs out a user through session cookies', async () => {
    let api = rest(metorialEndpoints().api);
    let email = uniqueEmail('api-auth');
    let password = 'e2e-password-123';

    let signup = await api.post('/_/auth/signup', { name: 'E2E Auth User', email, password });
    expectOk(signup);
    let signupSession = readSessionCookie(signup.headers);
    expect(signupSession).toBeTruthy();

    let user = expectOk(await api.with({ session: signupSession! }).get('/user'));
    expect(user.email).toBe(email);

    let login = await api
      .with({ session: signupSession! })
      .post('/_/auth/login', { email, password });
    expectOk(login);
    let loginSession = readSessionCookie(login.headers);
    expect(loginSession).toBeTruthy();
    expect(loginSession).not.toBe(signupSession);

    expect((await api.with({ session: signupSession! }).get('/user')).status).toBe(401);
    expect(expectOk(await api.with({ session: loginSession! }).get('/user')).id).toBe(user.id);

    let logout = await api.with({ session: loginSession! }).post('/_/auth/logout');
    expectOk(logout);
    expect(readSessionCookie(logout.headers)).toBe('');

    expect((await api.with({ session: loginSession! }).get('/user')).status).toBe(401);
  });

  it('rejects invalid credentials without setting a session', async () => {
    let api = rest(metorialEndpoints().api);
    let email = uniqueEmail('api-auth-invalid');
    expectOk(
      await api.post('/_/auth/signup', {
        name: 'E2E Auth User',
        email,
        password: 'right-password'
      })
    );

    let wrongPassword = await api.post('/_/auth/login', { email, password: 'wrong-password' });
    expect(wrongPassword.status).toBe(400);
    expect(wrongPassword.body.message).toMatch(/Invalid email or password/);
    expect(readSessionCookie(wrongPassword.headers)).toBeNull();

    let unknownUser = await api.post('/_/auth/login', {
      email: uniqueEmail('api-auth-unknown'),
      password: 'right-password'
    });
    expect(unknownUser.status).toBe(400);
    expect(readSessionCookie(unknownUser.headers)).toBeNull();
  });

  it('validates signup input and rejects duplicate emails', async () => {
    let api = rest(metorialEndpoints().api);
    let email = uniqueEmail('api-auth-dup');

    let shortPassword = await api.post('/_/auth/signup', {
      name: 'E2E Auth User',
      email,
      password: 'short'
    });
    expect(shortPassword.status).toBe(400);
    expect(shortPassword.body.code).toBe('invalid_data');

    let invalidEmail = await api.post('/_/auth/signup', {
      name: 'E2E Auth User',
      email: 'not-an-email',
      password: 'e2e-password-123'
    });
    expect(invalidEmail.status).toBe(400);

    expectOk(
      await api.post('/_/auth/signup', { name: 'First', email, password: 'e2e-password-123' })
    );
    let duplicate = await api.post('/_/auth/signup', {
      name: 'Second',
      email,
      password: 'e2e-password-123'
    });
    expect(duplicate.status).toBe(409);
    expect(readSessionCookie(duplicate.headers)).toBeNull();
  });
});
