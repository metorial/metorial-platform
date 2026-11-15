import { afterEach, describe, expect, it, vi } from 'vitest';
import { socials, type OAuthCredentials } from './socials';

let credentials: OAuthCredentials = {
  clientId: 'client',
  clientSecret: 'secret',
  redirectUri: 'https://example.com/callback'
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('social OAuth email verification', () => {
  it('propagates the Google email verification claim', async () => {
    let fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ access_token: 'access', refresh_token: 'refresh' })
      })
      .mockResolvedValueOnce({
        json: async () => ({
          sub: 'google-user',
          email: 'user@example.com',
          email_verified: false,
          name: 'User',
          picture: 'https://example.com/avatar.png'
        })
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      socials.google.exchangeCodeForData('code', credentials)
    ).resolves.toMatchObject({
      id: 'google-user@google.com',
      email: 'user@example.com',
      emailVerified: false
    });
  });

  it('uses the verified primary GitHub email regardless of array order', async () => {
    let fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        text: async () => JSON.stringify({ access_token: 'access' })
      })
      .mockResolvedValueOnce({
        text: async () =>
          JSON.stringify({
            id: 'github-user',
            email: 'unverified@example.com',
            name: 'User',
            avatar_url: 'https://example.com/avatar.png',
            login: 'user'
          })
      })
      .mockResolvedValueOnce({
        text: async () =>
          JSON.stringify([
            { email: 'victim@example.com', primary: false, verified: false },
            { email: 'attacker@example.com', primary: true, verified: true }
          ])
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      socials.github.exchangeCodeForData('code', credentials)
    ).resolves.toMatchObject({
      email: 'attacker@example.com',
      emailVerified: true
    });
  });

  it('propagates an unverified primary GitHub email for Ares verification', async () => {
    let fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        text: async () => JSON.stringify({ access_token: 'access' })
      })
      .mockResolvedValueOnce({
        text: async () =>
          JSON.stringify({
            id: 'github-user',
            email: 'unverified@example.com',
            name: 'User',
            avatar_url: 'https://example.com/avatar.png',
            login: 'user'
          })
      })
      .mockResolvedValueOnce({
        text: async () =>
          JSON.stringify([
            { email: 'unverified@example.com', primary: true, verified: false }
          ])
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      socials.github.exchangeCodeForData('code', credentials)
    ).resolves.toMatchObject({
      email: 'unverified@example.com',
      emailVerified: false
    });
  });

  it('does not fall back to the first GitHub email when none is primary', async () => {
    let fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        text: async () => JSON.stringify({ access_token: 'access' })
      })
      .mockResolvedValueOnce({
        text: async () =>
          JSON.stringify({
            id: 'github-user',
            email: 'victim@example.com',
            name: 'User',
            avatar_url: 'https://example.com/avatar.png',
            login: 'user'
          })
      })
      .mockResolvedValueOnce({
        text: async () =>
          JSON.stringify([
            { email: 'victim@example.com', primary: false, verified: false },
            { email: 'attacker@example.com', primary: false, verified: true }
          ])
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      socials.github.exchangeCodeForData('code', credentials)
    ).rejects.toThrow('No primary email');
  });
});
