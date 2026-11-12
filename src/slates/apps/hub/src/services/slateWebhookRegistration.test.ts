import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  findTriggerGroups: vi.fn(),
  findOAuthCredentials: vi.fn(),
  findLiveConfig: vi.fn(),
  findRegistrations: vi.fn(),
  updateRegistration: vi.fn(),
  createRegistration: vi.fn(),
  finalizeRegistration: vi.fn(),
  validate: vi.fn(),
  rematch: vi.fn(),
  decrypt: vi.fn(),
  startSetup: vi.fn(),
  finishSetup: vi.fn(),
  lockedKeys: [] as string[]
}));

vi.mock('../db', () => ({
  db: {
    slateTriggerGroup: { findMany: mocks.findTriggerGroups },
    slateOAuthCredentials: { findMany: mocks.findOAuthCredentials },
    slateWebhookRegistration: {
      findFirst: mocks.findLiveConfig,
      findMany: mocks.findRegistrations,
      update: mocks.updateRegistration
    }
  }
}));
vi.mock('../env', () => ({
  env: {
    service: {
      METORIAL_REGION: 'test',
      REDIS_URL: 'redis://unused',
      SERVICE_PUBLIC_URL: 'https://unused.example.com'
    },
    slates: { SLATES_WEBHOOK_TRIGGER_HOST: 'https://hooks.example.com' }
  }
}));
vi.mock('@lowerdeck/lock', () => ({
  createLock: () => ({
    usingLock: async (key: string, fn: () => unknown) => {
      mocks.lockedKeys.push(key);
      return fn();
    }
  })
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
vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: factory })
  }
}));

let { slateWebhookRegistrationService: service } = await import('./slateWebhookRegistration');

let tenant = { oid: 1n, id: 'tenant' } as any;

let userConfigSchema = { type: 'object', properties: { topicName: { type: 'string' } } };
let fullConfigSchema = { type: 'object', properties: { audience: { type: 'string' } } };

let configGroup = {
  oid: 21n,
  key: 'mail',
  spec: {
    invocation: {
      type: 'webhook',
      registration: { mode: 'auto', deliveryConfig: { userConfigSchema, fullConfigSchema } }
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

let savedPayload = { topicName: 'topic', audience: 'https://hooks.example.com/receive/x' };

let ownCredentials = { oid: 40n, id: 'soc_own', clientId: 'client-a' };

let receiveUrl = (urlKey: string) => `https://hooks.example.com/receive/${urlKey}`;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.lockedKeys = [];
  mocks.validate.mockImplementation(({ data }: any) => data);
  mocks.startSetup.mockResolvedValue({
    status: 'success',
    data: { partialWebhookRegistrationPayload: { step: 1 }, webhookSetupDocument: 'Do this.' }
  });
  mocks.finishSetup.mockResolvedValue({
    status: 'success',
    data: { webhookRegistrationPayload: savedPayload }
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
  mocks.findOAuthCredentials.mockImplementation(async ({ where }: any) =>
    where.tenantOid === tenant.oid && where.id.in.includes(ownCredentials.id)
      ? [ownCredentials]
      : []
  );
  mocks.findLiveConfig.mockResolvedValue(null);
});

describe.each([
  [
    'the delivery config of an automatic group',
    configGroup,
    { deliveryConfigOAuthCredentialsId: 'soc_own' },
    { oauthClientId: 'client-a' },
    { type: 'delivery_config', oauthClientId: 'client-a' }
  ],
  ['a manual webhook group', manualGroup, {}, {}, { type: 'manual', oauthClientId: null }]
])('registration setup for %s', (_, group, tenantInput, globalInput, expected) => {
  beforeEach(() => {
    mocks.findTriggerGroups.mockResolvedValue([automaticGroup, group]);
  });

  it('starts a tenant registration that awaits setup at its own receive URL', async () => {
    let result = await service.createManualWebhookSetup({
      tenant,
      input: { slateId: 'slate', name: 'Setup', ...tenantInput }
    });

    let created = mocks.createRegistration.mock.calls[0]![0];
    expect(created).toMatchObject({
      tenant,
      triggerGroup: group,
      ...expected,
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
    expect(result).toEqual({
      registration: expect.objectContaining({ id: 'whr_new' }),
      webhookSetupDocument: 'Do this.',
      userConfigSchema
    });
    expect(result.userConfigSchema).toBe(userConfigSchema);
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
      input: { userConfig: { topicName: 'topic' } }
    });

    expect(mocks.validate).toHaveBeenCalledWith(
      expect.objectContaining({ schema: userConfigSchema, data: { topicName: 'topic' } })
    );
    expect(mocks.finishSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerGroupId: group.key,
        webhookUrl: receiveUrl('whk_setup_test'),
        partialWebhookRegistrationPayload: { step: 1 },
        userWebhookRegistrationPayload: { topicName: 'topic' }
      })
    );
    expect(mocks.finalizeRegistration).toHaveBeenCalledWith({
      tenant,
      registration,
      webhookRegistrationPayload: savedPayload
    });
    expect(finished.status).toBe('active');
    expect(mocks.rematch).toHaveBeenCalledWith({ webhookRegistrationId: 'whr_setup' });
  });

  it('trims pasted values before they are validated', async () => {
    await service.createGlobalWebhookRegistration({
      input: {
        slateId: 'slate',
        name: 'Shared',
        userConfig: { topicName: '  topic\n', retries: 3, nested: { keep: ' as is ' } },
        ...globalInput
      }
    });

    let trimmed = { topicName: 'topic', retries: 3, nested: { keep: ' as is ' } };
    expect(mocks.validate).toHaveBeenCalledWith(
      expect.objectContaining({ schema: userConfigSchema, data: trimmed })
    );
    expect(mocks.finishSetup.mock.calls[0]![0].userWebhookRegistrationPayload).toEqual(
      trimmed
    );
  });

  it('creates a finished global registration in one step', async () => {
    await service.createGlobalWebhookRegistration({
      input: {
        slateId: 'slate',
        name: 'Shared',
        userConfig: { topicName: 'topic' },
        ...globalInput
      }
    });

    let created = mocks.createRegistration.mock.calls[0]![0];
    expect(created).toMatchObject({
      tenant: { oid: 99n },
      triggerGroup: group,
      ...expected,
      owner: 'global',
      status: 'active',
      webhookRegistrationPayload: savedPayload
    });
    expect(created.urlKey).toMatch(/^whk_global_.+_test$/);
    expect(mocks.startSetup.mock.calls[0]![0].webhookUrl).toBe(receiveUrl(created.urlKey));
    expect(mocks.finishSetup.mock.calls[0]![0]).toMatchObject({
      webhookUrl: receiveUrl(created.urlKey),
      userWebhookRegistrationPayload: { topicName: 'topic' }
    });
    expect(mocks.rematch).toHaveBeenCalledWith({ webhookRegistrationId: 'whr_new' });
  });
});

describe('creating a tenant delivery config', () => {
  let create = (input: Record<string, unknown> = {}) =>
    service.createManualWebhookSetup({
      tenant,
      input: { slateId: 'slate', name: 'Setup', ...input }
    });

  let expectNothingCreated = () => {
    expect(mocks.startSetup).not.toHaveBeenCalled();
    expect(mocks.createRegistration).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    mocks.findTriggerGroups.mockResolvedValue([configGroup]);
  });

  it('records the client ID of the tenant’s own OAuth credentials of this integration', async () => {
    await create({ deliveryConfigOAuthCredentialsId: 'soc_own' });

    expect(mocks.findOAuthCredentials).toHaveBeenCalledWith({
      where: { tenantOid: 1n, slateOid: 7n, id: { in: ['soc_own'] } }
    });
    expect(mocks.createRegistration.mock.calls[0]![0]).toMatchObject({
      type: 'delivery_config',
      oauthClientId: 'client-a'
    });
  });

  it('requires the OAuth credentials the config is for', async () => {
    await expect(create()).rejects.toMatchObject({
      data: { status: 400, code: 'delivery_config_oauth_credentials_required' }
    });
    expect(mocks.findOAuthCredentials).not.toHaveBeenCalled();
    expectNothingCreated();
  });

  it.each([
    ['unknown', 'soc_unknown'],
    ['another tenant’s or another integration’s', 'soc_foreign']
  ])('refuses %s OAuth credentials', async (_, id) => {
    await expect(create({ deliveryConfigOAuthCredentialsId: id })).rejects.toMatchObject({
      data: { status: 400, code: 'invalid_oauth_credentials_id' }
    });
    expectNothingCreated();
  });

  it('refuses OAuth credentials for a manual webhook group', async () => {
    mocks.findTriggerGroups.mockResolvedValue([manualGroup]);

    await expect(
      create({ deliveryConfigOAuthCredentialsId: 'soc_own' })
    ).rejects.toMatchObject({
      data: { status: 400, code: 'delivery_config_oauth_credentials_not_applicable' }
    });
    expect(mocks.findOAuthCredentials).not.toHaveBeenCalled();
    expectNothingCreated();
  });

  it('refuses a second live config of the tenant for the same trigger group and OAuth app', async () => {
    mocks.findLiveConfig.mockResolvedValue({ id: 'whr_existing' });

    await expect(
      create({ deliveryConfigOAuthCredentialsId: 'soc_own' })
    ).rejects.toMatchObject({ data: { status: 409, code: 'delivery_config_already_exists' } });
    expect(mocks.findLiveConfig).toHaveBeenCalledWith({
      where: {
        type: 'delivery_config',
        status: { in: ['active', 'awaiting_setup'] },
        owner: 'tenant',
        tenantOid: 1n,
        slateOid: 7n,
        oauthClientId: 'client-a',
        triggerGroup: { key: 'mail' }
      },
      select: { id: true }
    });
    expectNothingCreated();
  });

  it('checks for a live config and creates the new one under one lock', async () => {
    let lockedAt: string[] = [];
    mocks.findLiveConfig.mockImplementation(async () => {
      lockedAt.push(`check:${mocks.lockedKeys.length}`);
      return null;
    });
    mocks.createRegistration.mockImplementation(async (d: any) => {
      lockedAt.push(`create:${mocks.lockedKeys.length}`);
      return { id: 'whr_new', urlKey: d.urlKey, status: d.status };
    });

    await create({ deliveryConfigOAuthCredentialsId: 'soc_own' });

    expect(mocks.lockedKeys).toEqual(['7:mail:1:client-a']);
    expect(lockedAt).toEqual(['check:1', 'create:1']);
  });

  it('takes no lock and makes no check for a manual webhook', async () => {
    mocks.findTriggerGroups.mockResolvedValue([manualGroup]);

    await create();

    expect(mocks.lockedKeys).toEqual([]);
    expect(mocks.findLiveConfig).not.toHaveBeenCalled();
    expect(mocks.createRegistration.mock.calls[0]![0]).toMatchObject({
      type: 'manual',
      oauthClientId: null
    });
  });
});

describe('creating a global delivery config', () => {
  let create = (input: Record<string, unknown> = {}) =>
    service.createGlobalWebhookRegistration({
      input: { slateId: 'slate', name: 'Shared', userConfig: {}, ...input }
    });

  beforeEach(() => {
    mocks.findTriggerGroups.mockResolvedValue([configGroup]);
  });

  it('records the OAuth client ID the operator gives, trimmed', async () => {
    await create({ oauthClientId: '  client-a\n' });

    expect(mocks.createRegistration.mock.calls[0]![0]).toMatchObject({
      type: 'delivery_config',
      owner: 'global',
      oauthClientId: 'client-a'
    });
    expect(mocks.lockedKeys).toEqual(['7:mail:global:client-a']);
  });

  it.each([undefined, '', '   '])(
    'requires an OAuth client ID (given %j)',
    async oauthClientId => {
      await expect(create({ oauthClientId })).rejects.toMatchObject({
        data: { status: 400, code: 'delivery_config_oauth_client_id_required' }
      });
      expect(mocks.startSetup).not.toHaveBeenCalled();
    }
  );

  it('refuses an OAuth client ID for a manual webhook group', async () => {
    mocks.findTriggerGroups.mockResolvedValue([manualGroup]);

    await expect(create({ oauthClientId: 'client-a' })).rejects.toMatchObject({
      data: { status: 400, code: 'delivery_config_oauth_client_id_not_applicable' }
    });
    expect(mocks.startSetup).not.toHaveBeenCalled();
  });

  it('refuses a second live global config for the same trigger group and OAuth app', async () => {
    mocks.findLiveConfig.mockResolvedValue({ id: 'whr_existing' });

    await expect(create({ oauthClientId: 'client-a' })).rejects.toMatchObject({
      data: { status: 409, code: 'delivery_config_already_exists' }
    });
    expect(mocks.findLiveConfig.mock.calls[0]![0].where).toMatchObject({
      type: 'delivery_config',
      owner: 'global',
      tenantOid: null,
      oauthClientId: 'client-a',
      triggerGroup: { key: 'mail' }
    });
    expect(mocks.startSetup).not.toHaveBeenCalled();
    expect(mocks.finishSetup).not.toHaveBeenCalled();
    expect(mocks.createRegistration).not.toHaveBeenCalled();
  });
});

describe('providers without a setup', () => {
  it.each([
    ['a plain automatic group', automaticGroup],
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
  let registration = (type: string, change: Record<string, unknown> = {}) =>
    ({ oid: 30n, id: 'whr_removed', type, tenantOid: 1n, ...change }) as any;

  it('re-registers what delivered through a removed tenant delivery config', async () => {
    await service.deleteWebhookRegistration({
      tenant,
      registration: registration('delivery_config')
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
      registration: registration('delivery_config', { tenantOid: null })
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
      registration: registration('manual')
    });
    await service.deleteGlobalWebhookRegistration({
      registration: registration('manual', { tenantOid: null })
    });

    expect(mocks.updateRegistration).toHaveBeenCalledTimes(2);
    expect(mocks.rematch).not.toHaveBeenCalled();
  });

  it('does not let a tenant remove the config of another tenant', async () => {
    await expect(
      service.deleteWebhookRegistration({
        tenant,
        registration: registration('delivery_config', { tenantOid: 2n })
      })
    ).rejects.toMatchObject({ data: { code: 'not_found' } });
    expect(mocks.updateRegistration).not.toHaveBeenCalled();
    expect(mocks.rematch).not.toHaveBeenCalled();
  });
});

describe('delivery configs serving OAuth credentials', () => {
  let otherTenant = { oid: 2n, id: 'other' } as any;

  let credentials = [
    { id: 'soc_a', tenantOid: 1n, slateOid: 7n, clientId: 'client-a' },
    { id: 'soc_a_again', tenantOid: 1n, slateOid: 7n, clientId: 'client-a' },
    { id: 'soc_b', tenantOid: 1n, slateOid: 7n, clientId: 'client-b' },
    { id: 'soc_foreign', tenantOid: 2n, slateOid: 7n, clientId: 'client-a' }
  ];

  let config = (id: string, change: Record<string, unknown> = {}) => ({
    id,
    tenantOid: 1n as bigint | null,
    owner: 'tenant',
    type: 'delivery_config',
    status: 'active',
    slateOid: 7n,
    oauthClientId: 'client-a',
    ...change
  });

  let registrations = [
    config('whr_a'),
    config('whr_a_pending', { status: 'awaiting_setup' }),
    config('whr_b', { oauthClientId: 'client-b' }),
    config('whr_deleted', { status: 'deleted' }),
    config('whr_manual', { type: 'manual' }),
    config('whr_other_slate', { slateOid: 8n }),
    config('whr_foreign', { tenantOid: 2n }),
    config('whr_global', { tenantOid: null, owner: 'global' })
  ];

  let serving = async (forTenant: any, oauthCredentialsIds: string[]) =>
    (
      await service.getDeliveryConfigsServingOAuthCredentials({
        tenant: forTenant,
        oauthCredentialsIds
      })
    ).map((r: any) => r.id);

  beforeEach(() => {
    mocks.findOAuthCredentials.mockImplementation(async ({ where }: any) =>
      credentials.filter(c => c.tenantOid === where.tenantOid && where.id.in.includes(c.id))
    );
    mocks.findRegistrations.mockImplementation(async ({ where }: any) =>
      registrations.filter(
        r =>
          r.tenantOid === where.tenantOid &&
          r.owner === where.owner &&
          r.type === where.type &&
          where.status.in.includes(r.status) &&
          where.OR.some(
            (m: any) => m.slateOid === r.slateOid && m.oauthClientId === r.oauthClientId
          )
      )
    );
  });

  it('matches the live configs of the same OAuth app through any of its credentials records', async () => {
    expect(await serving(tenant, ['soc_a'])).toEqual(['whr_a', 'whr_a_pending']);
    expect(await serving(tenant, ['soc_a_again'])).toEqual(['whr_a', 'whr_a_pending']);
    expect(await serving(tenant, ['soc_a', 'soc_b'])).toEqual([
      'whr_a',
      'whr_a_pending',
      'whr_b'
    ]);
  });

  it('ignores deleted configs, other registration types and global configs', async () => {
    let ids = await serving(tenant, ['soc_a']);

    expect(ids).not.toContain('whr_deleted');
    expect(ids).not.toContain('whr_manual');
    expect(ids).not.toContain('whr_global');
  });

  it('never returns configs or uses credentials of another tenant', async () => {
    expect(await serving(tenant, ['soc_a'])).not.toContain('whr_foreign');
    expect(await serving(tenant, ['soc_foreign'])).toEqual([]);
    expect(await serving(otherTenant, ['soc_a'])).toEqual([]);
  });

  it('skips unknown ids', async () => {
    expect(await serving(tenant, ['soc_unknown', 'soc_b'])).toEqual(['whr_b']);
  });

  it('looks up no configs when no credentials resolve', async () => {
    expect(await serving(tenant, ['soc_unknown'])).toEqual([]);
    expect(mocks.findRegistrations).not.toHaveBeenCalled();
  });
});
