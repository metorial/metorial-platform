import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  templateUpdate: vi.fn(),
  templateDelete: vi.fn(),
  backendFindUnique: vi.fn(),
  backendFindMany: vi.fn(),
  backendCreate: vi.fn(),
  backendUpdate: vi.fn(),
  backendDelete: vi.fn(),
  installationCount: vi.fn(),
  writeTemplateSecrets: vi.fn(),
  writeBackendSecrets: vi.fn(),
  readTemplateSecret: vi.fn(),
  discardBackendSecrets: vi.fn(),
  discardNebulaSecrets: vi.fn(),
  discardTemplateSecrets: vi.fn()
}));

vi.mock('../db', () => ({
  db: {
    scmBackendTemplate: { update: mocks.templateUpdate, delete: mocks.templateDelete },
    scmBackend: {
      findUnique: mocks.backendFindUnique,
      findMany: mocks.backendFindMany,
      create: mocks.backendCreate,
      update: mocks.backendUpdate,
      delete: mocks.backendDelete
    },
    scmInstallation: { count: mocks.installationCount }
  }
}));

vi.mock('../id', () => ({ getId: () => ({ id: 'copy-id' }) }));

vi.mock('../lib/scmCredentials', () => ({
  discardBackendSecrets: mocks.discardBackendSecrets,
  discardNebulaSecrets: mocks.discardNebulaSecrets,
  discardTemplateSecrets: mocks.discardTemplateSecrets,
  hasTemplateSecret: (template: Record<string, unknown>, field: string) =>
    !!template[`${field}NebulaSecretId`],
  readTemplateSecret: mocks.readTemplateSecret,
  templateSecretPointers: () => ['template-secret'],
  writeBackendSecrets: mocks.writeBackendSecrets,
  writeTemplateSecrets: mocks.writeTemplateSecrets
}));

let original = { ...process.env };

let service: typeof import('./scmBackendTemplate').scmBackendTemplateService;

let tenant = { oid: 7n } as any;

let template = {
  oid: 3n,
  id: 'osbt_1',
  type: 'github_enterprise',
  name: 'GitHub',
  description: null,
  apiUrl: 'https://git.example.com/api/v3',
  webUrl: 'https://git.example.com',
  appId: 'app',
  appSlug: 'slug',
  clientId: 'client',
  clientSecretNebulaSecretId: 'client-secret',
  appPrivateKeyNebulaSecretId: 'private-key',
  appWebhookSecretNebulaSecretId: null,
  status: 'active',
  version: 2,
  secretVersion: 5
} as any;

beforeAll(async () => {
  process.env.METORIAL_EDITION = 'on-prem';
  service = (await import('./scmBackendTemplate')).scmBackendTemplateService;
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.templateUpdate.mockImplementation(async ({ data }) => ({ ...template, ...data }));
  mocks.backendCreate.mockImplementation(async ({ data }) => data);
  mocks.backendUpdate.mockImplementation(async ({ data }) => data);
  mocks.writeTemplateSecrets.mockResolvedValue({ patch: {}, createdNebulaSecretIds: [] });
  mocks.writeBackendSecrets.mockResolvedValue({
    patch: { clientSecretNebulaSecretId: 'copy-secret' },
    createdNebulaSecretIds: ['copy-secret']
  });
  mocks.readTemplateSecret.mockImplementation(
    async (_: unknown, field: string) => `${field}-value`
  );
});

afterAll(() => {
  process.env = { ...original };
});

describe('updateTemplate', () => {
  it('returns the template untouched when nothing changes', async () => {
    let result = await service.updateTemplate({ template, name: template.name });

    expect(result).toBe(template);
    expect(mocks.templateUpdate).not.toHaveBeenCalled();
    expect(mocks.writeTemplateSecrets).not.toHaveBeenCalled();
  });

  it('bumps only the field version when fields change', async () => {
    await service.updateTemplate({ template, name: 'Renamed' });

    expect(mocks.templateUpdate).toHaveBeenCalledWith({
      where: { oid: template.oid },
      data: expect.objectContaining({
        name: 'Renamed',
        version: { increment: 1 },
        secretVersion: undefined
      })
    });
  });

  it('bumps only the secret version when a secret is rotated', async () => {
    await service.updateTemplate({ template, clientSecret: 'rotated' });

    expect(mocks.templateUpdate).toHaveBeenCalledWith({
      where: { oid: template.oid },
      data: expect.objectContaining({
        version: undefined,
        secretVersion: { increment: 1 }
      })
    });
  });

  it('discards newly created secrets when the update fails', async () => {
    mocks.writeTemplateSecrets.mockResolvedValue({
      patch: {},
      createdNebulaSecretIds: ['fresh']
    });
    mocks.templateUpdate.mockRejectedValue(new Error('db down'));

    await expect(
      service.updateTemplate({ template, appWebhookSecret: 'new' })
    ).rejects.toThrow('db down');
    expect(mocks.discardTemplateSecrets).toHaveBeenCalledWith(['fresh']);
  });
});

describe('replicateTemplate', () => {
  it('creates a copy with its own secrets and the current versions', async () => {
    mocks.backendFindUnique.mockResolvedValue(null);

    await service.replicateTemplate({ tenant, template });

    expect(mocks.writeBackendSecrets).toHaveBeenCalledWith({
      backend: expect.objectContaining({ id: 'copy-id', tenantOid: tenant.oid }),
      secrets: { clientSecret: 'clientSecret-value', appPrivateKey: 'appPrivateKey-value' }
    });
    expect(mocks.backendCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'copy-id',
        tenantOid: tenant.oid,
        templateOid: template.oid,
        templateVersion: 2,
        templateSecretVersion: 5,
        clientSecretNebulaSecretId: 'copy-secret',
        isDefault: false
      })
    });
  });

  it('does not copy archived templates into projects that lack them', async () => {
    mocks.backendFindUnique.mockResolvedValue(null);

    let result = await service.replicateTemplate({
      tenant,
      template: { ...template, status: 'archived' }
    });

    expect(result).toBeNull();
    expect(mocks.backendCreate).not.toHaveBeenCalled();
  });

  it('leaves an up-to-date copy alone', async () => {
    let copy = { oid: 9n, templateVersion: 2, templateSecretVersion: 5 };
    mocks.backendFindUnique.mockResolvedValue(copy);

    expect(await service.replicateTemplate({ tenant, template })).toBe(copy);
    expect(mocks.backendUpdate).not.toHaveBeenCalled();
  });

  it('updates fields without touching secrets when only fields changed', async () => {
    mocks.backendFindUnique.mockResolvedValue({
      oid: 9n,
      templateVersion: 1,
      templateSecretVersion: 5
    });

    await service.replicateTemplate({ tenant, template });

    expect(mocks.writeBackendSecrets).not.toHaveBeenCalled();
    expect(mocks.backendUpdate).toHaveBeenCalledWith({
      where: { oid: 9n },
      data: expect.objectContaining({
        name: template.name,
        templateVersion: 2,
        templateSecretVersion: 5
      })
    });
  });

  it('rewrites secrets on archived copies when the template secrets rotated', async () => {
    let copy = { oid: 9n, templateVersion: 2, templateSecretVersion: 4 };
    mocks.backendFindUnique.mockResolvedValue(copy);

    await service.replicateTemplate({ tenant, template: { ...template, status: 'archived' } });

    expect(mocks.writeBackendSecrets).toHaveBeenCalledWith(
      expect.objectContaining({ backend: copy })
    );
    expect(mocks.backendUpdate).toHaveBeenCalledWith({
      where: { oid: 9n },
      data: expect.objectContaining({
        clientSecretNebulaSecretId: 'copy-secret',
        templateSecretVersion: 5
      })
    });
  });

  it('falls back to the concurrent copy when creation races', async () => {
    let concurrent = { oid: 10n, templateVersion: 2, templateSecretVersion: 5 };
    mocks.backendFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(concurrent);
    mocks.backendCreate.mockRejectedValue(
      Object.assign(new Error('unique'), { code: 'P2002' })
    );

    expect(await service.replicateTemplate({ tenant, template })).toBe(concurrent);
    expect(mocks.discardNebulaSecrets).toHaveBeenCalledWith({
      tenantOid: tenant.oid,
      nebulaSecretIds: ['copy-secret']
    });
  });
});

describe('deleteTemplate', () => {
  it('refuses while projects are connected through a copy', async () => {
    mocks.installationCount.mockResolvedValue(1);

    await expect(service.deleteTemplate({ template })).rejects.toThrow(/Archive it instead/);
    expect(mocks.templateDelete).not.toHaveBeenCalled();
  });

  it('deletes every copy and its secrets before the template', async () => {
    let copy = { oid: 9n };
    mocks.installationCount.mockResolvedValue(0);
    mocks.backendFindMany.mockResolvedValue([copy]);

    await service.deleteTemplate({ template });

    expect(mocks.backendDelete).toHaveBeenCalledWith({ where: { oid: 9n } });
    expect(mocks.discardBackendSecrets).toHaveBeenCalledWith(copy);
    expect(mocks.templateDelete).toHaveBeenCalledWith({ where: { oid: template.oid } });
    expect(mocks.discardTemplateSecrets).toHaveBeenCalledWith(['template-secret']);
  });
});
