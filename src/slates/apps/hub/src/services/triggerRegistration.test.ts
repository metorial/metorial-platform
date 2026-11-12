import { beforeEach, describe, expect, it, vi } from 'vitest';

let db = {
  $transaction: vi.fn(),
  slateInstance: { findFirst: vi.fn() },
  slateTriggerGroup: { findMany: vi.fn() },
  triggerRegistration: { create: vi.fn(), findUniqueOrThrow: vi.fn() },
  triggerRegistrationInstance: { createMany: vi.fn(), findMany: vi.fn() }
};
let setupQueue = { addManyWithOps: vi.fn() };
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
