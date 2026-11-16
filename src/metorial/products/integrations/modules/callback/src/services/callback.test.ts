import { beforeEach, describe, expect, it, vi } from 'vitest';

let {
  db,
  fire,
  callbackInstanceReconcileManyQueue,
  indexCallbackQueue,
  getBackend,
  getOwnershipAccessor
} = vi.hoisted(() => ({
  db: {
    callback: { update: vi.fn() },
    callbackInstance: { findFirst: vi.fn() },
    providerAuthConfig: { findMany: vi.fn() },
    providerVariant: { findUniqueOrThrow: vi.fn() }
  },
  fire: vi.fn(),
  callbackInstanceReconcileManyQueue: { add: vi.fn() },
  indexCallbackQueue: { add: vi.fn() },
  getBackend: vi.fn(),
  getOwnershipAccessor: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_name: string, factory: () => unknown) => ({ build: factory }) }
}));
vi.mock('@metorial-subspace/db', () => ({ db, Prisma: { DbNull: null } }));
vi.mock('@metorial-subspace/list-utils', () => ({}));
vi.mock('@metorial-subspace/module-search', () => ({}));
vi.mock('../../../tenant/src/lib/metorialDb', () => ({ metorialDb: {} }));
vi.mock('../../../tenant/src/lib/metorialFacing', () => ({}));
vi.mock('@metorial-subspace/module-tenant', async () => ({
  resolveMetorialFacing: async () => ({ tenant: { oid: 1n }, environment: { oid: 2n } }),
  toProviderEventBase: (d: any) => ({ instance: d.instance, auditScope: d.auditScope }),
  getOwnershipAccessor,
  ownedResourceWhere: (await import('../../../tenant/src/lib/ownershipAccess'))
    .ownedResourceWhere
}));
vi.mock('@metorial-subspace/provider', () => ({ getBackend }));
vi.mock('@metorial/fabric', () => ({ Fabric: { fire } }));
vi.mock('../queues/reconcile/callbackInstance', () => ({
  callbackInstanceReconcileManyQueue
}));
vi.mock('../queues/search/callback', () => ({ indexCallbackQueue }));

import {
  internalOwnershipAccessor,
  ownedResourceWhere,
  type OwnershipAccessor
} from '../../../tenant/src/lib/ownershipAccess';
import { callbackService } from './callback';

let stored = { folder_events: { folderIds: ['a', 'b'] }, renamed: { ids: ['x'] } };

let callback = {
  oid: 400n,
  id: 'callback_1',
  status: 'active',
  ownership: 'user',
  name: 'Drive',
  description: null,
  triggerGroupSelections: stored,
  callbackInstances: [
    {
      selectableTriggerGroups: [
        {
          key: 'folder_events',
          name: 'Folder events',
          description: null,
          status: 'active',
          selectionSchema: {
            type: 'object',
            required: ['folderIds'],
            properties: { folderIds: { type: 'array', items: { type: 'string' } } }
          }
        }
      ]
    }
  ],
  integration: { id: 'integration_1' },
  integrationProvider: { id: 'integrationProvider_1' },
  provider: { id: 'provider_1', name: 'Google Drive' }
} as any;

let update = (triggerGroupSelections?: Record<string, Record<string, any>> | null) =>
  callbackService.updateCallback({
    instance: { oid: 3n } as any,
    callback,
    input: { triggerGroupSelections }
  });

let reconcile = { integrationProviderId: 'integrationProvider_1' };

describe('callbackService.updateCallback trigger group selections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.callback.update.mockImplementation(async ({ data }: any) => ({
      ...callback,
      ...('triggerGroupSelections' in data
        ? { triggerGroupSelections: data.triggerGroupSelections }
        : {})
    }));
  });

  it('saves around a stored selection whose trigger group is no longer known', async () => {
    let next = { folder_events: { folderIds: ['a'] }, renamed: { ids: ['x'] } };

    await expect(update(next)).resolves.toMatchObject({ triggerGroupSelections: next });
    await expect(update({ folder_events: { folderIds: ['a'] } })).resolves.toMatchObject({
      triggerGroupSelections: { folder_events: { folderIds: ['a'] } }
    });
  });

  it('rejects a new or edited selection for an unknown trigger group', async () => {
    await expect(update({ ...stored, renamed: { ids: ['y'] } })).rejects.toThrow(
      'Unknown trigger group: renamed'
    );
    await expect(update({ ...stored, mistyped: {} })).rejects.toThrow(
      'Unknown trigger group: mistyped'
    );

    expect(db.callback.update).not.toHaveBeenCalled();
    expect(callbackInstanceReconcileManyQueue.add).not.toHaveBeenCalled();
  });

  it('enqueues the reconcile for every save that carries selections', async () => {
    await update(stored);

    expect(db.callback.update.mock.calls[0]![0].data).not.toHaveProperty(
      'triggerGroupSelections'
    );
    expect(callbackInstanceReconcileManyQueue.add).toHaveBeenCalledWith(reconcile);

    await update({ folder_events: { folderIds: ['a'] } });

    expect(callbackInstanceReconcileManyQueue.add).toHaveBeenCalledTimes(2);
  });

  it('still enqueues the reconcile when indexing fails', async () => {
    indexCallbackQueue.add.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(update(null)).rejects.toThrow('redis unavailable');

    expect(callbackInstanceReconcileManyQueue.add).toHaveBeenCalledWith(reconcile);
  });

  it('leaves instances alone when the selections are not part of the update', async () => {
    await update(undefined);

    expect(callbackInstanceReconcileManyQueue.add).not.toHaveBeenCalled();
  });

  it('reports the changed trigger group keys on the update event, not their values', async () => {
    await update({ folder_events: { folderIds: ['secret-folder'] } });
    await update(stored);

    let events = fire.mock.calls.filter(
      ([name]) => name === 'provider.callback.updated:after'
    );
    expect(events.map(([, event]) => event.changedTriggerGroupKeys)).toEqual([
      ['folder_events', 'renamed'],
      []
    ]);
    expect(JSON.stringify(events.map(([, event]) => event.callback))).not.toContain(
      'secret-folder'
    );
  });
});

let memberAccessor = (d: Partial<OwnershipAccessor> = {}): OwnershipAccessor => ({
  kind: 'member',
  ownActorOids: [90n],
  ownActorIds: ['actor_own'],
  isRestrictedByProject: true,
  isEnforced: true,
  allowSystemOwned: false,
  ...d
});

let encodeToken = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('callbackService.listTriggerSelectionOptions', () => {
  let listTriggerSelectionOptions = vi.fn();

  let drive = { oid: 50n, id: 'pro_drive', name: 'Google Drive' };
  let organizationActor = { oid: 7n, type: 'member' } as any;

  let list = async ({ after, ...input }: Record<string, any> = {}) => {
    let paginator = await callbackService.listTriggerSelectionOptions({
      instance: { oid: 3n } as any,
      organizationActor,
      callback: { ...callback, providerVariantOid: 500n },
      input: { triggerGroupKey: 'new_rows', field: 'spreadsheetId', ...input }
    });

    return paginator.run({ after });
  };

  let instanceWhere = () => db.callbackInstance.findFirst.mock.lastCall![0].where;

  beforeEach(() => {
    vi.clearAllMocks();
    getOwnershipAccessor.mockResolvedValue(memberAccessor());
    db.callbackInstance.findFirst.mockResolvedValue({ oid: 600n });
    db.providerVariant.findUniqueOrThrow.mockResolvedValue({ oid: 500n });
    getBackend.mockResolvedValue({ callbacks: { listTriggerSelectionOptions } });
    listTriggerSelectionOptions.mockResolvedValue({
      options: [],
      nextPageToken: null,
      source: 'own',
      linkedProvider: null
    });
  });

  it.each<[string, 'own' | 'linked', { provider: typeof drive; connected: boolean } | null]>([
    ['no linked provider', 'own', null],
    ['a linked provider that is not connected', 'own', { provider: drive, connected: false }],
    ['a connected linked provider', 'linked', { provider: drive, connected: true }]
  ])(
    'returns the options and a cursor bound to their list with %s',
    async (_, source, linkedProvider) => {
      listTriggerSelectionOptions.mockResolvedValue({
        options: [{ value: 'sheet-1', label: 'Customer Orders' }],
        nextPageToken: { offset: 50 },
        source,
        linkedProvider
      });

      let page = await list();

      expect(page).toEqual({
        items: [{ value: 'sheet-1', label: 'Customer Orders' }],
        pagination: {
          hasNextPage: true,
          hasPreviousPage: false,
          after: expect.stringMatching(/^cur_/)
        }
      });

      await list({ after: page.pagination.after });
      expect(listTriggerSelectionOptions.mock.lastCall![0].input.pageToken).toEqual({
        source,
        value: { offset: 50 }
      });
    }
  );

  it('applies the ownership rules of the caller', async () => {
    await list();

    expect(getOwnershipAccessor).toHaveBeenCalledWith({
      tenant: { oid: 1n },
      organizationActor
    });
  });

  it('lists with the newest serving instance whose connection the caller may use', async () => {
    let accessor = memberAccessor();
    getOwnershipAccessor.mockResolvedValue(accessor);

    await list();

    expect(db.callbackInstance.findFirst).toHaveBeenCalledWith({
      where: {
        callbackOid: 400n,
        tenantOid: 1n,
        id: undefined,
        status: 'active',
        generationStatus: 'primary',
        isParentDeleted: false,
        integrationInstance: ownedResourceWhere(accessor, {
          ownership: 'usable',
          fallback: { field: 'identityActorOid', relation: 'identityActor' }
        }),
        OR: [
          { providerAuthConfigVersionOid: null },
          {
            providerAuthConfigVersion: {
              authConfig: ownedResourceWhere(accessor, { ownership: 'usable' })
            }
          }
        ]
      },
      include: { providerAuthConfigVersion: { include: { authConfig: true } } },
      orderBy: { createdAt: 'desc' }
    });
  });

  it('leaves out connections of other consumers the caller may not use when ownership is enforced', async () => {
    let serialize = () =>
      JSON.stringify(instanceWhere().OR[1].providerAuthConfigVersion.authConfig, (_, value) =>
        typeof value === 'bigint' ? `${value}n` : value
      );

    await list();

    expect(serialize()).toContain('"isOwnerOnlyVisible":false');
    expect(serialize()).toContain('"ownerActorOid":{"in":["90n"]}');
    expect(serialize()).toContain('"notIn":["consumer","organization_member"]');
    expect(serialize()).not.toContain('"isOwnerLocked":false');

    getOwnershipAccessor.mockResolvedValue(memberAccessor({ isRestrictedByProject: false }));
    await list();

    expect(serialize()).toContain('"isOwnerOnlyVisible":false');
    expect(serialize()).toContain('"isOwnerLocked":false');
  });

  it('only leaves out owner-locked connections of others when the tenant does not enforce ownership', async () => {
    let accessor = memberAccessor({ isEnforced: false, isRestrictedByProject: false });
    getOwnershipAccessor.mockResolvedValue(accessor);

    await list();

    expect(instanceWhere().OR[1].providerAuthConfigVersion.authConfig).toEqual({
      AND: [
        { isSystemOwned: false },
        {
          OR: [
            { isOwnerLocked: false },
            expect.objectContaining({ OR: expect.arrayContaining([{ ownerActorOid: null }]) })
          ]
        }
      ]
    });
  });

  it('does not require the instance to be synced, so a failed replacement keeps the list', async () => {
    await list();

    expect(instanceWhere()).not.toHaveProperty('syncStatus');
  });

  it('uses the named instance only when the caller may use it', async () => {
    await list({ callbackInstanceId: 'cbi_1' });

    expect(instanceWhere()).toMatchObject({
      id: 'cbi_1',
      integrationInstance: expect.anything(),
      OR: expect.any(Array)
    });
  });

  it('answers not found for a named instance that is unknown or that the caller may not use', async () => {
    db.callbackInstance.findFirst.mockResolvedValue(null);

    await expect(list({ callbackInstanceId: 'cbi_1' })).rejects.toMatchObject({
      data: { status: 404, code: 'not_found', entity: 'callback_instance', id: 'cbi_1' }
    });
    expect(listTriggerSelectionOptions).not.toHaveBeenCalled();
  });

  it('asks to connect an account when the caller may use no instance', async () => {
    db.callbackInstance.findFirst.mockResolvedValue(null);

    await expect(list()).rejects.toMatchObject({
      data: { status: 400, code: 'callback_not_connected' }
    });
    expect(listTriggerSelectionOptions).not.toHaveBeenCalled();
  });

  it('rejects a provider without callbacks', async () => {
    getBackend.mockResolvedValue({});

    await expect(list()).rejects.toMatchObject({
      data: { status: 400, code: 'callbacks_not_supported' }
    });
  });

  it('passes a page token with the list it came from to the backend', async () => {
    await list({ after: encodeToken({ source: 'linked', value: { offset: 50 } }) });

    expect(listTriggerSelectionOptions.mock.lastCall![0].input.pageToken).toEqual({
      source: 'linked',
      value: { offset: 50 }
    });
  });

  it.each([
    ['not encoded JSON', 'not a token'],
    ['a token without its list', encodeToken({ offset: 50 })],
    ['a token of an unknown list', encodeToken({ source: 'other', value: 1 })],
    ['a plain value', encodeToken('page-2')]
  ])('rejects %s as a page token', async (_, after) => {
    await expect(list({ after })).rejects.toMatchObject({
      data: { status: 400, message: 'Invalid page token.' }
    });
    expect(listTriggerSelectionOptions).not.toHaveBeenCalled();
  });

  it.each([null, undefined, ''])(
    'reports the last page when the next token is %j',
    async value => {
      listTriggerSelectionOptions.mockResolvedValue({
        options: [],
        nextPageToken: value,
        source: 'own',
        linkedProvider: null
      });

      expect((await list()).pagination).toEqual({
        hasNextPage: false,
        hasPreviousPage: false
      });
    }
  );
});

describe('callbackService.listTriggerSelectionOptions linkable connections', () => {
  let listTriggerSelectionOptions = vi.fn();

  let drive = { oid: 50n };

  let ownConnection = {
    oid: 700n,
    tenantOid: 1n,
    environmentOid: 2n,
    backendOid: 80n,
    ownerActorOid: 90n,
    ownerPublicMcpServerOid: null,
    isSystemOwned: false
  };

  let connectedInstance = (authConfig: Record<string, any> | null) => ({
    oid: 600n,
    tenantOid: 1n,
    environmentOid: 2n,
    providerAuthConfigVersion: authConfig ? { oid: 701n, authConfig } : null
  });

  let linkable: unknown;

  let list = async () => {
    let paginator = await callbackService.listTriggerSelectionOptions({
      instance: { oid: 3n } as any,
      organizationActor: { oid: 7n, type: 'member' } as any,
      callback: { ...callback, providerVariantOid: 500n },
      input: { triggerGroupKey: 'new_rows', field: 'spreadsheetId' }
    });

    return paginator.run({});
  };

  let linkableWhere = () => db.providerAuthConfig.findMany.mock.lastCall![0].where;

  beforeEach(() => {
    vi.clearAllMocks();
    linkable = undefined;
    getOwnershipAccessor.mockResolvedValue(memberAccessor());
    db.callbackInstance.findFirst.mockResolvedValue(connectedInstance(ownConnection));
    db.providerVariant.findUniqueOrThrow.mockResolvedValue({ oid: 500n });
    db.providerAuthConfig.findMany.mockResolvedValue([]);
    getBackend.mockResolvedValue({ callbacks: { listTriggerSelectionOptions } });
    listTriggerSelectionOptions.mockImplementation(async (d: any) => {
      linkable = await d.listLinkableAuthConfigVersions({ providers: [drive] });
      return { options: [], nextPageToken: null, source: 'own', linkedProvider: null };
    });
  });

  it('loads the connection of the callback instance', async () => {
    await list();

    expect(db.callbackInstance.findFirst.mock.lastCall![0].include).toEqual({
      providerAuthConfigVersion: { include: { authConfig: true } }
    });
  });

  it('looks up no connections when the backend does not ask for them', async () => {
    listTriggerSelectionOptions.mockResolvedValue({
      options: [],
      nextPageToken: null,
      source: 'own',
      linkedProvider: null
    });

    await list();

    expect(db.providerAuthConfig.findMany).not.toHaveBeenCalled();
  });

  it('looks up no connections for an empty list of providers', async () => {
    listTriggerSelectionOptions.mockImplementation(async (d: any) => {
      linkable = await d.listLinkableAuthConfigVersions({ providers: [] });
      return { options: [], nextPageToken: null, source: 'own', linkedProvider: null };
    });

    await list();

    expect(linkable).toEqual([]);
    expect(db.providerAuthConfig.findMany).not.toHaveBeenCalled();
  });

  it('returns the current versions of usable connections of the same owner for the providers', async () => {
    let accessor = memberAccessor();
    getOwnershipAccessor.mockResolvedValue(accessor);
    let versions = [
      { oid: 801n, slateAuthConfigOid: 901n },
      { oid: 802n, slateAuthConfigOid: null }
    ];
    db.providerAuthConfig.findMany.mockResolvedValue([
      { oid: 710n, currentVersion: versions[0] },
      { oid: 711n, currentVersion: versions[1] },
      { oid: 712n, currentVersion: null }
    ]);

    await list();

    expect(db.providerAuthConfig.findMany).toHaveBeenCalledWith({
      where: {
        tenantOid: 1n,
        environmentOid: 2n,
        backendOid: 80n,
        providerOid: { in: [50n] },
        ownerActorOid: 90n,
        ownerPublicMcpServerOid: null,
        isSystemOwned: false,
        isEphemeral: false,
        status: 'active',
        isParentDeleted: false,
        currentVersionOid: { not: null },
        ...ownedResourceWhere(accessor, { ownership: 'usable' })
      },
      include: { currentVersion: true },
      orderBy: [{ createdAt: 'desc' }, { oid: 'desc' }],
      take: 100
    });
    expect(linkable).toEqual(versions);
  });

  it('matches only the owner of the callback connection', async () => {
    await list();

    expect(linkableWhere().ownerActorOid).toBe(90n);

    db.callbackInstance.findFirst.mockResolvedValue(
      connectedInstance({ ...ownConnection, ownerActorOid: 91n })
    );
    await list();

    expect(linkableWhere().ownerActorOid).toBe(91n);
  });

  it('matches a connection without an owner only with other connections without an owner', async () => {
    db.callbackInstance.findFirst.mockResolvedValue(
      connectedInstance({ ...ownConnection, ownerActorOid: null })
    );

    await list();

    expect(linkableWhere()).toMatchObject({
      ownerActorOid: null,
      ownerPublicMcpServerOid: null,
      isSystemOwned: false
    });
  });

  it('only matches lasting, active connections in the tenant and environment of the callback', async () => {
    db.callbackInstance.findFirst.mockResolvedValue({
      ...connectedInstance({ ...ownConnection, tenantOid: 5n, environmentOid: 6n }),
      tenantOid: 1n,
      environmentOid: 2n
    });

    await list();

    expect(linkableWhere()).toMatchObject({
      tenantOid: 1n,
      environmentOid: 2n,
      isEphemeral: false,
      status: 'active',
      isParentDeleted: false
    });
  });

  it('applies the ownership rules of the caller to the linked connections', async () => {
    for (let accessor of [
      memberAccessor(),
      memberAccessor({ isEnforced: false, isRestrictedByProject: false }),
      internalOwnershipAccessor
    ]) {
      getOwnershipAccessor.mockResolvedValue(accessor);

      await list();

      expect(linkableWhere().AND).toEqual(
        ownedResourceWhere(accessor, { ownership: 'usable' }).AND
      );
    }
  });

  it.each<[string, Record<string, any> | null]>([
    ['the callback instance has no connection', null],
    ['the connection belongs to a public MCP server', { ownerPublicMcpServerOid: 30n }],
    ['the connection is owned by the system', { isSystemOwned: true, ownerActorOid: null }]
  ])('allows no linked connection when %s', async (_, override) => {
    db.callbackInstance.findFirst.mockResolvedValue(
      connectedInstance(override ? { ...ownConnection, ...override } : null)
    );

    await list();

    expect(db.providerAuthConfig.findMany).not.toHaveBeenCalled();
    expect(linkable).toEqual([]);
  });
});
