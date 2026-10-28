import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  resolveSlug: vi.fn(),
  isNamespaceHostAllowed: vi.fn(),
  authenticateAccessToken: vi.fn(),
  recordUse: vi.fn(),
  ensureGrantSession: vi.fn(),
  findInstance: vi.fn(),
  handleMcpRequest: vi.fn()
}));

vi.mock('@lowerdeck/sentry', () => ({
  getSentry: () => ({ captureException: vi.fn() })
}));

vi.mock('@lowerdeck/execution-context', () => ({
  createExecutionContext: (context: unknown) => context,
  provideExecutionContext: async (_context: unknown, callback: () => Promise<unknown>) =>
    callback()
}));

vi.mock('@metorial-subspace/module-public-mcp', async () => ({
  ...(await import('../../../products/integrations/modules/public-mcp/src/lib/oauthError')),
  PUBLIC_MCP_SCOPE: 'mcp',
  getPublicMcpBindingCookieName: vi.fn(),
  presentClientRegistration: vi.fn(),
  createPublicMcpGrantAccess: vi.fn(() => ({ type: 'public_mcp_grant' })),
  publicMcpRouteService: {
    resolveSlug: mocks.resolveSlug,
    isNamespaceHostAllowed: mocks.isNamespaceHostAllowed
  },
  publicMcpServerAuthorizationService: {},
  publicMcpServerClientService: {},
  publicMcpServerGrantService: {
    recordUse: mocks.recordUse,
    ensureGrantSession: mocks.ensureGrantSession
  },
  publicMcpServerTokenService: { authenticateAccessToken: mocks.authenticateAccessToken }
}));

vi.mock('@metorial/config', () => ({
  getConfig: () => ({
    urls: {
      apiUrl: 'https://api.metorial.test',
      publicMcpUrl: 'https://mcp.metorial.test'
    }
  })
}));

vi.mock('@metorial/db', () => ({
  db: { instance: { findUniqueOrThrow: mocks.findInstance } }
}));

vi.mock('@metorial/id', () => ({
  generateSnowflakeId: () => 'mreq_1'
}));

vi.mock('../src/mcp', () => ({ handleMcpRequest: mocks.handleMcpRequest }));

vi.mock('../src/outpost', () => ({
  getOutpostAuth: () => undefined,
  resolveOutpostOrigin: () => undefined,
  useConnectionRequestContext: () => ({ ip: '127.0.0.1', ua: 'test' })
}));

import { PublicMcpOAuthError } from '../../../products/integrations/modules/public-mcp/src/lib/oauthError';
import { createPublicMcpHandler } from '../src/public';

let browserHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document'
};

let server = {
  name: 'Acme CRM',
  description: 'Connect your contacts and deals.',
  slug: 'acme-crm',
  status: 'active',
  instanceOid: 1n,
  provider: { name: 'Acme' }
};

let request = (d: { path?: string; headers?: HeadersInit; method?: string } = {}) => {
  let app = createPublicMcpHandler().connectPublicServer;

  return app.request(`https://api.metorial.test/${d.path ?? 'acme-crm'}`, {
    method: d.method ?? 'GET',
    headers: d.headers ?? browserHeaders
  });
};

describe('public MCP browser installation page', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.resolveSlug.mockResolvedValue(server);
    mocks.isNamespaceHostAllowed.mockResolvedValue(true);
    mocks.authenticateAccessToken.mockRejectedValue(
      new PublicMcpOAuthError('invalid_token', 'Authentication required')
    );
  });

  it('serves the approved page before authentication without creating a session', async () => {
    let response = await request();
    let body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Vary')).toContain('User-Agent');
    expect(body).toContain('Connect to Acme CRM');
    expect(body).toContain('Connect your contacts and deals.');
    expect(body).toContain('https://api.metorial.test/connect/public/acme-crm');
    expect(body).not.toContain('Using Another Client?');
    expect(body).not.toContain('Public MCP Server');
    expect(body).not.toContain('Authorization: Bearer');

    for (let name of [
      'Cursor',
      'Claude Code',
      'Codex',
      'Gemini CLI',
      'Visual Studio',
      'Windsurf'
    ]) {
      expect(body).toContain(name);
    }

    expect(mocks.authenticateAccessToken).not.toHaveBeenCalled();
    expect(mocks.recordUse).not.toHaveBeenCalled();
    expect(mocks.ensureGrantSession).not.toHaveBeenCalled();
    expect(mocks.findInstance).not.toHaveBeenCalled();
    expect(mocks.handleMcpRequest).not.toHaveBeenCalled();
  });

  it('allows the rendered script and styles with exact CSP hashes', async () => {
    let response = await request();
    let body = await response.text();
    let policy = response.headers.get('Content-Security-Policy');

    for (let tag of ['script', 'style']) {
      let contents = body.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1];
      expect(contents).toBeDefined();

      let hash = createHash('sha256').update(contents!).digest('base64');
      expect(policy).toContain(`${tag}-src 'sha256-${hash}'`);
    }

    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain('unsafe-inline');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('supports browsers without fetch metadata headers', async () => {
    let response = await request({
      headers: { 'User-Agent': browserHeaders['User-Agent'], Accept: 'text/html' }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
  });

  it.each([
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
  ])('recognizes a browser UA: %s', async userAgent => {
    let response = await request({ headers: { ...browserHeaders, 'User-Agent': userAgent } });

    expect(response.status).toBe(200);
    expect(mocks.authenticateAccessToken).not.toHaveBeenCalled();
  });

  it('returns browser HEAD headers without a response body or session side effects', async () => {
    let response = await request({ method: 'HEAD' });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(await response.text()).toBe('');
    expect(mocks.ensureGrantSession).not.toHaveBeenCalled();
  });

  it('uses the trusted public origin and excludes query parameters from install instructions', async () => {
    let response = await request({
      path: 'acme-crm?key=secret&tracking=1',
      headers: { ...browserHeaders, 'Metorial-Public-Mcp-Origin': 'https://mcp.metorial.test' }
    });
    let body = await response.text();

    expect(body).toContain('https://mcp.metorial.test/acme-crm');
    expect(body).not.toContain('https://api.metorial.test/connect/public/acme-crm');
    expect(body).not.toContain('secret');
    expect(body).not.toContain('tracking=1');
  });

  it('uses an allowed namespace host in all instructions', async () => {
    let response = await request({
      headers: { ...browserHeaders, 'Metorial-Namespace-Host': 'acme.metorial.test' }
    });
    let body = await response.text();

    expect(body).toContain('https://acme.metorial.test/connect/public/acme-crm');
    expect(mocks.isNamespaceHostAllowed).toHaveBeenCalledWith({
      publicMcpServer: server,
      namespaceHost: 'acme.metorial.test'
    });
  });

  it('escapes names and descriptions without adding executable markup', async () => {
    mocks.resolveSlug.mockResolvedValue({
      ...server,
      name: '</script><script>alert(1)</script>',
      description: '<img src=x onerror=alert(1)>',
      provider: { name: '<iframe src=evil>' }
    });

    let response = await request();
    let body = await response.text();

    expect(body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(body).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(body).toContain('&lt;iframe src=evil&gt;');
    expect(body.match(/<script>/g)).toHaveLength(1);
    expect(body).not.toContain('<img src=x');
  });

  it('shows a friendly 404 while retaining the edge routing-miss header', async () => {
    mocks.resolveSlug.mockResolvedValue(null);

    let response = await request();

    expect(response.status).toBe(404);
    expect(response.headers.get('Metorial-Public-Mcp-Miss')).toBe('1');
    expect(await response.text()).toContain('Server Not Found');
    expect(mocks.authenticateAccessToken).not.toHaveBeenCalled();
  });

  it('rejects an unauthorized namespace without a routing-miss header', async () => {
    mocks.isNamespaceHostAllowed.mockResolvedValue(false);

    let response = await request({
      headers: { ...browserHeaders, 'Metorial-Namespace-Host': 'other.metorial.test' }
    });

    expect(response.status).toBe(404);
    expect(response.headers.has('Metorial-Public-Mcp-Miss')).toBe(false);
    expect(await response.text()).not.toContain('Choose Your Client');
  });

  it('shows an unavailable page without installation instructions for a disabled server', async () => {
    mocks.resolveSlug.mockResolvedValue({ ...server, status: 'disabled' });

    let response = await request();
    let body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toContain('Server Unavailable');
    expect(body).not.toContain('Choose Your Client');
    expect(mocks.ensureGrantSession).not.toHaveBeenCalled();
  });

  it.each([
    { headers: { 'User-Agent': 'curl/8.0', Accept: 'text/html' } },
    { headers: { Accept: 'text/html' } },
    { headers: { ...browserHeaders, Accept: '*/*' } },
    { headers: { ...browserHeaders, Accept: 'application/json' } },
    { headers: { ...browserHeaders, Accept: 'text/html;q=0' } },
    { headers: { ...browserHeaders, Accept: 'text/html,text/event-stream' } },
    { headers: { ...browserHeaders, 'Sec-Fetch-Mode': 'cors' } },
    { headers: { ...browserHeaders, 'Sec-Fetch-Dest': 'empty' } },
    { headers: { ...browserHeaders, 'Mcp-Session-Id': 'session_1' } },
    { headers: { ...browserHeaders, 'Mcp-Protocol-Version': '2025-03-26' } },
    { headers: { ...browserHeaders, 'Last-Event-ID': 'event_1' } },
    { headers: { ...browserHeaders, Authorization: 'Bearer secret' } },
    { path: 'acme-crm?connection_token=secret' },
    { method: 'POST' },
    { method: 'DELETE' },
    { method: 'OPTIONS' }
  ])('keeps protocol traffic on the authentication path: %j', async input => {
    let response = await request(input);

    expect(response.status).toBe(401);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(response.headers.get('WWW-Authenticate')).toContain('resource_metadata=');
    expect(mocks.authenticateAccessToken).toHaveBeenCalledOnce();
    expect(mocks.ensureGrantSession).not.toHaveBeenCalled();
  });

  it('continues handling an authenticated MCP request with a browser user agent', async () => {
    mocks.authenticateAccessToken.mockResolvedValue({
      client: { clientName: 'Browser MCP client', id: 'client_1', clientId: 'oauth_1' }
    });
    mocks.ensureGrantSession.mockResolvedValue({ id: 'session_1', oid: 2n });
    mocks.findInstance.mockResolvedValue({ id: 'instance_1' });
    mocks.handleMcpRequest.mockResolvedValue(new Response('protocol response'));

    let response = await request({
      method: 'POST',
      headers: { ...browserHeaders, Authorization: 'Bearer secret' }
    });

    expect(await response.text()).toBe('protocol response');
    expect(mocks.authenticateAccessToken).toHaveBeenCalledWith({
      route: server,
      token: 'secret'
    });
    expect(mocks.recordUse).toHaveBeenCalledOnce();
    expect(mocks.handleMcpRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sessionId: 'session_1',
        publicBaseUrl: 'https://api.metorial.test/connect/public/acme-crm'
      })
    );
  });

  it('continues serving OAuth metadata as JSON to browser navigations', async () => {
    let response = await request({ path: 'acme-crm/.well-known/oauth-authorization-server' });

    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.json()).toMatchObject({
      issuer: 'https://api.metorial.test/connect/public/acme-crm'
    });
    expect(mocks.authenticateAccessToken).not.toHaveBeenCalled();
  });
});
