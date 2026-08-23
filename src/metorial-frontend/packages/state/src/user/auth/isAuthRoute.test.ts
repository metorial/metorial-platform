import { describe, expect, test } from 'vitest';
import { isAuthRoute } from './isAuthRoute';

let auth = {
  loginPath: '/login',
  logoutPath: '/logout',
  signupPath: '/signup'
};

describe('isAuthRoute', () => {
  test('recognizes a configured login route with a nested redirect query', () => {
    expect(
      isAuthRoute(
        'http://localhost:3103/login?redirect_uri=http%3A%2F%2Flocalhost%3A3103%2F',
        auth
      )
    ).toBe(true);
  });

  test('does not treat an application route as an auth route', () => {
    expect(isAuthRoute('http://localhost:3103/users', auth)).toBe(false);
  });

  test('only recognizes auth routes hosted on the current origin', () => {
    expect(
      isAuthRoute('http://localhost:3103/login', {
        ...auth,
        authFrontendUrl: 'http://localhost:52120'
      })
    ).toBe(false);
  });

  test('treats an empty authFrontendUrl as the current origin', () => {
    expect(
      isAuthRoute('http://localhost:3103/login', {
        ...auth,
        authFrontendUrl: ''
      })
    ).toBe(true);
  });
});
