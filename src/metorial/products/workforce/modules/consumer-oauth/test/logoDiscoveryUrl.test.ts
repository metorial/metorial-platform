import { describe, expect, it } from 'vitest';
import { getConsumerClientLogoDiscoveryUrl } from '../src/lib/logoDiscoveryUrl';

let discoveryUrl = (redirectUris: string[], clientUri: string | null = null) =>
  getConsumerClientLogoDiscoveryUrl({ clientUri, redirectUris });

describe('getConsumerClientLogoDiscoveryUrl', () => {
  it('uses the origin of a domain redirect uri', () => {
    expect(discoveryUrl(['https://claude.ai/api/mcp/auth_callback'])).toBe(
      'https://claude.ai'
    );
  });

  it('prefers the client uri over redirect uris', () => {
    expect(
      discoveryUrl(['https://callback.example.com/cb'], 'https://example.com/about')
    ).toBe('https://example.com/about');
  });

  it('skips localhost and ip addresses', () => {
    expect(discoveryUrl(['http://localhost:3000/callback'])).toBeNull();
    expect(discoveryUrl(['http://app.localhost/callback'])).toBeNull();
    expect(discoveryUrl(['http://localhost./callback'])).toBeNull();
    expect(discoveryUrl(['http://127.0.0.1:8080/callback'])).toBeNull();
    expect(discoveryUrl(['http://[::1]:8080/callback'])).toBeNull();
    expect(discoveryUrl(['http://[::ffff:7f00:1]/callback'])).toBeNull();
    expect(discoveryUrl(['http://2130706433/callback'])).toBeNull();
  });

  it('skips single label hosts and non http schemes', () => {
    expect(discoveryUrl(['http://intranet/callback'])).toBeNull();
    expect(discoveryUrl(['cursor://anysphere.cursor-mcp/oauth/callback'])).toBeNull();
    expect(discoveryUrl(['vscode://vscode.github-authentication/callback'])).toBeNull();
  });

  it('falls through to the next eligible redirect uri', () => {
    expect(
      discoveryUrl([
        'http://localhost:3000/callback',
        'cursor://anysphere.cursor-mcp/oauth/callback',
        'https://app.example.com/callback'
      ])
    ).toBe('https://app.example.com');
  });

  it('falls back to redirect uris when the client uri is not eligible', () => {
    expect(discoveryUrl(['https://app.example.com/callback'], 'http://localhost:3000')).toBe(
      'https://app.example.com'
    );
  });
});
