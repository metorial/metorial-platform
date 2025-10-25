import { describe, expect, it, vi } from 'vitest';

// Mock the service to avoid database calls
const mockEnsureTemplate = vi.fn();
vi.mock('../src/services', async () => ({
  providerOauthTemplateService: {
    ensureTemplate: mockEnsureTemplate
  },
  providerOauthDiscoveryService: {},
  providerOauthConfigService: {},
  providerOauthConnectionService: {},
  providerOauthTicketService: {}
}));

describe('templates/google', () => {
  it('should register Google template on module load', async () => {
    await import('../src/templates/google');

    expect(mockEnsureTemplate).toHaveBeenCalled();
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    expect(callArgs).toBeDefined();
  });

  it('should configure Google with correct slug', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    expect(callArgs?.slug).toBe('google');
  });

  it('should configure Google with correct name', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    expect(callArgs?.name).toBe('Google');
  });

  it('should include provider details', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    expect(callArgs?.providerName).toBe('Google');
    expect(callArgs?.providerUrl).toBe('https://www.google.com');
  });

  it('should include image URL', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    expect(callArgs?.imageUrl).toContain('google.svg');
    expect(callArgs?.imageUrl).toContain('https://cdn.metorial.com');
  });

  it('should have valid JSON configuration', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    expect(callArgs?.configJsonata).toBeDefined();
    expect(() => JSON.parse(callArgs?.configJsonata)).not.toThrow();
  });

  it('should include OAuth endpoints', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    const config = JSON.parse(callArgs?.configJsonata);

    expect(config.issuer).toBe('https://accounts.google.com');
    expect(config.authorization_endpoint).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(config.token_endpoint).toBe('https://oauth2.googleapis.com/token');
    expect(config.userinfo_endpoint).toBe('https://openidconnect.googleapis.com/v1/userinfo');
  });

  it('should support OpenID Connect', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    const config = JSON.parse(callArgs?.configJsonata);

    expect(config.scopes_supported).toContain('openid');
    expect(config.scopes_supported).toContain('email');
    expect(config.scopes_supported).toContain('profile');
  });

  it('should support PKCE', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    const config = JSON.parse(callArgs?.configJsonata);

    expect(config.code_challenge_methods_supported).toContain('S256');
  });

  it('should include many scopes', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    expect(callArgs?.scopes).toBeDefined();
    expect(Array.isArray(callArgs?.scopes)).toBe(true);
    expect(callArgs?.scopes.length).toBeGreaterThan(30);
  });

  it('should include Gmail scopes', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    const gmailScopes = callArgs?.scopes.filter((s: any) => s.identifier.includes('gmail'));

    expect(gmailScopes.length).toBeGreaterThan(5);
  });

  it('should include Calendar scopes', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    const calendarScopes = callArgs?.scopes.filter((s: any) => s.identifier.includes('calendar'));

    expect(calendarScopes.length).toBeGreaterThan(10);
  });

  it('should include Drive scopes', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    const driveScopes = callArgs?.scopes.filter((s: any) => s.identifier.includes('drive'));

    expect(driveScopes.length).toBeGreaterThan(5);
  });

  it('should have descriptive scope descriptions', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];

    callArgs?.scopes.forEach((scope: any) => {
      expect(scope.identifier).toBeTruthy();
      expect(scope.description).toBeTruthy();
      expect(scope.description.length).toBeGreaterThan(5);
    });
  });

  it('should have unique scope identifiers', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    const identifiers = callArgs?.scopes.map((s: any) => s.identifier);
    const uniqueIdentifiers = new Set(identifiers);

    expect(identifiers.length).toBe(uniqueIdentifiers.size);
  });

  it('should use https URLs for all endpoints', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    const config = JSON.parse(callArgs?.configJsonata);

    const endpoints = [
      config.authorization_endpoint,
      config.token_endpoint,
      config.userinfo_endpoint
    ];

    endpoints.forEach(endpoint => {
      expect(endpoint).toMatch(/^https:\/\//);
    });
  });
});
