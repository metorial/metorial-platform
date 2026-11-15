import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  listener: undefined as
    | ((event: {
        project: { oid: bigint; id: string };
        instance: { id: string };
      }) => Promise<void>)
    | undefined,
  findMany: vi.fn(),
  addMany: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    storeTemplate: {
      findMany: mocks.findMany
    }
  }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    listen: vi.fn((_event, listener) => {
      mocks.listener = listener;
    })
  }
}));

vi.mock('../queues/storeTemplateSync', () => ({
  storeTemplateSyncSingleQueue: {
    addMany: mocks.addMany
  }
}));

import './instance';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('instance store-template reconciliation', () => {
  it('enqueues matching standalone templates for the created instance', async () => {
    mocks.findMany.mockResolvedValue([{ id: 'stt_1' }, { id: 'stt_2' }]);

    await mocks.listener?.({
      project: {
        oid: 1n,
        id: 'prj_1'
      },
      instance: {
        id: 'ins_1'
      }
    });

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        type: 'standalone',
        instanceOid: null,
        OR: [{ projectOid: null }, { projectOid: 1n }]
      },
      select: {
        id: true
      }
    });
    expect(mocks.addMany).toHaveBeenCalledWith([
      {
        storeTemplateId: 'stt_1',
        instanceId: 'ins_1',
        forceFullReconcile: true
      },
      {
        storeTemplateId: 'stt_2',
        instanceId: 'ins_1',
        forceFullReconcile: true
      }
    ]);
  });
});
