import { beforeEach, describe, expect, it, vi } from 'vitest';

let webhookRegistrationCreate = vi.fn();
let webhookRegistrationUpdate = vi.fn();
let webhookRegistrationFindFirst = vi.fn();
let providerFindFirst = vi.fn();

let backendCallbacks = {
  createWebhookRegistration: vi.fn(),
  finishWebhookRegistrationSetup: vi.fn(),
  updateWebhookRegistration: vi.fn(),
  deleteWebhookRegistration: vi.fn(),
  listWebhookEvents: vi.fn(),
  getWebhookEvent: vi.fn()
};

vi.mock('@metorial-subspace/db', () => ({
  db: {
    webhookRegistration: {
      create: webhookRegistrationCreate,
      update: webhookRegistrationUpdate,
      findFirst: webhookRegistrationFindFirst
    },
    provider: {
      findFirst: providerFindFirst
    }
  },
  getId: (model: string) => ({ oid: BigInt(100), id: `${model}_id` })
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: factory })
  }
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: async () => ({ oid: 3, id: 'solution_1' }),
  resolveMetorialFacing: async () => ({
    tenant: { oid: BigInt(1), id: 'tenant_1', projectOid: BigInt(11) },
    environment: { oid: BigInt(2), id: 'environment_1', instanceOid: BigInt(22) },
    solution: { oid: 3, id: 'solution_1' }
  }),
  toProviderEventBase: () => ({ instance: { oid: BigInt(22) } })
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  normalizeDateFilter: (f: unknown) => f,
  normalizeStatusForGet: () => ({ noParent: {} }),
  normalizeStatusForList: () => ({ noParent: {} }),
  resolveProviders: async (_selector: unknown, ids?: string[] | null) =>
    ids ? { oids: [BigInt(7)], in: { in: [BigInt(7)] } } : undefined
}));

vi.mock('@metorial-subspace/provider', () => ({
  getBackend: async () => ({ callbacks: backendCallbacks })
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

let triggerAttributes = (webhookRegistrationStatus: 'supported' | 'unsupported') => ({
  triggers: {
    status: 'enabled',
    webhookRegistration: { status: webhookRegistrationStatus }
  }
});

let activeProvider = (webhookRegistrationStatus: 'supported' | 'unsupported') => ({
  oid: BigInt(7),
  id: 'pro_1',
  name: 'GitHub',
  type: { attributes: triggerAttributes(webhookRegistrationStatus) },
  defaultVariant: { oid: BigInt(8), id: 'prv_1', backendOid: BigInt(9) }
});

let registration = (overrides: Record<string, unknown> = {}) => ({
  oid: BigInt(100),
  id: 'whr_1',
  status: 'awaiting_setup',
  name: 'Production Webhook',
  description: null,
  metadata: null,
  receiveUrl: null,
  setup: null,
  archivedAt: null,
  provider: { id: 'pro_1', name: 'GitHub' },
  providerVariant: { oid: BigInt(8), backendOid: BigInt(9) },
  ...overrides
});

let instance = { oid: BigInt(22), id: 'ins_1' } as any;

describe('webhookRegistrationService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    webhookRegistrationCreate.mockResolvedValue(registration());
    webhookRegistrationUpdate.mockImplementation(async ({ data }: any) => registration(data));
    backendCallbacks.createWebhookRegistration.mockResolvedValue({
      receiveUrl: 'https://triggers.metorial.com/w/abc',
      setup: { document: 'Paste the URL into GitHub.' }
    });
    backendCallbacks.finishWebhookRegistrationSetup.mockResolvedValue({
      receiveUrl: 'https://triggers.metorial.com/w/abc'
    });
    backendCallbacks.updateWebhookRegistration.mockResolvedValue({});
  });

  it('rejects providers whose type does not support webhook registration', async () => {
    providerFindFirst.mockResolvedValue(activeProvider('unsupported'));

    let { webhookRegistrationService } = await import('./webhookRegistration');

    await expect(
      webhookRegistrationService.createWebhookRegistration({
        instance,
        provider: { id: 'pro_1' },
        input: { name: 'Production Webhook' }
      })
    ).rejects.toThrow(/does not support registering webhook receivers/);

    expect(webhookRegistrationCreate).not.toHaveBeenCalled();
  });

  it('pins the provider variant and stores the receive url returned by the backend', async () => {
    providerFindFirst.mockResolvedValue(activeProvider('supported'));

    let { webhookRegistrationService } = await import('./webhookRegistration');

    await webhookRegistrationService.createWebhookRegistration({
      instance,
      provider: { id: 'pro_1' },
      input: { name: 'Production Webhook' }
    });

    expect(webhookRegistrationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'awaiting_setup',
          providerOid: BigInt(7),
          providerVariantOid: BigInt(8),
          tenantOid: BigInt(1),
          projectOid: BigInt(11),
          environmentOid: BigInt(2),
          instanceOid: BigInt(22)
        })
      })
    );

    expect(webhookRegistrationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          receiveUrl: 'https://triggers.metorial.com/w/abc',
          setup: { document: 'Paste the URL into GitHub.' }
        }
      })
    );
  });

  it('abandons the row when the backend fails to create the receiver', async () => {
    providerFindFirst.mockResolvedValue(activeProvider('supported'));
    backendCallbacks.createWebhookRegistration.mockRejectedValue(new Error('slates down'));

    let { webhookRegistrationService } = await import('./webhookRegistration');

    await expect(
      webhookRegistrationService.createWebhookRegistration({
        instance,
        provider: { id: 'pro_1' },
        input: { name: 'Production Webhook' }
      })
    ).rejects.toThrow('slates down');

    expect(webhookRegistrationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'deleted' } })
    );
  });

  it('activates a registration once setup is finished', async () => {
    let { webhookRegistrationService } = await import('./webhookRegistration');

    await webhookRegistrationService.finishWebhookRegistrationSetup({
      instance,
      webhookRegistration: registration() as any,
      input: { userConfig: { signing_secret: 'whsec_1' } }
    });

    expect(backendCallbacks.finishWebhookRegistrationSetup).toHaveBeenCalledWith(
      expect.objectContaining({ userConfig: { signing_secret: 'whsec_1' } })
    );
    expect(webhookRegistrationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: 'active',
          receiveUrl: 'https://triggers.metorial.com/w/abc'
        }
      })
    );
  });

  it('refuses to run setup twice', async () => {
    let { webhookRegistrationService } = await import('./webhookRegistration');

    await expect(
      webhookRegistrationService.finishWebhookRegistrationSetup({
        instance,
        webhookRegistration: registration({ status: 'active' }) as any,
        input: { userConfig: {} }
      })
    ).rejects.toThrow(/not awaiting setup/);

    expect(backendCallbacks.finishWebhookRegistrationSetup).not.toHaveBeenCalled();
  });

  it('propagates updates to the provider backend before writing them locally', async () => {
    let { webhookRegistrationService } = await import('./webhookRegistration');

    await webhookRegistrationService.updateWebhookRegistration({
      instance,
      webhookRegistration: registration({ status: 'active' }) as any,
      input: { name: 'Staging Webhook', description: null }
    });

    expect(backendCallbacks.updateWebhookRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { name: 'Staging Webhook', description: null }
      })
    );
    expect(webhookRegistrationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Staging Webhook', description: null, metadata: undefined }
      })
    );
  });

  it('refuses to update an archived registration', async () => {
    let { webhookRegistrationService } = await import('./webhookRegistration');

    await expect(
      webhookRegistrationService.updateWebhookRegistration({
        instance,
        webhookRegistration: registration({ status: 'archived' }) as any,
        input: { name: 'Staging Webhook' }
      })
    ).rejects.toThrow(/archived webhook registration cannot be updated/);

    expect(backendCallbacks.updateWebhookRegistration).not.toHaveBeenCalled();
  });

  it('archives with a timestamp and is idempotent', async () => {
    let { webhookRegistrationService } = await import('./webhookRegistration');

    await webhookRegistrationService.archiveWebhookRegistration({
      instance,
      webhookRegistration: registration({ status: 'active' }) as any
    });

    expect(webhookRegistrationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'archived', archivedAt: expect.any(Date) })
      })
    );

    webhookRegistrationUpdate.mockClear();

    await webhookRegistrationService.archiveWebhookRegistration({
      instance,
      webhookRegistration: registration({ status: 'archived' }) as any
    });

    expect(webhookRegistrationUpdate).not.toHaveBeenCalled();
  });

  it('scopes gets to the tenant, solution and environment', async () => {
    webhookRegistrationFindFirst.mockResolvedValue(registration());

    let { webhookRegistrationService } = await import('./webhookRegistration');

    await webhookRegistrationService.getWebhookRegistrationById({
      instance,
      webhookRegistrationId: 'whr_1'
    });

    expect(webhookRegistrationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'whr_1',
          tenantOid: BigInt(1),
          solutionOid: 3,
          environmentOid: BigInt(2)
        })
      })
    );
  });

  it('reports a missing registration as not found', async () => {
    webhookRegistrationFindFirst.mockResolvedValue(null);

    let { webhookRegistrationService } = await import('./webhookRegistration');

    await expect(
      webhookRegistrationService.getWebhookRegistrationById({
        instance,
        webhookRegistrationId: 'whr_missing'
      })
    ).rejects.toThrow();
  });
});
