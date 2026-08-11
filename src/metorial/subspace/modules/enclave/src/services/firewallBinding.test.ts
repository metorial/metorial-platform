import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb, mockFirewallBindingCreatedQueue, mockFirewallBindingDeletedQueue } = vi.hoisted(
  () => ({
    mockDb: {
      firewall: {
        findFirst: vi.fn()
      },
      firewallBinding: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        delete: vi.fn()
      },
      enclave: {
        findFirst: vi.fn()
      },
      providerUse: {
        findFirst: vi.fn()
      }
    },
    mockFirewallBindingCreatedQueue: {
      add: vi.fn()
    },
    mockFirewallBindingDeletedQueue: {
      add: vi.fn()
    }
  })
);

vi.mock('@metorial-subspace/db', () => ({
  db: mockDb,
  withTransaction: async (cb: (db: typeof mockDb) => Promise<unknown>) => cb(mockDb),
  addAfterTransactionHook: async (cb: () => Promise<void>) => cb(),
  getId: (model: string) => ({
    oid: BigInt(model.length),
    id: `${model}_test_id`
  })
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  checkTenant: vi.fn()
}));

vi.mock('../lib/firewallBindingValidation', () => ({
  validateFirewallBindingInput: (binding: unknown) => binding,
  validateFirewallBindingInputs: (bindings: unknown[]) => bindings
}));

vi.mock('../queues/lifecycle/firewallBinding', () => ({
  firewallBindingCreatedQueue: mockFirewallBindingCreatedQueue,
  firewallBindingDeletedQueue: mockFirewallBindingDeletedQueue
}));

import { firewallBindingService } from './firewallBinding';

let tenant = { oid: BigInt(10), id: 'ktn_test' } as any;
let environment = { oid: BigInt(20), id: 'ken_test' } as any;

let bindingIncludeResult = {
  id: 'fwb_test',
  targetType: 'enclave',
  createdAt: new Date(),
  firewall: { id: 'fwl_test', slug: 'prod', name: 'Production' },
  enclave: { id: 'enc_test', slug: 'api', name: 'API' },
  provider: null,
  network: null
};

describe('firewallBindingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a binding for a firewall', async () => {
    mockDb.firewall.findFirst.mockResolvedValueOnce({
      oid: BigInt(200),
      id: 'fwl_test',
      network: { oid: BigInt(100), id: 'net_test' }
    });
    mockDb.enclave.findFirst.mockResolvedValueOnce({
      oid: BigInt(300),
      networkOid: BigInt(100)
    });
    mockDb.firewallBinding.findFirst.mockResolvedValueOnce(null);
    mockDb.firewallBinding.create.mockResolvedValueOnce(bindingIncludeResult);

    let binding = await firewallBindingService.createFirewallBindingInternal({
      tenant,
      environment,
      firewallId: 'fwl_test',
      input: { targetType: 'enclave', enclaveId: 'enc_test' }
    });

    expect(binding).toEqual(bindingIncludeResult);
    expect(mockDb.firewallBinding.create).toHaveBeenCalledTimes(1);
    expect(mockFirewallBindingCreatedQueue.add).toHaveBeenCalledWith({
      firewallBindingId: 'fwb_test'
    });
  });

  it('returns an existing binding when the target is already bound', async () => {
    mockDb.firewall.findFirst.mockResolvedValueOnce({
      oid: BigInt(200),
      id: 'fwl_test',
      network: { oid: BigInt(100), id: 'net_test' }
    });
    mockDb.enclave.findFirst.mockResolvedValueOnce({
      oid: BigInt(300),
      networkOid: BigInt(100)
    });
    mockDb.firewallBinding.findFirst.mockResolvedValueOnce(bindingIncludeResult);

    let binding = await firewallBindingService.createFirewallBindingInternal({
      tenant,
      environment,
      firewallId: 'fwl_test',
      input: { targetType: 'enclave', enclaveId: 'enc_test' }
    });

    expect(binding).toEqual(bindingIncludeResult);
    expect(mockDb.firewallBinding.create).not.toHaveBeenCalled();
    expect(mockFirewallBindingCreatedQueue.add).not.toHaveBeenCalled();
  });

  it('deletes a binding and resets linked enclaves', async () => {
    mockDb.firewallBinding.findFirst.mockResolvedValueOnce({
      oid: BigInt(900),
      id: 'fwb_test',
      tenantOid: tenant.oid,
      environmentOid: environment.oid,
      enclaveOid: BigInt(300),
      providerOid: null,
      networkOid: null,
      firewall: {
        networkOid: BigInt(100)
      }
    });
    mockDb.firewallBinding.delete.mockResolvedValueOnce({ id: 'fwb_test' });

    await firewallBindingService.deleteFirewallBindingInternal({
      tenant,
      environment,
      firewallBinding: {
        oid: BigInt(900),
        id: 'fwb_test',
        tenantOid: tenant.oid,
        environmentOid: environment.oid
      } as any
    });

    expect(mockDb.firewallBinding.delete).toHaveBeenCalledWith({
      where: { oid: BigInt(900) },
      include: expect.any(Object)
    });
    expect(mockFirewallBindingDeletedQueue.add).toHaveBeenCalledWith({
      firewallNetworkOid: '100',
      tenantOid: '10',
      environmentOid: '20',
      enclaveOid: '300',
      providerOid: null,
      bindingNetworkOid: null
    });
  });
});
