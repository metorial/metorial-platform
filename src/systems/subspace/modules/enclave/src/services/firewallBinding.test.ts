import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb } = vi.hoisted(() => ({
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
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: mockDb,
  withTransaction: async (cb: (db: typeof mockDb) => Promise<unknown>) => cb(mockDb),
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

    let binding = await firewallBindingService.createFirewallBinding({
      tenant,
      environment,
      firewallId: 'fwl_test',
      input: { targetType: 'enclave', enclaveId: 'enc_test' }
    });

    expect(binding).toEqual(bindingIncludeResult);
    expect(mockDb.firewallBinding.create).toHaveBeenCalledTimes(1);
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

    let binding = await firewallBindingService.createFirewallBinding({
      tenant,
      environment,
      firewallId: 'fwl_test',
      input: { targetType: 'enclave', enclaveId: 'enc_test' }
    });

    expect(binding).toEqual(bindingIncludeResult);
    expect(mockDb.firewallBinding.create).not.toHaveBeenCalled();
  });

  it('deletes a binding', async () => {
    mockDb.firewallBinding.delete.mockResolvedValueOnce({ id: 'fwb_test' });

    await firewallBindingService.deleteFirewallBinding({
      tenant,
      environment,
      firewallBinding: {
        oid: BigInt(900),
        tenantOid: tenant.oid,
        environmentOid: environment.oid
      } as any
    });

    expect(mockDb.firewallBinding.delete).toHaveBeenCalledWith({
      where: { oid: BigInt(900) }
    });
  });
});
