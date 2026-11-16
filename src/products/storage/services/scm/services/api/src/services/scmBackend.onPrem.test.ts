import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({ create: vi.fn(), upsert: vi.fn() }));

vi.mock('../db', () => ({
  db: { scmBackend: { create: mocks.create, upsert: mocks.upsert } }
}));
vi.mock('../id', () => ({ getId: () => ({ id: 'configured-backend' }) }));
vi.mock('../env', () => ({
  delegateSecretsToNebula: false,
  env: {
    gh: {
      SCM_GITHUB_APP_ID: 'env-app',
      SCM_GITHUB_APP_SLUG: 'env-slug',
      SCM_GITHUB_APP_CLIENT_ID: 'env-client',
      SCM_GITHUB_APP_CLIENT_SECRET: 'env-secret'
    },
    gl: { SCM_GITLAB_CLIENT_ID: 'env-client', SCM_GITLAB_CLIENT_SECRET: 'env-secret' },
    bb: { SCM_BITBUCKET_CLIENT_ID: 'env-client', SCM_BITBUCKET_CLIENT_SECRET: 'env-secret' }
  },
  SCM_GITHUB_APP_PRIVATE_KEY: 'env-key'
}));

let original = { ...process.env };

let service: typeof import('./scmBackend').scmBackendService;

beforeAll(async () => {
  process.env.METORIAL_EDITION = 'on-prem';
  delete process.env.ORIGIN_SCM_ALLOWED_PROVIDER_TYPES;
  delete process.env.ORIGIN_SCM_ALLOWED_DOMAINS;
  service = (await import('./scmBackend')).scmBackendService;
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockImplementation(async ({ data }) => data);
});

afterAll(() => {
  process.env = { ...original };
});

it('does not provision shared defaults from supplied environment credentials', async () => {
  await service.ensureDefaultBackends();
  expect(mocks.upsert).not.toHaveBeenCalled();
});

it.each([
  ['github', 'https://github.com', 'https://api.github.com'],
  ['gitlab', 'https://gitlab.com', 'https://gitlab.com/api/v4'],
  ['bitbucket', 'https://bitbucket.org', 'https://api.bitbucket.org/2.0'],
  ['github_enterprise', 'https://git.example.com/base', 'https://git.example.com/base/api/v3'],
  ['gitlab_selfhosted', 'https://git.example.com/base', 'https://git.example.com/base/api/v4'],
  [
    'bitbucket_data_center',
    'https://git.example.com/base',
    'https://git.example.com/base/rest/api/1.0'
  ]
] as const)(
  'creates a tenant-owned %s app with canonical endpoints',
  async (type, webUrl, apiUrl) => {
    await service.createScmBackend({
      tenant: { oid: 12n } as any,
      type,
      name: 'Application',
      webUrl,
      apiUrl: 'https://ignored.example.com',
      appId: 'app-id',
      appSlug: 'app-slug',
      appPrivateKey: 'private-key',
      appWebhookSecret: 'webhook-secret',
      clientId: 'client-id',
      clientSecret: 'client-secret'
    });
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type,
        tenantOid: 12n,
        isDefault: false,
        webUrl,
        apiUrl,
        clientId: 'client-id',
        appWebhookSecret: 'webhook-secret'
      })
    });
  }
);

it('requires GitHub App credentials for GitHub.com', async () => {
  await expect(
    service.createScmBackend({
      tenant: { oid: 12n } as any,
      type: 'github',
      name: 'Application',
      webUrl: 'https://github.com',
      apiUrl: 'https://api.github.com',
      clientId: 'client',
      clientSecret: 'secret'
    })
  ).rejects.toThrow(/appId/);
  expect(mocks.create).not.toHaveBeenCalled();
});
