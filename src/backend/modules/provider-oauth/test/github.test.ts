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

describe('templates/github', () => {
  it('should register GitHub template on module load', async () => {
    await import('../src/templates/github');

    expect(mockEnsureTemplate).toHaveBeenCalled();
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    expect(callArgs).toBeDefined();
  });

  it('should configure GitHub with correct slug', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    expect(callArgs?.slug).toBe('github');
  });

  it('should configure GitHub with correct name', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    expect(callArgs?.name).toBe('GitHub');
  });

  it('should include provider details', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    expect(callArgs?.providerName).toBe('GitHub');
    expect(callArgs?.providerUrl).toBe('https://www.github.com');
  });

  it('should include image URL', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    expect(callArgs?.imageUrl).toContain('github.svg');
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

    expect(config.issuer).toBe('https://github.com');
    expect(config.authorization_endpoint).toBe('https://github.com/login/oauth/authorize');
    expect(config.token_endpoint).toBe('https://github.com/login/oauth/access_token');
    expect(config.userinfo_endpoint).toBe('https://api.github.com/user');
  });

  it('should support authorization_code grant type', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    const config = JSON.parse(callArgs?.configJsonata);

    expect(config.grant_types_supported).toContain('authorization_code');
  });

  it('should include scopes', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    expect(callArgs?.scopes).toBeDefined();
    expect(Array.isArray(callArgs?.scopes)).toBe(true);
    expect(callArgs?.scopes.length).toBeGreaterThan(0);
  });

  it('should define repo scope', async () => {
    const callArgs = mockEnsureTemplate.mock.calls[0]?.[0];
    const repoScope = callArgs?.scopes.find((s: any) => s.identifier === 'repo');

    expect(repoScope).toBeDefined();
    expect(repoScope.description).toContain('repositories');
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
});
