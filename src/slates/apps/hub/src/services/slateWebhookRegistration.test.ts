import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findTriggerGroups: vi.fn(),
  updateRegistration: vi.fn(),
  createRegistration: vi.fn(),
  finalizeRegistration: vi.fn(),
  validate: vi.fn(),
  rematch: vi.fn(),
  decrypt: vi.fn(),
  startSetup: vi.fn(),
  finishSetup: vi.fn()
}));

vi.mock('../db', () => ({
  db: {
    slateTriggerGroup: { findMany: mocks.findTriggerGroups },
    slateWebhookRegistration: { update: mocks.updateRegistration }
  }
}));
vi.mock('../env', () => ({
  env: {
    service: { METORIAL_REGION: 'test', SERVICE_PUBLIC_URL: 'https://unused.example.com' },
    slates: { SLATES_WEBHOOK_TRIGGER_HOST: 'https://hooks.example.com' }
  }
}));
vi.mock('../internal', () => ({
  triggerWebhookRegistrationServiceInternal: {
    createWebhookRegistration: mocks.createRegistration,
    finalizeWebhookRegistration: mocks.finalizeRegistration
  }
}));
vi.mock('../lib/slateVersion', () => ({
  getActiveSlateVersion: vi.fn(async () => ({ id: 'version', specificationOid: 9n }))
}));
vi.mock('../lib/validateJsonSchema', () => ({ validateJsonSchema: mocks.validate }));
vi.mock('../queues/trigger/webhookRegistrationRematch', () => ({
  triggerWebhookRegistrationRematchQueue: { add: mocks.rematch }
}));
vi.mock('./secret', () => ({
  secretService: { DANGEROUSLY_decryptSecret: mocks.decrypt }
}));
vi.mock('./slate', () => ({
  slateService: { getSlateById: vi.fn(async () => ({ oid: 7n, id: 'slate' })) }
}));
vi.mock('./slateInvocation', () => ({
  slateInvocationService: {
    createInvocation: vi.fn(async (d: any) => ({ tenant: d.tenant })),
    startManualWebhookRegistration: mocks.startSetup,
    finishManualWebhookRegistration: mocks.finishSetup
  }
}));
vi.mock('./tenant', () => ({ globalTenant: { oid: 99n, id: 'global' } }));
vi.mock('./triggerInfrastructure', () => ({
  isTriggerDeliveryConfig: (registration: any) =>
    registration.type === 'manual' && !!registration.triggerGroup.spec.invocation.googlePubSub
}));
vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: factory })
  }
}));

let { slateWebhookRegistrationService: service } = await import('./slateWebhookRegistration');

let tenant = { oid: 1n, id: 'tenant' } as any;

let userConfigSchema = { type: 'object', properties: { projectId: { type: 'string' } } };
let fullConfigSchema = { type: 'object', properties: { oauthClientId: { type: 'string' } } };

let configGroup = {
  oid: 21n,
  key: 'mail',
  spec: {
    invocation: {
      type: 'webhook',
      googlePubSub: { product: 'gmail' },
      registration: { mode: 'auto', config: { userConfigSchema, fullConfigSchema } }
    }
  }
} as any;

let manualGroup = {
  oid: 22n,
  key: 'events',
  spec: {
    invocation: {
      type: 'webhook',
      registration: { mode: 'manual', userConfigSchema, fullConfigSchema }
    }
  }
} as any;

let automaticGroup = {
  oid: 23n,
  key: 'hooks',
  spec: { invocation: { type: 'webhook', registration: { mode: 'auto' } } }
} as any;

let deliveryConfig = {
  oauthClientId: '123.apps.googleusercontent.com',
  googlePubSub: { projectId: 'project' }
};

let receiveUrl = (urlKey: string) => `https://hooks.example.com/receive/${urlKey}`;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.validate.mockImplementation(({ data }: any) => data);
  mocks.startSetup.mockResolvedValue({
    status: 'success',
    data: { partialWebhookRegistrationPayload: { step: 1 }, webhookSetupDocument: 'Do this.' }
  });
  mocks.finishSetup.mockResolvedValue({
    status: 'success',
    data: { webhookRegistrationPayload: deliveryConfig }
  });
  mocks.createRegistration.mockImplementation(async (d: any) => ({
    id: 'whr_new',
    urlKey: d.urlKey,
    status: d.status
  }));
  mocks.finalizeRegistration.mockImplementation(async (d: any) => ({
    ...d.registration,
    status: 'active'
  }));
  mocks.decrypt.mockResolvedValue({ payload: { step: 1 } });
});

describe.each([
  ['the delivery config of an automatic group', configGroup],
  ['a manual webhook group', manualGroup]
])('registration setup for %s', (_, group) => {
  beforeEach(() => {
    mocks.findTriggerGroups.mockResolvedValue([automaticGroup, group]);
  });

  it('starts a tenant registration that awaits setup at its own receive URL', async () => {
    let result = await service.createManualWebhookSetup({
      tenant,
      input: { slateId: 'slate', name: 'Setup' }
    });

    let created = mocks.createRegistration.mock.calls[0]![0];
    expect(created).toMatchObject({
      tenant,
      triggerGroup: group,
      type: 'manual',
      owner: 'tenant',
      status: 'awaiting_setup',
      webhookRegistrationPayload: { step: 1 }
    });
    expect(created.urlKey).toMatch(/^whk_.+_test$/);
    expect(mocks.startSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerGroupId: group.key,
        webhookUrl: receiveUrl(created.urlKey)
      })
    );
    expect(result).toMatchObject({ webhookSetupDocument: 'Do this.', userConfigSchema });
    expect(mocks.rematch).not.toHaveBeenCalled();
  });

  it('finishes a tenant registration with the validated input and re-evaluates what waited for it', async () => {
    let registration = {
      oid: 30n,
      id: 'whr_setup',
      status: 'awaiting_setup',
      urlKey: 'whk_setup_test',
      secretOid: 8n,
      slate: { oid: 7n },
      triggerGroup: group
    } as any;

    let finished = await service.finishManualWebhookSetup({
      tenant,
      registration,
      input: { userConfig: { projectId: 'project' } }
    });

    expect(mocks.validate).toHaveBeenCalledWith(
      expect.objectContaining({ schema: userConfigSchema, data: { projectId: 'project' } })
    );
    expect(mocks.finishSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerGroupId: group.key,
        webhookUrl: receiveUrl('whk_setup_test'),
        partialWebhookRegistrationPayload: { step: 1 },
        userWebhookRegistrationPayload: { projectId: 'project' }
      })
    );
    expect(mocks.finalizeRegistration).toHaveBeenCalledWith({
      tenant,
      registration,
      webhookRegistrationPayload: deliveryConfig
    });
    expect(finished.status).toBe('active');
    expect(mocks.rematch).toHaveBeenCalledWith({ webhookRegistrationId: 'whr_setup' });
  });

  it('trims pasted values before they are validated', async () => {
    await service.createGlobalWebhookRegistration({
      input: {
        slateId: 'slate',
        name: 'Shared',
        userConfig: { projectId: '  project\n', retries: 3, nested: { keep: ' as is ' } }
      }
    });

    let trimmed = { projectId: 'project', retries: 3, nested: { keep: ' as is ' } };
    expect(mocks.validate).toHaveBeenCalledWith(
      expect.objectContaining({ schema: userConfigSchema, data: trimmed })
    );
    expect(mocks.finishSetup.mock.calls[0]![0].userWebhookRegistrationPayload).toEqual(
      trimmed
    );
  });

  it('creates a finished global registration in one step', async () => {
    await service.createGlobalWebhookRegistration({
      input: { slateId: 'slate', name: 'Shared', userConfig: { projectId: 'project' } }
    });

    let created = mocks.createRegistration.mock.calls[0]![0];
    expect(created).toMatchObject({
      tenant: { oid: 99n },
      triggerGroup: group,
      type: 'manual',
      owner: 'global',
      status: 'active',
      webhookRegistrationPayload: deliveryConfig
    });
    expect(created.urlKey).toMatch(/^whk_global_.+_test$/);
    expect(mocks.startSetup.mock.calls[0]![0].webhookUrl).toBe(receiveUrl(created.urlKey));
    expect(mocks.finishSetup.mock.calls[0]![0]).toMatchObject({
      webhookUrl: receiveUrl(created.urlKey),
      userWebhookRegistrationPayload: { projectId: 'project' }
    });
    expect(mocks.rematch).toHaveBeenCalledWith({ webhookRegistrationId: 'whr_new' });
  });
});

describe('providers without a setup', () => {
  it.each([
    ['a plain automatic group', automaticGroup],
    [
      'an automatic group whose config block is incomplete',
      {
        ...automaticGroup,
        spec: {
          invocation: {
            type: 'webhook',
            registration: { mode: 'auto', config: { userConfigSchema } }
          }
        }
      }
    ],
    ['a polling group', { oid: 24n, key: 'poll', spec: { invocation: { type: 'polling' } } }]
  ])('refuses a registration for %s', async (_, group) => {
    mocks.findTriggerGroups.mockResolvedValue([group]);

    await expect(
      service.createManualWebhookSetup({ tenant, input: { slateId: 'slate', name: 'Setup' } })
    ).rejects.toMatchObject({
      data: { message: 'The provider does not support webhook registration.' }
    });
    await expect(
      service.createGlobalWebhookRegistration({
        input: { slateId: 'slate', name: 'Shared', userConfig: {} }
      })
    ).rejects.toMatchObject({
      data: { message: 'The provider does not support webhook registration.' }
    });
    expect(mocks.createRegistration).not.toHaveBeenCalled();
  });
});

describe('removing a registration', () => {
  let registration = (group: any, change: Record<string, unknown> = {}) =>
    ({
      oid: 30n,
      id: 'whr_removed',
      type: 'manual',
      tenantOid: 1n,
      triggerGroup: group,
      ...change
    }) as any;

  it('re-registers what delivered through a removed tenant delivery config', async () => {
    await service.deleteWebhookRegistration({
      tenant,
      registration: registration(configGroup)
    });

    expect(mocks.updateRegistration).toHaveBeenCalledWith({
      where: { oid: 30n },
      data: { status: 'deleted' }
    });
    expect(mocks.rematch.mock.calls).toEqual([
      [{ webhookRegistrationId: 'whr_removed' }],
      [{ webhookRegistrationId: 'whr_removed' }, { delay: 5 * 60 * 1000 }]
    ]);
  });

  it('re-registers what delivered through a removed global delivery config', async () => {
    await service.deleteGlobalWebhookRegistration({
      registration: registration(configGroup, { tenantOid: null })
    });

    expect(mocks.updateRegistration).toHaveBeenCalledWith({
      where: { oid: 30n },
      data: { status: 'deleted' }
    });
    expect(mocks.rematch).toHaveBeenCalledWith({ webhookRegistrationId: 'whr_removed' });
  });

  it('removes a manual webhook registration as before', async () => {
    await service.deleteWebhookRegistration({
      tenant,
      registration: registration(manualGroup)
    });
    await service.deleteGlobalWebhookRegistration({
      registration: registration(manualGroup, { tenantOid: null })
    });

    expect(mocks.updateRegistration).toHaveBeenCalledTimes(2);
    expect(mocks.rematch).not.toHaveBeenCalled();
  });

  it('does not let a tenant remove the config of another tenant', async () => {
    await expect(
      service.deleteWebhookRegistration({
        tenant,
        registration: registration(configGroup, { tenantOid: 2n })
      })
    ).rejects.toMatchObject({ data: { code: 'not_found' } });
    expect(mocks.updateRegistration).not.toHaveBeenCalled();
    expect(mocks.rematch).not.toHaveBeenCalled();
  });
});
