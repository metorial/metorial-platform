import { beforeEach, describe, expect, it, vi } from 'vitest';

let db = {
  $transaction: vi.fn(),
  slate: { findFirst: vi.fn() },
  slateAuthConfig: { findFirst: vi.fn() },
  slateAuthConfigUsedForInstance: { findFirst: vi.fn() },
  slateInstance: { findFirst: vi.fn() },
  slateTriggerGroup: { findMany: vi.fn() },
  triggerRegistration: { create: vi.fn(), findUniqueOrThrow: vi.fn() },
  triggerRegistrationInstance: { createMany: vi.fn(), findMany: vi.fn() }
};
let setupQueue = { addManyWithOps: vi.fn() };
let createStack = vi.fn();
let invocation = { listTriggerSelectionOptions: vi.fn(), listOptionListOptions: vi.fn() };
let nextId = 100n;

vi.mock('../db', () => ({ db }));
vi.mock('../id', () => ({
  getId: () => ({ id: `generated-${++nextId}`, oid: nextId })
}));
vi.mock('../lib/slateVersion', () => ({
  getActiveSlateVersion: vi.fn(async () => ({ specificationOid: 9n }))
}));
vi.mock('../queues/trigger/registrationCleanup', () => ({
  triggerRegistrationCleanupQueue: { add: vi.fn() }
}));
vi.mock('../queues/trigger/setup', () => ({
  triggerRegistrationInstanceSetupQueue: setupQueue
}));
vi.mock('../queues/trigger/_stack', () => ({
  createTriggerInstanceStack: createStack
}));
vi.mock('./slateInvocation', () => ({ slateInvocationService: invocation }));
vi.mock('./slate', () => ({
  slateService: { listCurrentAuthMethods: vi.fn(async () => []) }
}));
vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: (_name: string, factory: () => unknown) => ({ build: factory })
  }
}));

let tenant = { oid: 1n, id: 'tenant' } as any;
let legacy = {
  oid: 20n,
  key: 'legacy',
  spec: { invocation: { type: 'polling', intervalSeconds: 900 } }
};
let selected = {
  oid: 21n,
  key: 'selected',
  name: 'Selected resource events',
  spec: {
    description: 'Events for the selected resource',
    invocation: { type: 'webhook', registration: { mode: 'auto' } },
    selectionSchema: {
      type: 'object',
      properties: { resourceId: { type: 'string' } },
      required: ['resourceId'],
      additionalProperties: false
    }
  }
};
let registration = { oid: 50n, id: 'registration', instances: [] };

let create = async (triggerGroupSelections?: Record<string, Record<string, any>>) => {
  let { triggerRegistrationService } = await import('./triggerRegistration');

  return triggerRegistrationService.createTriggerRegistration({
    tenant,
    input: { slateInstanceId: 'instance', triggerGroupSelections }
  });
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.resetModules();

  db.$transaction.mockImplementation(async (fn: any) => fn(db));
  db.slateInstance.findFirst.mockResolvedValue({
    oid: 10n,
    slateOid: 11n,
    slate: {},
    currentConfig: { oid: 12n }
  });
  db.slateTriggerGroup.findMany.mockResolvedValue([legacy, selected]);
  db.triggerRegistration.create.mockResolvedValue({ oid: 50n });
  db.triggerRegistration.findUniqueOrThrow.mockResolvedValue(registration);
  db.triggerRegistrationInstance.findMany.mockResolvedValue([{ id: 'legacy-instance' }]);
});

describe('triggerRegistrationService.createTriggerRegistration', () => {
  it('registers the other groups when a required selection is omitted', async () => {
    await expect(create()).resolves.toEqual({
      ...registration,
      selectableTriggerGroups: [
        {
          key: 'selected',
          name: 'Selected resource events',
          description: 'Events for the selected resource',
          selectionSchema: selected.spec.selectionSchema,
          status: 'selection_required'
        }
      ],
      ignoredSelectionKeys: []
    });

    expect(db.triggerRegistrationInstance.createMany.mock.lastCall![0].data).toEqual([
      expect.objectContaining({ triggerRegistrationOid: 50n, triggerGroupOid: 20n })
    ]);
    expect(setupQueue.addManyWithOps).toHaveBeenCalledWith([
      {
        data: { triggerRegistrationInstanceId: 'legacy-instance' },
        opts: { id: 'legacy-instance' }
      }
    ]);
  });

  it('activates a group once its selection is provided', async () => {
    let result = await create({ selected: { resourceId: 'resource' } });

    expect(result.selectableTriggerGroups).toEqual([
      expect.objectContaining({ key: 'selected', status: 'active' })
    ]);

    expect(db.triggerRegistrationInstance.createMany.mock.lastCall![0].data).toEqual([
      expect.objectContaining({ triggerGroupOid: 20n }),
      expect.objectContaining({ triggerGroupOid: 21n, selection: { resourceId: 'resource' } })
    ]);
  });

  it('still creates the registration when every group is skipped', async () => {
    db.slateTriggerGroup.findMany.mockResolvedValue([selected]);
    db.triggerRegistrationInstance.findMany.mockResolvedValue([]);

    await expect(create()).resolves.toMatchObject({
      ...registration,
      selectableTriggerGroups: [expect.objectContaining({ status: 'selection_required' })]
    });

    expect(db.triggerRegistration.create).toHaveBeenCalledTimes(1);
    expect(db.triggerRegistrationInstance.createMany).not.toHaveBeenCalled();
    expect(setupQueue.addManyWithOps).not.toHaveBeenCalled();
  });

  it('rejects the whole registration when a provided selection is invalid', async () => {
    await expect(create({ selected: {} })).rejects.toThrow();
    await expect(create({ selected: { resourceId: 1 } as any })).rejects.toThrow();

    expect(db.triggerRegistration.create).not.toHaveBeenCalled();
  });

  it('ignores and reports selections for removed or non-selectable groups', async () => {
    let result = await create({
      unknown: { resourceId: 'renamed' },
      legacy: {},
      selected: { resourceId: 'resource' }
    });

    expect(result.ignoredSelectionKeys).toEqual(['unknown', 'legacy']);
    expect(result.selectableTriggerGroups).toEqual([
      expect.objectContaining({ key: 'selected', status: 'active' })
    ]);
    expect(db.triggerRegistrationInstance.createMany.mock.lastCall![0].data).toEqual([
      expect.objectContaining({ triggerGroupOid: 20n, selection: expect.anything() }),
      expect.objectContaining({ triggerGroupOid: 21n, selection: { resourceId: 'resource' } })
    ]);
  });
});

describe('triggerRegistrationService.listSelectableTriggerGroups', () => {
  let list = async (instances: { triggerGroupOid: bigint }[]) => {
    let { triggerRegistrationService } = await import('./triggerRegistration');
    return triggerRegistrationService.listSelectableTriggerGroups({
      registration: { slate: { oid: 11n }, instance: {}, instances } as any
    });
  };

  it('reports a selectable group without an instance as needing a selection', async () => {
    await expect(list([{ triggerGroupOid: 20n }])).resolves.toEqual([
      {
        key: 'selected',
        name: 'Selected resource events',
        description: 'Events for the selected resource',
        selectionSchema: selected.spec.selectionSchema,
        status: 'selection_required'
      }
    ]);
  });

  it('reports a selectable group with an instance as active', async () => {
    await expect(list([{ triggerGroupOid: 20n }, { triggerGroupOid: 21n }])).resolves.toEqual([
      expect.objectContaining({ key: 'selected', status: 'active' })
    ]);
  });

  it('returns no groups when the provider has no deployable version', async () => {
    let { ServiceError, badRequestError } = await import('@lowerdeck/error');
    let { getActiveSlateVersion } = await import('../lib/slateVersion');
    vi.mocked(getActiveSlateVersion).mockRejectedValueOnce(
      new ServiceError(badRequestError({ message: 'not deployed' }))
    );

    await expect(list([])).resolves.toEqual([]);
  });
});

describe('triggerRegistrationService.listSelectionOptions', () => {
  let listed = {
    ...selected,
    spec: {
      ...selected.spec,
      selectionSchema: {
        ...selected.spec.selectionSchema,
        properties: {
          resourceId: { type: 'string', 'x-slates-options': true },
          note: { type: 'string' }
        }
      }
    }
  };
  let stored = { oid: 50n, id: 'registration', slate: { oid: 11n }, instance: {} } as any;

  let listOptions = async (input: Record<string, any>) => {
    let { triggerRegistrationService } = await import('./triggerRegistration');

    return triggerRegistrationService.listSelectionOptions({
      tenant,
      registration: stored,
      input: { triggerGroupKey: 'selected', field: 'resourceId', ...input }
    });
  };

  beforeEach(() => {
    db.slateTriggerGroup.findMany.mockResolvedValue([legacy, listed]);
    createStack.mockResolvedValue('stack');
  });

  it('lists the options of a marked field with the connection of the registration', async () => {
    invocation.listTriggerSelectionOptions.mockResolvedValue({
      status: 'success',
      data: { options: [{ value: 'a', label: 'Resource A' }], nextPageToken: 'next' }
    });

    await expect(
      listOptions({
        query: 'q'.repeat(300),
        pageToken: 'page',
        pageTokenSource: 'own',
        selection: { note: 'entered' }
      })
    ).resolves.toEqual({
      options: [{ value: 'a', label: 'Resource A' }],
      nextPageToken: 'next',
      source: 'own',
      linked: null
    });

    expect(createStack.mock.lastCall![0].registration).toEqual({ ...stored, tenant });
    expect(invocation.listTriggerSelectionOptions).toHaveBeenCalledWith({
      stack: 'stack',
      triggerGroupId: 'selected',
      field: 'resourceId',
      query: 'q'.repeat(200),
      pageToken: 'page',
      selection: { note: 'entered' }
    });
  });

  it('rejects fields and groups that have no options without calling the provider', async () => {
    for (let input of [
      { field: 'note' },
      { field: 'missing' },
      { field: 'constructor' },
      { triggerGroupKey: 'legacy' },
      { triggerGroupKey: 'unknown' }
    ]) {
      await expect(listOptions(input)).rejects.toMatchObject({
        data: { code: 'selection_options_not_supported' }
      });
    }

    await expect(
      listOptions({ selection: { note: 'x'.repeat(70 * 1024) } })
    ).rejects.toMatchObject({ data: { status: 400 } });

    expect(createStack).not.toHaveBeenCalled();
  });

  it('reports a provider failure as a bad request with its message', async () => {
    invocation.listTriggerSelectionOptions.mockResolvedValue({
      status: 'error',
      error: { code: 'provider_error', message: 'No access to that resource.' }
    });

    await expect(listOptions({})).rejects.toMatchObject({
      data: { code: 'selection_options_failed', message: 'No access to that resource.' }
    });
  });

  it.each<[string, Record<string, unknown>]>([
    ['no options array', {}],
    ['options that are not a list', { options: 'a' }],
    ['an option without a label', { options: [{ value: 'a' }] }],
    ['an option with an object value', { options: [{ value: { id: 'a' }, label: 'A' }] }],
    [
      'an option with a numeric description',
      { options: [{ value: 'a', label: 'A', description: 1 }] }
    ]
  ])('reports a result with %s as a bad request', async (_, data) => {
    invocation.listTriggerSelectionOptions.mockResolvedValue({
      status: 'success',
      data: { nextPageToken: null, ...data }
    });

    await expect(listOptions({})).rejects.toMatchObject({
      data: {
        status: 400,
        code: 'selection_options_failed',
        message: 'The integration returned the options in an unexpected format.'
      }
    });
  });

  it('returns only the protocol fields of each option', async () => {
    invocation.listTriggerSelectionOptions.mockResolvedValue({
      status: 'success',
      data: {
        options: [{ value: 1, label: 'One', description: 'First', icon: 'x' }],
        nextPageToken: null,
        requestTraces: [],
        extra: true
      }
    });

    await expect(listOptions({})).resolves.toEqual({
      options: [{ value: 1, label: 'One', description: 'First' }],
      nextPageToken: null,
      source: 'own',
      linked: null
    });
  });

  it('rejects a page token issued by another list', async () => {
    for (let pageTokenSource of ['linked', undefined]) {
      await expect(listOptions({ pageToken: 'page', pageTokenSource })).rejects.toMatchObject({
        data: { status: 400, code: 'selection_options_page_token_expired' }
      });
    }

    expect(createStack).not.toHaveBeenCalled();
    expect(invocation.listTriggerSelectionOptions).not.toHaveBeenCalled();
  });
});

describe('triggerRegistrationService.listSelectionOptions with a linked option list', () => {
  let linkedMarker = {
    slate: 'scope/files',
    optionList: 'folders',
    params: { kind: 'folder' }
  };
  let group = {
    ...selected,
    spec: {
      ...selected.spec,
      selectionSchema: {
        ...selected.spec.selectionSchema,
        properties: {
          resourceId: {
            type: 'string',
            'x-slates-options': true,
            'x-slates-options-linked': linkedMarker
          },
          folderId: { type: 'string', 'x-slates-options-linked': linkedMarker }
        }
      }
    }
  };
  let stored = {
    oid: 50n,
    id: 'registration',
    tenantOid: 1n,
    slate: { oid: 11n, registryOid: 3n },
    instance: {},
    authConfig: { oid: 13n, profileUid: 'account-1' }
  } as any;
  let linkedSlate = { oid: 30n, id: 'slate-files', name: 'Files', registryOid: 3n };
  let linkedInstance = { oid: 32n, currentConfig: { oid: 33n, value: { region: 'eu' } } };
  let linkedAuthConfig = { oid: 31n, id: 'auth-files', authMethod: { key: 'oauth' } };
  let ownOptions = { options: [{ value: 'own', label: 'Own' }], nextPageToken: null };
  let linkedOptions = { options: [{ value: 'f1', label: 'Folder 1' }], nextPageToken: 'more' };

  let listOptions = async (input: Record<string, any>, registration = stored) => {
    let { triggerRegistrationService } = await import('./triggerRegistration');

    return triggerRegistrationService.listSelectionOptions({
      tenant,
      registration,
      input: {
        triggerGroupKey: 'selected',
        field: 'resourceId',
        linkedAuthConfigIds: ['auth-files', 'auth-other'],
        ...input
      }
    });
  };

  beforeEach(() => {
    db.slateTriggerGroup.findMany.mockResolvedValue([group]);
    db.slate.findFirst.mockResolvedValue(linkedSlate);
    db.slateAuthConfig.findFirst.mockResolvedValue({ ...linkedAuthConfig, instance: null });
    db.slateAuthConfigUsedForInstance.findFirst.mockResolvedValue({
      instance: linkedInstance
    });
    createStack.mockResolvedValue('stack');
    invocation.listTriggerSelectionOptions.mockResolvedValue({
      status: 'success',
      data: ownOptions
    });
    invocation.listOptionListOptions.mockResolvedValue({
      status: 'success',
      data: linkedOptions
    });
  });

  it('runs the linked list with a same-account connection of the linked slate', async () => {
    await expect(
      listOptions({
        query: 'q'.repeat(300),
        pageToken: 'page',
        pageTokenSource: 'linked',
        selection: { note: 'entered' }
      })
    ).resolves.toEqual({
      ...linkedOptions,
      source: 'linked',
      linked: { connected: true }
    });

    expect(db.slate.findFirst).toHaveBeenCalledWith({
      where: {
        registryOid: 3n,
        status: 'active',
        slateFullIdentifierOnRegistry: { in: ['scope/files', '@scope/files'] }
      }
    });
    expect(db.slateAuthConfig.findFirst.mock.lastCall![0].where).toEqual({
      tenantOid: 1n,
      id: { in: ['auth-files', 'auth-other'] },
      slateOid: 30n,
      profileUid: 'account-1',
      isProcessing: false,
      errorCode: null,
      secret: { status: 'active' }
    });
    expect(db.slateAuthConfigUsedForInstance.findFirst.mock.lastCall![0].where).toEqual({
      configOid: 31n,
      instance: { tenantOid: 1n, slateOid: 30n }
    });
    expect(createStack.mock.lastCall![0].registration).toEqual({
      tenant,
      slate: linkedSlate,
      authConfig: { ...linkedAuthConfig, instance: null },
      instance: linkedInstance,
      instanceConfig: linkedInstance.currentConfig
    });
    expect(createStack.mock.lastCall![0].slateVersion).toEqual({ specificationOid: 9n });
    expect(invocation.listOptionListOptions).toHaveBeenCalledWith({
      stack: 'stack',
      optionListId: 'folders',
      params: { kind: 'folder' },
      query: 'q'.repeat(200),
      pageToken: 'page'
    });
    expect(invocation.listTriggerSelectionOptions).not.toHaveBeenCalled();
  });

  it('uses the instance a linked connection is bound to', async () => {
    db.slateAuthConfig.findFirst.mockResolvedValue({
      ...linkedAuthConfig,
      instance: linkedInstance
    });

    await listOptions({});

    expect(db.slateAuthConfigUsedForInstance.findFirst).not.toHaveBeenCalled();
    expect(createStack.mock.lastCall![0].registration).toMatchObject({
      instance: linkedInstance,
      instanceConfig: linkedInstance.currentConfig
    });
  });

  it('runs a linked connection without any instance with an empty config', async () => {
    db.slateAuthConfigUsedForInstance.findFirst.mockResolvedValue(null);

    await listOptions({});

    expect(createStack.mock.lastCall![0].registration).toMatchObject({
      instance: null,
      instanceConfig: null
    });
  });

  it('looks up the deployed version of the linked slate once', async () => {
    let { getActiveSlateVersion } = await import('../lib/slateVersion');

    await listOptions({});

    expect(
      vi.mocked(getActiveSlateVersion).mock.calls.filter(([d]) => d.slate === linkedSlate)
    ).toHaveLength(1);
  });

  it('falls back to the own list when the account has no linked connection', async () => {
    db.slateAuthConfig.findFirst.mockResolvedValue(null);

    await expect(listOptions({ pageToken: 'page', pageTokenSource: 'own' })).resolves.toEqual({
      ...ownOptions,
      source: 'own',
      linked: { connected: false }
    });

    expect(createStack.mock.lastCall![0].registration).toEqual({ ...stored, tenant });
    expect(invocation.listTriggerSelectionOptions).toHaveBeenCalledWith(
      expect.objectContaining({ field: 'resourceId', pageToken: 'page' })
    );
    expect(invocation.listOptionListOptions).not.toHaveBeenCalled();
  });

  it('returns no options for a linked-only field without a linked connection', async () => {
    db.slateAuthConfig.findFirst.mockResolvedValue(null);

    await expect(listOptions({ field: 'folderId' })).resolves.toEqual({
      options: [],
      nextPageToken: null,
      source: 'own',
      linked: { connected: false }
    });

    expect(createStack).not.toHaveBeenCalled();
    expect(invocation.listTriggerSelectionOptions).not.toHaveBeenCalled();
    expect(invocation.listOptionListOptions).not.toHaveBeenCalled();
  });

  it('only considers connections the caller allows for the linked list', async () => {
    db.slateAuthConfig.findFirst.mockImplementation(async ({ where }: any) =>
      where.id.in.includes(linkedAuthConfig.id)
        ? { ...linkedAuthConfig, instance: null }
        : null
    );

    await expect(listOptions({ linkedAuthConfigIds: ['auth-other'] })).resolves.toEqual({
      ...ownOptions,
      source: 'own',
      linked: { connected: false }
    });
    expect(db.slateAuthConfig.findFirst.mock.lastCall![0].where).toMatchObject({
      tenantOid: 1n,
      id: { in: ['auth-other'] }
    });
    expect(invocation.listOptionListOptions).not.toHaveBeenCalled();

    await expect(listOptions({ linkedAuthConfigIds: ['auth-files'] })).resolves.toMatchObject({
      ...linkedOptions,
      source: 'linked',
      linked: { connected: true }
    });
  });

  it('uses no linked connection when the caller allows none', async () => {
    for (let linkedAuthConfigIds of [undefined, []]) {
      await expect(listOptions({ linkedAuthConfigIds })).resolves.toEqual({
        ...ownOptions,
        source: 'own',
        linked: { connected: false }
      });
      await expect(listOptions({ field: 'folderId', linkedAuthConfigIds })).resolves.toEqual({
        options: [],
        nextPageToken: null,
        source: 'own',
        linked: { connected: false }
      });
    }

    expect(db.slateAuthConfig.findFirst).not.toHaveBeenCalled();
    expect(invocation.listOptionListOptions).not.toHaveBeenCalled();
  });

  it('accepts every allowed connection the caller sends', async () => {
    let linkedAuthConfigIds = Array.from({ length: 250 }, (_, i) => `auth-${i}`);

    await expect(listOptions({ linkedAuthConfigIds })).resolves.toMatchObject({
      source: 'linked'
    });
    expect(db.slateAuthConfig.findFirst.mock.lastCall![0].where.id).toEqual({
      in: linkedAuthConfigIds
    });
  });

  it('rejects a page token of the own list once the linked list is used', async () => {
    await expect(
      listOptions({ pageToken: 'page', pageTokenSource: 'own' })
    ).rejects.toMatchObject({
      data: { status: 400, code: 'selection_options_page_token_expired' }
    });

    expect(invocation.listOptionListOptions).not.toHaveBeenCalled();
    expect(invocation.listTriggerSelectionOptions).not.toHaveBeenCalled();
  });

  it('rejects a page token of the linked list once the own list is used', async () => {
    db.slateAuthConfig.findFirst.mockResolvedValue(null);

    for (let field of ['resourceId', 'folderId']) {
      await expect(
        listOptions({ field, pageToken: 'page', pageTokenSource: 'linked' })
      ).rejects.toMatchObject({
        data: { status: 400, code: 'selection_options_page_token_expired' }
      });
    }

    expect(invocation.listTriggerSelectionOptions).not.toHaveBeenCalled();
  });

  it('reports a malformed result of the linked list as a bad request', async () => {
    invocation.listOptionListOptions.mockResolvedValue({
      status: 'success',
      data: { options: [{ label: 'No value' }], nextPageToken: null }
    });

    await expect(listOptions({})).rejects.toMatchObject({
      data: { status: 400, code: 'selection_options_failed' }
    });
  });

  it('reports no linked source when the linked slate is unknown to the hub', async () => {
    db.slate.findFirst.mockResolvedValue(null);

    await expect(listOptions({})).resolves.toEqual({
      ...ownOptions,
      source: 'own',
      linked: null
    });
    await expect(listOptions({ field: 'folderId' })).resolves.toEqual({
      options: [],
      nextPageToken: null,
      source: 'own',
      linked: null
    });

    expect(db.slateAuthConfig.findFirst).not.toHaveBeenCalled();
    expect(invocation.listOptionListOptions).not.toHaveBeenCalled();
  });

  it('uses the own list when the connection of the registration has no account id', async () => {
    for (let authConfig of [
      null,
      { oid: 13n, profileUid: null },
      { oid: 13n, profileUid: '' }
    ]) {
      await expect(listOptions({}, { ...stored, authConfig })).resolves.toMatchObject({
        source: 'own',
        linked: { connected: false }
      });
    }

    expect(db.slateAuthConfig.findFirst).not.toHaveBeenCalled();
    expect(invocation.listOptionListOptions).not.toHaveBeenCalled();
  });

  it('ignores a malformed linked marker', async () => {
    db.slateTriggerGroup.findMany.mockResolvedValue([
      {
        ...group,
        spec: {
          ...group.spec,
          selectionSchema: {
            properties: { folderId: { 'x-slates-options-linked': { slate: 'scope/files' } } }
          }
        }
      }
    ]);

    await expect(listOptions({ field: 'folderId' })).rejects.toMatchObject({
      data: { code: 'selection_options_not_supported' }
    });
    expect(db.slate.findFirst).not.toHaveBeenCalled();
  });

  it('treats a linked slate without a deployed version as not connected', async () => {
    let { ServiceError, badRequestError } = await import('@lowerdeck/error');
    let { getActiveSlateVersion } = await import('../lib/slateVersion');
    vi.mocked(getActiveSlateVersion).mockImplementation(async (d: any) => {
      if (d.slate === linkedSlate) {
        throw new ServiceError(badRequestError({ message: 'not deployed' }));
      }
      return { specificationOid: 9n } as any;
    });

    await expect(listOptions({})).resolves.toEqual({
      ...ownOptions,
      source: 'own',
      linked: { connected: false }
    });
    await expect(listOptions({ field: 'folderId' })).resolves.toEqual({
      options: [],
      nextPageToken: null,
      source: 'own',
      linked: { connected: false }
    });

    expect(getActiveSlateVersion).toHaveBeenCalledWith({
      slate: linkedSlate,
      instance: linkedInstance
    });
    expect(createStack.mock.lastCall![0].registration).toEqual({ ...stored, tenant });
    expect(invocation.listOptionListOptions).not.toHaveBeenCalled();
  });

  it('does not hide unexpected errors while checking the linked slate', async () => {
    let { getActiveSlateVersion } = await import('../lib/slateVersion');
    vi.mocked(getActiveSlateVersion).mockImplementation(async (d: any) => {
      if (d.slate === linkedSlate) throw new Error('database down');
      return { specificationOid: 9n } as any;
    });

    await expect(listOptions({})).rejects.toThrow('database down');
    expect(invocation.listTriggerSelectionOptions).not.toHaveBeenCalled();
  });

  it('reports a failure of the linked list as a bad request with its message', async () => {
    invocation.listOptionListOptions.mockResolvedValue({
      status: 'error',
      error: { code: 'provider_error', message: 'No access to that account.' }
    });

    await expect(listOptions({})).rejects.toMatchObject({
      data: {
        status: 400,
        code: 'selection_options_failed',
        message: 'No access to that account.'
      }
    });
    expect(invocation.listTriggerSelectionOptions).not.toHaveBeenCalled();
  });
});
