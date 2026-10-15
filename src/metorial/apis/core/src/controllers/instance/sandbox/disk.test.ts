import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { declarePresenter } from '@metorial/presenter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Controller,
  Group,
  Handler,
  Path
} from '../../../../../../packages/rest/src/controller';
import { introspectApi } from '../../../../../../packages/rest/src/introspect';
import { v1SandboxDiskPresenter } from '../../../../../../presenters/src/implementation/sandbox/disk';
import { v1SandboxDiskMountPresenter } from '../../../../../../presenters/src/implementation/sandbox/diskMount';
import { sandboxDiskMountType, sandboxDiskType } from '../../../../../../presenters/src/types';

let mocks = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  checkAccess: vi.fn(),
  checkTargetAccess: vi.fn(),
  getFlags: vi.fn()
}));

vi.mock('@metorial/rest', () => ({ Controller, Group, Handler, Path }));

vi.mock('@metorial/module-sandbox', () => ({
  sandboxFailureCodes: ['internal_error'],
  sandboxBuildFailureCodes: ['internal_error'],
  mapSandboxFailure: vi.fn(),
  sandboxDiskService: { get: mocks.get, list: mocks.list, update: mocks.update }
}));
vi.mock('@metorial/module-access', () => ({
  accessService: { checkAccess: mocks.checkAccess, checkTargetAccess: mocks.checkTargetAccess }
}));
vi.mock('@metorial/module-flags', () => ({
  flagService: { getFlags: mocks.getFlags },
  isFlagEnabled: (flag: unknown) => flag === true,
  getFlagDisabledReason: () => undefined
}));
vi.mock('../../../middleware/apiGroup', () => ({ apiGroup: Group.create() }));
vi.mock('../../../middleware/instanceGroup', () => ({
  instanceGroup: Group.create(),
  instancePath: (path: string, sdkPath: string) => [
    Path(`/${path}`, sdkPath),
    Path(`/instances/:instanceId/${path}`, `management.instance.${sdkPath}`),
    Path(`/dashboard/instances/:instanceId/${path}`, `dashboard.instance.${sdkPath}`)
  ]
}));
vi.mock('@metorial/presenters', () => ({
  sandboxDiskPresenter: declarePresenter(sandboxDiskType, {
    mt_2025_01_01_dashboard: v1SandboxDiskPresenter,
    mt_2026_01_01_magnetar: v1SandboxDiskPresenter
  }),
  sandboxDiskMountPresenter: declarePresenter(sandboxDiskMountType, {
    mt_2025_01_01_dashboard: v1SandboxDiskMountPresenter,
    mt_2026_01_01_magnetar: v1SandboxDiskMountPresenter
  })
}));

let { sandboxDiskController } = await import('./disk');

let diskHandler = (method: 'list' | 'update') => {
  let handler = sandboxDiskController.handlers[method];
  if (!(handler instanceof Handler)) throw new Error('Expected a disk handler');

  return handler;
};

let instance = { oid: 7n, project: { oid: 8n }, organization: { oid: 9n } };
let context = { instance, organization: instance.organization, project: instance.project };
let disk = { id: 'sbd_1', type: 'standard' };

let request = (input: { query?: Record<string, unknown>; body?: Record<string, unknown> }) =>
  ({
    body: input.body ?? {},
    query: input.query ?? {},
    apiVersion: 'mt_2025_01_01_dashboard',
    auth: { type: 'machine' },
    params: { diskId: 'sbd_1' },
    sharedMiddlewareMemo: new Map()
  }) as any;

let paginator = () => ({
  run: vi.fn().mockResolvedValue({
    items: [],
    pagination: { hasMoreBefore: false, hasMoreAfter: false }
  })
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getFlags.mockResolvedValue({ 'sandbox-enabled': true, 'paid-sandboxes': true });
  mocks.get.mockResolvedValue(disk);
  mocks.list.mockReturnValue(paginator());
  mocks.update.mockResolvedValue(disk);
});

describe('sandbox disk list filters', () => {
  it.each([{ id: 'sbd_1' }, { id: ['a', 'b'] }, { id: [] }])(
    'normalizes ID filters: %o',
    async ({ id }) => {
      await diskHandler('list').run(request({ query: { id } }), context);

      expect(mocks.list).toHaveBeenCalledWith(
        expect.objectContaining({ diskIds: Array.isArray(id) ? id : [id] })
      );
    }
  );

  it('forwards no filters by default', async () => {
    await diskHandler('list').run(request({}), context);

    expect(mocks.list).toHaveBeenCalledWith({
      instance,
      diskIds: undefined,
      types: undefined,
      machineIds: undefined,
      regionIdentifiers: undefined,
      attached: undefined,
      search: undefined
    });
  });

  it.each([
    { region: 'us-east-1', expected: ['us-east-1'] },
    { region: ['us-east-1', 'eu-west-1'], expected: ['us-east-1', 'eu-west-1'] }
  ])('normalizes the region filter: %o', async ({ region, expected }) => {
    await diskHandler('list').run(request({ query: { region } }), context);

    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ regionIdentifiers: expected })
    );
  });

  it.each([
    { attached: 'true', expected: true },
    { attached: 'false', expected: false }
  ])('parses the attached filter: %o', async ({ attached, expected }) => {
    await diskHandler('list').run(request({ query: { attached } }), context);

    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ attached: expected }));
  });

  it('forwards the search term and the existing filters', async () => {
    await diskHandler('list').run(
      request({ query: { search: 'data', type: 'standard', machine_id: ['sbm_1', 'sbm_2'] } }),
      context
    );

    expect(mocks.list).toHaveBeenCalledWith({
      instance,
      diskIds: undefined,
      types: ['standard'],
      machineIds: ['sbm_1', 'sbm_2'],
      regionIdentifiers: undefined,
      attached: undefined,
      search: 'data'
    });
  });

  it('rejects an invalid attached filter', async () => {
    await expect(
      diskHandler('list').run(request({ query: { attached: 'maybe' } }), context)
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(mocks.list).not.toHaveBeenCalled();
  });
});

describe('sandbox disk update', () => {
  it('renames the disk', async () => {
    await diskHandler('update').run(request({ body: { name: 'scratch' } }), context);

    expect(mocks.get).toHaveBeenCalledWith({ instance, diskId: 'sbd_1' });
    expect(mocks.update).toHaveBeenCalledWith({
      disk,
      input: { metadata: undefined, name: 'scratch' }
    });
    expect(mocks.checkAccess).toHaveBeenCalledWith(
      expect.objectContaining({ possibleScopes: ['instance.sandbox:write'] })
    );
  });

  it('clears the name with null', async () => {
    await diskHandler('update').run(request({ body: { name: null } }), context);

    expect(mocks.update).toHaveBeenCalledWith({
      disk,
      input: { metadata: undefined, name: null }
    });
  });

  it('leaves the name alone when it is omitted', async () => {
    await diskHandler('update').run(request({ body: {} }), context);

    expect(mocks.update).toHaveBeenCalledWith({
      disk,
      input: { metadata: undefined, name: undefined }
    });
  });

  it.each([{ name: '' }, { name: 'x'.repeat(129) }, { name: 5 }])(
    'rejects an invalid name: %o',
    async body => {
      await expect(
        diskHandler('update').run(request({ body }), context)
      ).rejects.toMatchObject({ data: { status: 400 } });
      expect(mocks.update).not.toHaveBeenCalled();
    }
  );

  it.each([
    [{ 'sandbox-enabled': false, 'paid-sandboxes': true }, 403],
    [{ 'sandbox-enabled': true, 'paid-sandboxes': false }, 402]
  ])('enforces the sandbox flags: %o', async (flags, status) => {
    mocks.getFlags.mockResolvedValue(flags);

    await expect(
      diskHandler('update').run(request({ body: { name: 'scratch' } }), context)
    ).rejects.toMatchObject({ data: { status } });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejects callers without sandbox write access', async () => {
    mocks.checkAccess.mockRejectedValue(new ServiceError(forbiddenError()));

    await expect(
      diskHandler('update').run(request({ body: { name: 'scratch' } }), context)
    ).rejects.toMatchObject({ data: { status: 403 } });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe('sandbox disk introspection', () => {
  let introspection = introspectApi({
    rootController: Controller.create(
      { name: 'Test', description: 'Test' },
      { disks: sandboxDiskController }
    ),
    displayVersion: 'mt_2025_01_01_dashboard',
    version: 'mt_2025_01_01_dashboard',
    isCurrent: true
  });

  let endpoint = (sdkPath: string) =>
    introspection.endpoints.find(endpoint => endpoint.path.sdkPath == sdkPath)!;

  it('exposes the update route under every alias', () => {
    let update = endpoint('sandbox.disks.update');

    expect(update.method).toBe('patch');
    expect(update.allPaths.map((path: { path: string }) => path.path)).toEqual([
      '/sandbox/disks/:diskId',
      '/instances/:instanceId/sandbox/disks/:diskId',
      '/dashboard/instances/:instanceId/sandbox/disks/:diskId'
    ]);

    let body = introspection.types.find(type => type.id === update.bodyId)!.type as any;
    expect(body.properties.name.optional).toBe(true);
  });

  it('exposes the new list filters', () => {
    let list = endpoint('sandbox.disks.list');
    let query = introspection.types.find(type => type.id === list.queryId)!.type as any;
    let filters = query.items[1].properties;

    expect(Object.keys(filters)).toEqual(
      expect.arrayContaining(['type', 'machine_id', 'region', 'attached', 'search'])
    );
    expect(filters.attached.optional).toBe(true);
    expect(filters.search.optional).toBe(true);
  });
});

it('forwards disk metadata updates', async () => {
  await diskHandler('update').run(
    request({ body: { metadata: { app: 'test', nested: { enabled: true } } } }),
    context
  );

  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({
      input: expect.objectContaining({ metadata: { app: 'test', nested: { enabled: true } } })
    })
  );
});
