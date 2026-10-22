import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Controller,
  Group,
  Handler,
  Path
} from '../../../../../../packages/rest/src/controller';
import { introspectApi } from '../../../../../../packages/rest/src/introspect';

let mocks = vi.hoisted(() => ({
  imageGet: vi.fn(),
  imageList: vi.fn(),
  imageCreate: vi.fn(),
  imageUpdate: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  execCommand: vi.fn(),
  operationList: vi.fn(),
  checkAccess: vi.fn(),
  checkTargetAccess: vi.fn(),
  getFlags: vi.fn()
}));

vi.mock('@metorial/rest', () => ({ Controller, Group, Handler, Path }));

vi.mock('@metorial/module-sandbox', () => ({
  sandboxMachineService: { get: mocks.get, list: mocks.list, update: mocks.update },
  sandboxImageService: {
    get: mocks.imageGet,
    list: mocks.imageList,
    create: mocks.imageCreate,
    update: mocks.imageUpdate
  },
  sandboxImageBuildService: {},
  sandboxImageVersionService: {},
  sandboxMachineAccessService: { execCommand: mocks.execCommand },
  sandboxMachineOperationService: { list: mocks.operationList },
  machineExecDefaultTimeoutSeconds: 60,
  machineExecMaxTimeoutSeconds: 300
}));
vi.mock('@metorial/module-file', () => ({ fileService: {} }));

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
vi.mock('@metorial/presenters', () => {
  let stub = () => ({
    type: {},
    present: () => () => ({}),
    introspect: () => ({
      name: 'stub',
      object: {
        type: 'object',
        examples: [],
        properties: {},
        optional: false,
        nullable: false
      }
    })
  });

  return {
    sandboxImagePresenter: stub(),
    sandboxImageBuildPresenter: stub(),
    sandboxImageVersionPresenter: stub(),
    sandboxMachinePresenter: stub(),
    sandboxMachineAccessPresenter: stub(),
    sandboxMachineExecResultPresenter: stub(),
    sandboxMachineUsagePresenter: stub(),
    sandboxMachineOperationPresenter: stub()
  };
});

let { sandboxMachineController } = await import('./machine');
let { sandboxImageController } = await import('./image');
let { sandboxMachineOperationController } = await import('./machineOperation');

let handlerOf = (controller: { handlers: Record<string, unknown> }, method: string) => {
  let handler = controller.handlers[method];
  if (!(handler instanceof Handler)) throw new Error(`Expected a ${method} handler`);

  return handler;
};

let instance = { oid: 7n, project: { oid: 8n }, organization: { oid: 9n } };
let context = { instance, organization: instance.organization, project: instance.project };
let machine = { id: 'sbm_1' };

let request = (input: { query?: Record<string, unknown>; body?: Record<string, unknown> }) =>
  ({
    body: input.body ?? {},
    query: input.query ?? {},
    apiVersion: 'mt_2025_01_01_dashboard',
    auth: { type: 'machine' },
    params: { machineId: 'sbm_1' },
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
  mocks.get.mockResolvedValue(machine);
  mocks.list.mockResolvedValue(paginator());
  mocks.update.mockResolvedValue(machine);
  mocks.operationList.mockReturnValue(paginator());
});

describe('sandbox machine list filters', () => {
  it.each([{ id: 'sbm_1' }, { id: ['a', 'b'] }, { id: [] }])(
    'normalizes ID filters: %o',
    async ({ id }) => {
      await handlerOf(sandboxMachineController, 'list').run(
        request({ query: { id } }),
        context
      );

      expect(mocks.list).toHaveBeenCalledWith(
        expect.objectContaining({ machineIds: Array.isArray(id) ? id : [id] })
      );
    }
  );

  let list = () => handlerOf(sandboxMachineController, 'list');

  it('forwards no state or region filter by default', async () => {
    await list().run(request({}), context);

    expect(mocks.list).toHaveBeenCalledWith({
      instance,
      machineIds: undefined,
      statuses: undefined,
      states: undefined,
      imageIds: undefined,
      regionIdentifiers: undefined,
      search: undefined
    });
  });

  it.each([
    { state: 'running', expected: ['running'] },
    {
      state: ['running', 'paused', 'hibernated'],
      expected: ['running', 'paused', 'hibernated']
    }
  ])('normalizes the state filter: %o', async ({ state, expected }) => {
    await list().run(request({ query: { state } }), context);

    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ states: expected }));
  });

  it('keeps the existing status filter separate from the state filter', async () => {
    await list().run(request({ query: { status: 'deleted', state: 'terminated' } }), context);

    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: ['deleted'], states: ['terminated'] })
    );
  });

  it.each([
    { region: 'us-east-1', expected: ['us-east-1'] },
    { region: ['us-east-1', 'eu-west-1'], expected: ['us-east-1', 'eu-west-1'] }
  ])('normalizes the region filter: %o', async ({ region, expected }) => {
    await list().run(request({ query: { region } }), context);

    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ regionIdentifiers: expected })
    );
  });

  it('rejects an unknown state', async () => {
    await expect(
      list().run(request({ query: { state: 'sleeping' } }), context)
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(mocks.list).not.toHaveBeenCalled();
  });
});

describe('sandbox machine update', () => {
  let update = () => handlerOf(sandboxMachineController, 'update');

  it('passes public ports to the service', async () => {
    await update().run(request({ body: { public_ports: [8080, 3000] } }), context);

    expect(mocks.update).toHaveBeenCalledWith({
      machine,
      organization: instance.organization,
      input: expect.objectContaining({ publicPorts: [8080, 3000] })
    });
  });

  it('passes an empty list to close every public port', async () => {
    await update().run(request({ body: { public_ports: [] } }), context);

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ input: expect.objectContaining({ publicPorts: [] }) })
    );
  });

  it('leaves public ports alone when they are omitted', async () => {
    await update().run(request({ body: { name: 'api' } }), context);

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ name: 'api', publicPorts: undefined })
      })
    );
  });

  it('rejects invalid public ports', async () => {
    await expect(
      update().run(request({ body: { public_ports: ['http'] } }), context)
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejects callers without sandbox write access', async () => {
    mocks.checkAccess.mockRejectedValue(new ServiceError(forbiddenError()));

    await expect(
      update().run(request({ body: { public_ports: [8080] } }), context)
    ).rejects.toMatchObject({ data: { status: 403 } });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe('sandbox machine exec', () => {
  it('lifts the idle timeout and hands the request signal to the exec', async () => {
    let setIdleTimeout = vi.fn();
    let signal = new AbortController().signal;
    mocks.execCommand.mockResolvedValue({ exitCode: 0 });

    await handlerOf(sandboxMachineController, 'exec').run(
      { ...request({ body: { command: 'ls' } }), signal, setIdleTimeout },
      context
    );

    expect(setIdleTimeout).toHaveBeenCalledWith(0);
    expect(mocks.execCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        machine,
        signal,
        input: expect.objectContaining({ command: 'ls' })
      })
    );
  });
});

describe('sandbox machine operation list', () => {
  let list = () => handlerOf(sandboxMachineOperationController, 'list');

  it.each([
    { kind: 'restart', expected: ['restart'] },
    { kind: ['start', 'restart', 'terminate'], expected: ['start', 'restart', 'terminate'] }
  ])('normalizes the kind filter: %o', async ({ kind, expected }) => {
    await list().run(request({ query: { kind } }), context);

    expect(mocks.operationList).toHaveBeenCalledWith(
      expect.objectContaining({ machine, kinds: expected })
    );
  });

  it('forwards the requested order to the paginator', async () => {
    let page = paginator();
    mocks.operationList.mockReturnValue(page);

    await list().run(request({ query: { order: 'desc' } }), context);

    expect(page.run).toHaveBeenCalledWith(expect.objectContaining({ order: 'desc' }));
  });

  it('rejects an unknown kind', async () => {
    await expect(
      list().run(request({ query: { kind: 'explode' } }), context)
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(mocks.operationList).not.toHaveBeenCalled();
  });
});

describe('sandbox machine introspection', () => {
  let introspection = introspectApi({
    rootController: Controller.create(
      { name: 'Test', description: 'Test' },
      { machines: sandboxMachineController, operations: sandboxMachineOperationController }
    ),
    displayVersion: 'mt_2025_01_01_dashboard',
    version: 'mt_2025_01_01_dashboard',
    isCurrent: true
  });

  let filters = (sdkPath: string) => {
    let endpoint = introspection.endpoints.find(endpoint => endpoint.path.sdkPath == sdkPath)!;
    let query = introspection.types.find(type => type.id === endpoint.queryId)!.type as any;

    return query.items[1].properties;
  };

  it('exposes the state and region filters on the machine list', () => {
    let properties = filters('sandbox.machines.list');

    expect(Object.keys(properties)).toEqual(
      expect.arrayContaining(['status', 'state', 'region', 'image_id', 'search'])
    );
  });
});

it('forwards machine metadata updates', async () => {
  await handlerOf(sandboxMachineController, 'update').run(
    request({ body: { metadata: { app: 'test', nested: { enabled: true } } } }),
    context
  );

  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({
      input: expect.objectContaining({ metadata: { app: 'test', nested: { enabled: true } } })
    })
  );
});

it('never forwards image changes on machine update', async () => {
  try {
    await handlerOf(sandboxMachineController, 'update').run(
      request({ body: { image_id: 'sbi_other' } }),
      context
    );
  } catch (error) {
    expect(error).toMatchObject({ data: { status: 400 } });
  }

  for (let [call] of mocks.update.mock.calls) {
    expect(call.input).not.toHaveProperty('imageId');
  }
});

describe('sandbox image metadata and IDs', () => {
  it.each([{ id: 'sbi_1' }, { id: ['sbi_1', 'sbi_2'] }, { id: [] }])(
    'normalizes image ID filters: %o',
    async ({ id }) => {
      mocks.imageList.mockResolvedValue(paginator());

      await handlerOf(sandboxImageController, 'list').run(request({ query: { id } }), context);

      expect(mocks.imageList).toHaveBeenCalledWith(
        expect.objectContaining({ imageIds: Array.isArray(id) ? id : [id] })
      );
    }
  );

  it.each(['create', 'update'])('passes metadata to image %s', async method => {
    let req = request({ body: { metadata: { app: 'test' } } });
    req.params.imageId = 'sbi_1';
    mocks.imageGet.mockResolvedValue({ id: 'sbi_1' });

    await handlerOf(sandboxImageController, method).run(req, context);

    expect(method === 'create' ? mocks.imageCreate : mocks.imageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ metadata: { app: 'test' } })
      })
    );
  });
});
