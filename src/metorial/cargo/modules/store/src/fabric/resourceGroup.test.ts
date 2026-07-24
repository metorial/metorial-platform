import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  listener: undefined as
    | ((event: {
        resourceTenant: { oid: bigint; id: string };
        resourceGroup: { id: string };
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

import './resourceGroup';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resource group store-template reconciliation', () => {
  it('enqueues matching standalone templates for the created group', async () => {
    mocks.findMany.mockResolvedValue([{ id: 'stt_1' }, { id: 'stt_2' }]);

    await mocks.listener?.({
      resourceTenant: {
        oid: 1n,
        id: 'crg_tn_1'
      },
      resourceGroup: {
        id: 'crg_en_1'
      }
    });

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        type: 'standalone',
        resourceGroupOid: null,
        OR: [{ resourceTenantOid: null }, { resourceTenantOid: 1n }]
      },
      select: {
        id: true
      }
    });
    expect(mocks.addMany).toHaveBeenCalledWith([
      {
        storeTemplateId: 'stt_1',
        resourceTenantId: 'crg_tn_1',
        resourceGroupId: 'crg_en_1',
        forceFullReconcile: true
      },
      {
        storeTemplateId: 'stt_2',
        resourceTenantId: 'crg_tn_1',
        resourceGroupId: 'crg_en_1',
        forceFullReconcile: true
      }
    ]);
  });
});
