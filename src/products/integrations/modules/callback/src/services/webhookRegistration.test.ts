import { conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let webhookRegistrationCreate = vi.fn();
let webhookRegistrationUpdate = vi.fn();
let webhookRegistrationFindFirst = vi.fn();
let webhookRegistrationFindMany = vi.fn();
let providerFindFirst = vi.fn();
let deleteQueueAdd = vi.fn();
let getProviderAuthCredentialsByIdInternal = vi.fn();
let getManyProviderAuthCredentialsByIdsInternal = vi.fn();

let backendCallbacks = {
  createWebhookRegistration: vi.fn(),
  finishWebhookRegistrationSetup: vi.fn(),
  updateWebhookRegistration: vi.fn(),
  deleteWebhookRegistration: vi.fn(),
  listDeliverySetupsServingAuthCredentials: vi.fn(),
  listWebhookEvents: vi.fn(),
  getWebhookEvent: vi.fn()
};

vi.mock('@metorial-subspace/db', () => ({
  db: {
    webhookRegistration: {
      create: webhookRegistrationCreate,
      update: webhookRegistrationUpdate,
      findFirst: webhookRegistrationFindFirst,
      findMany: webhookRegistrationFindMany
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

vi.mock('@metorial-subspace/module-auth', () => ({
  providerAuthCredentialsService: {
    getProviderAuthCredentialsByIdInternal,
    getManyProviderAuthCredentialsByIdsInternal
  }
}));

vi.mock('@metorial-subspace/provider', () => ({
  getBackend: async () => ({ callbacks: backendCallbacks })
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('../queues/delete/webhookRegistration', () => ({
  webhookRegistrationDeleteQueue: { add: deleteQueueAdd }
}));

let triggerAttributes = (
  webhookRegistrationStatus: 'supported' | 'unsupported',
  purpose?: 'delivery_setup'
) => ({
  triggers: {
    status: 'enabled',
    webhookRegistration: { status: webhookRegistrationStatus, ...(purpose ? { purpose } : {}) }
  }
});

let activeProvider = (
  webhookRegistrationStatus: 'supported' | 'unsupported',
  purpose?: 'delivery_setup'
) => ({
  oid: BigInt(7),
  id: 'pro_1',
  name: 'GitHub',
  type: { attributes: triggerAttributes(webhookRegistrationStatus, purpose) },
  defaultVariant: { oid: BigInt(8), id: 'prv_1', backendOid: BigInt(9) }
});

let ownCredentials = (overrides: Record<string, unknown> = {}) => ({
  oid: BigInt(40),
  id: 'par_1',
  providerOid: BigInt(7),
  origin: 'tenant_created',
  status: 'active',
  ...overrides
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

  it('creates a webhook receiver without credentials', async () => {
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
          purpose: 'webhook_receiver',
          authCredentialsOid: undefined
        })
      })
    );
    expect(backendCallbacks.createWebhookRegistration).toHaveBeenCalledWith(
      expect.objectContaining({ authCredentials: null })
    );
    expect(getProviderAuthCredentialsByIdInternal).not.toHaveBeenCalled();
  });

  it('rejects credentials for a webhook receiver', async () => {
    providerFindFirst.mockResolvedValue(activeProvider('supported'));

    let { webhookRegistrationService } = await import('./webhookRegistration');

    await expect(
      webhookRegistrationService.createWebhookRegistration({
        instance,
        provider: { id: 'pro_1' },
        authCredentials: { id: 'par_1' },
        input: { name: 'Production Webhook' }
      })
    ).rejects.toMatchObject({
      data: { code: 'auth_credentials_not_applicable', status: 400 }
    });

    expect(webhookRegistrationCreate).not.toHaveBeenCalled();
  });

  it('creates a delivery setup for the OAuth credentials it names', async () => {
    providerFindFirst.mockResolvedValue(activeProvider('supported', 'delivery_setup'));
    getProviderAuthCredentialsByIdInternal.mockResolvedValue(ownCredentials());

    let { webhookRegistrationService } = await import('./webhookRegistration');

    await webhookRegistrationService.createWebhookRegistration({
      instance,
      provider: { id: 'pro_1' },
      authCredentials: { id: 'par_1' },
      input: { name: 'Gmail Delivery Setup' }
    });

    expect(getProviderAuthCredentialsByIdInternal).toHaveBeenCalledWith({
      tenant: expect.objectContaining({ oid: BigInt(1) }),
      environment: expect.objectContaining({ oid: BigInt(2) }),
      providerAuthCredentialsId: 'par_1'
    });
    expect(webhookRegistrationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'awaiting_setup',
          purpose: 'delivery_setup',
          providerOid: BigInt(7),
          authCredentialsOid: BigInt(40)
        })
      })
    );
    expect(backendCallbacks.createWebhookRegistration).toHaveBeenCalledWith(
      expect.objectContaining({ authCredentials: ownCredentials() })
    );
  });

  it('requires credentials for a delivery setup', async () => {
    providerFindFirst.mockResolvedValue(activeProvider('supported', 'delivery_setup'));

    let { webhookRegistrationService } = await import('./webhookRegistration');

    await expect(
      webhookRegistrationService.createWebhookRegistration({
        instance,
        provider: { id: 'pro_1' },
        input: { name: 'Gmail Delivery Setup' }
      })
    ).rejects.toMatchObject({ data: { code: 'auth_credentials_required', status: 400 } });

    expect(webhookRegistrationCreate).not.toHaveBeenCalled();
  });

  it('reports unknown credentials as not found', async () => {
    providerFindFirst.mockResolvedValue(activeProvider('supported', 'delivery_setup'));
    getProviderAuthCredentialsByIdInternal.mockRejectedValue(
      new ServiceError(notFoundError('provider.auth_credentials', 'par_missing'))
    );

    let { webhookRegistrationService } = await import('./webhookRegistration');

    await expect(
      webhookRegistrationService.createWebhookRegistration({
        instance,
        provider: { id: 'pro_1' },
        authCredentials: { id: 'par_missing' },
        input: { name: 'Gmail Delivery Setup' }
      })
    ).rejects.toMatchObject({ data: { code: 'not_found', status: 404 } });

    expect(webhookRegistrationCreate).not.toHaveBeenCalled();
  });

  it.each([
    ['auth_credentials_provider_mismatch', { providerOid: BigInt(99) }],
    ['auth_credentials_managed', { origin: 'managed_backing' }],
    ['auth_credentials_inactive', { status: 'archived' }]
  ])('rejects credentials with %s', async (code, overrides) => {
    providerFindFirst.mockResolvedValue(activeProvider('supported', 'delivery_setup'));
    getProviderAuthCredentialsByIdInternal.mockResolvedValue(ownCredentials(overrides));

    let { webhookRegistrationService } = await import('./webhookRegistration');

    await expect(
      webhookRegistrationService.createWebhookRegistration({
        instance,
        provider: { id: 'pro_1' },
        authCredentials: { id: 'par_1' },
        input: { name: 'Gmail Delivery Setup' }
      })
    ).rejects.toMatchObject({ data: { code, status: 400 } });

    expect(webhookRegistrationCreate).not.toHaveBeenCalled();
  });

  it('abandons the row and reports the conflict when the OAuth app already has a setup', async () => {
    providerFindFirst.mockResolvedValue(activeProvider('supported', 'delivery_setup'));
    getProviderAuthCredentialsByIdInternal.mockResolvedValue(ownCredentials());
    backendCallbacks.createWebhookRegistration.mockRejectedValue(
      new ServiceError(conflictError({ code: 'delivery_setup_already_exists' }))
    );

    let { webhookRegistrationService } = await import('./webhookRegistration');

    await expect(
      webhookRegistrationService.createWebhookRegistration({
        instance,
        provider: { id: 'pro_1' },
        authCredentials: { id: 'par_1' },
        input: { name: 'Gmail Delivery Setup' }
      })
    ).rejects.toMatchObject({ data: { code: 'delivery_setup_already_exists', status: 409 } });

    expect(webhookRegistrationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { oid: BigInt(100) }, data: { status: 'deleted' } })
    );
  });

  it('lists a setup created for another credentials record of the same OAuth app', async () => {
    let sameApp = ownCredentials({ oid: BigInt(41), id: 'par_2', backendOid: BigInt(9) });
    getManyProviderAuthCredentialsByIdsInternal.mockResolvedValue([sameApp]);
    backendCallbacks.listDeliverySetupsServingAuthCredentials.mockResolvedValue({
      webhookRegistrationOids: [BigInt(100)]
    });
    webhookRegistrationFindMany.mockResolvedValue([]);

    let { webhookRegistrationService } = await import('./webhookRegistration');

    let paginator = await webhookRegistrationService.listWebhookRegistrations({
      instance,
      providerIds: ['pro_1'],
      authCredentialsIds: ['par_2']
    });
    await paginator.run({});

    expect(getManyProviderAuthCredentialsByIdsInternal).toHaveBeenCalledWith({
      tenant: expect.objectContaining({ oid: BigInt(1) }),
      environment: expect.objectContaining({ oid: BigInt(2) }),
      ids: ['par_2']
    });
    expect(backendCallbacks.listDeliverySetupsServingAuthCredentials).toHaveBeenCalledWith({
      tenant: expect.objectContaining({ oid: BigInt(1) }),
      authCredentials: [sameApp]
    });
    expect(webhookRegistrationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantOid: BigInt(1),
          environmentOid: BigInt(2),
          AND: expect.arrayContaining([{ oid: { in: [BigInt(100)] } }])
        })
      })
    );
  });

  it('asks each backend about its own credentials', async () => {
    let slatesCredentials = ownCredentials({ backendOid: BigInt(9) });
    let otherCredentials = ownCredentials({
      oid: BigInt(42),
      id: 'par_3',
      providerOid: BigInt(17),
      backendOid: BigInt(19)
    });
    getManyProviderAuthCredentialsByIdsInternal.mockResolvedValue([
      slatesCredentials,
      otherCredentials
    ]);
    backendCallbacks.listDeliverySetupsServingAuthCredentials
      .mockResolvedValueOnce({ webhookRegistrationOids: [BigInt(100)] })
      .mockResolvedValueOnce({ webhookRegistrationOids: [BigInt(101)] });
    webhookRegistrationFindMany.mockResolvedValue([]);

    let { webhookRegistrationService } = await import('./webhookRegistration');

    let paginator = await webhookRegistrationService.listWebhookRegistrations({
      instance,
      authCredentialsIds: ['par_1', 'par_3']
    });
    await paginator.run({});

    expect(
      backendCallbacks.listDeliverySetupsServingAuthCredentials.mock.calls.map(
        ([call]: any) => call.authCredentials
      )
    ).toEqual([[slatesCredentials], [otherCredentials]]);
    expect(webhookRegistrationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ oid: { in: [BigInt(100), BigInt(101)] } }])
        })
      })
    );
  });

  it('matches nothing for credentials that do not resolve', async () => {
    getManyProviderAuthCredentialsByIdsInternal.mockResolvedValue([]);
    webhookRegistrationFindMany.mockResolvedValue([]);

    let { webhookRegistrationService } = await import('./webhookRegistration');

    let paginator = await webhookRegistrationService.listWebhookRegistrations({
      instance,
      authCredentialsIds: ['par_unknown']
    });
    await paginator.run({});

    expect(backendCallbacks.listDeliverySetupsServingAuthCredentials).not.toHaveBeenCalled();
    expect(webhookRegistrationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ oid: { in: [] } }])
        })
      })
    );
  });

  it('applies no credentials filter when none is given', async () => {
    webhookRegistrationFindMany.mockResolvedValue([]);

    let { webhookRegistrationService } = await import('./webhookRegistration');

    let paginator = await webhookRegistrationService.listWebhookRegistrations({ instance });
    await paginator.run({});

    expect(getManyProviderAuthCredentialsByIdsInternal).not.toHaveBeenCalled();
    expect(webhookRegistrationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ AND: [] }) })
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

  it('removes the backend registration through the delete queue when archiving', async () => {
    let { webhookRegistrationService } = await import('./webhookRegistration');

    let archived = await webhookRegistrationService.archiveWebhookRegistration({
      instance,
      webhookRegistration: registration({ status: 'active' }) as any
    });

    expect(archived.status).toBe('archived');
    expect(deleteQueueAdd).toHaveBeenCalledTimes(1);
    expect(deleteQueueAdd).toHaveBeenCalledWith({ webhookRegistrationId: 'whr_1' });
    // The backend is only called from the queue, so its failure cannot fail the delete.
    expect(backendCallbacks.deleteWebhookRegistration).not.toHaveBeenCalled();
  });

  it('queues the backend removal again when an archived one is deleted again', async () => {
    let { webhookRegistrationService } = await import('./webhookRegistration');

    await webhookRegistrationService.archiveWebhookRegistration({
      instance,
      webhookRegistration: registration({ status: 'archived' }) as any
    });

    expect(webhookRegistrationUpdate).not.toHaveBeenCalled();
    expect(deleteQueueAdd).toHaveBeenCalledWith({ webhookRegistrationId: 'whr_1' });
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
