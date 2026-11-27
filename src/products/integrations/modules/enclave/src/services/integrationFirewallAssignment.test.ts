import { beforeEach, describe, expect, it, vi } from 'vitest';

let { mockDb, mockFirewallAssignmentCreatedQueue, mockFirewallAssignmentDeletedQueue } =
  vi.hoisted(() => ({
    mockDb: {
      firewall: {
        findFirst: vi.fn()
      },
      integrationFirewallAssignment: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        delete: vi.fn()
      },
      integrationEnclave: {
        findFirst: vi.fn()
      },
      providerUse: {
        findFirst: vi.fn()
      }
    },
    mockFirewallAssignmentCreatedQueue: {
      add: vi.fn()
    },
    mockFirewallAssignmentDeletedQueue: {
      add: vi.fn()
    }
  }));

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

vi.mock('../lib/firewallAssignmentValidation', () => ({
  validateFirewallAssignmentInput: (assignment: unknown) => assignment,
  validateFirewallAssignmentInputs: (assignments: unknown[]) => assignments
}));

vi.mock('../queues/lifecycle/firewallAssignment', () => ({
  firewallAssignmentCreatedQueue: mockFirewallAssignmentCreatedQueue,
  firewallAssignmentDeletedQueue: mockFirewallAssignmentDeletedQueue
}));

import { integrationFirewallAssignmentService } from './integrationFirewallAssignment';

let tenant = { oid: BigInt(10), id: 'ktn_test', projectOid: BigInt(11) } as any;
let environment = { oid: BigInt(20), id: 'ken_test', instanceOid: BigInt(21) } as any;

let bindingIncludeResult = {
  id: 'fwb_test',
  targetType: 'enclave',
  createdAt: new Date(),
  firewall: { id: 'fwl_test', slug: 'prod', name: 'Production' },
  enclave: { id: 'enc_test', slug: 'api', name: 'API' },
  provider: null,
  internetGateway: null
};

describe('integrationFirewallAssignmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a binding for a firewall', async () => {
    mockDb.firewall.findFirst.mockResolvedValueOnce({
      oid: BigInt(200),
      id: 'fwl_test',
      internetGateway: { oid: BigInt(100), id: 'net_test' }
    });
    mockDb.integrationEnclave.findFirst.mockResolvedValueOnce({
      oid: BigInt(300),
      internetGatewayOid: BigInt(100)
    });
    mockDb.integrationFirewallAssignment.findFirst.mockResolvedValueOnce(null);
    mockDb.integrationFirewallAssignment.create.mockResolvedValueOnce(bindingIncludeResult);

    let assignment =
      await integrationFirewallAssignmentService.createFirewallAssignmentInternal({
        tenant,
        environment,
        firewallId: 'fwl_test',
        input: { targetType: 'enclave', enclaveId: 'enc_test' }
      });

    expect(assignment).toEqual(bindingIncludeResult);
    expect(mockDb.integrationFirewallAssignment.create).toHaveBeenCalledTimes(1);
    expect(mockDb.integrationFirewallAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firewallOid: BigInt(200),
          enclaveOid: BigInt(300),
          tenantOid: tenant.oid,
          projectOid: tenant.projectOid,
          environmentOid: environment.oid,
          instanceOid: environment.instanceOid
        })
      })
    );
    expect(mockFirewallAssignmentCreatedQueue.add).toHaveBeenCalledWith({
      firewallAssignmentId: 'fwb_test'
    });
  });

  it('returns an existing binding when the target is already bound', async () => {
    mockDb.firewall.findFirst.mockResolvedValueOnce({
      oid: BigInt(200),
      id: 'fwl_test',
      internetGateway: { oid: BigInt(100), id: 'net_test' }
    });
    mockDb.integrationEnclave.findFirst.mockResolvedValueOnce({
      oid: BigInt(300),
      internetGatewayOid: BigInt(100)
    });
    mockDb.integrationFirewallAssignment.findFirst.mockResolvedValueOnce(bindingIncludeResult);

    let assignment =
      await integrationFirewallAssignmentService.createFirewallAssignmentInternal({
        tenant,
        environment,
        firewallId: 'fwl_test',
        input: { targetType: 'enclave', enclaveId: 'enc_test' }
      });

    expect(assignment).toEqual(bindingIncludeResult);
    expect(mockDb.integrationFirewallAssignment.create).not.toHaveBeenCalled();
    expect(mockFirewallAssignmentCreatedQueue.add).not.toHaveBeenCalled();
  });

  it('deletes a binding and resets linked enclaves', async () => {
    mockDb.integrationFirewallAssignment.findFirst.mockResolvedValueOnce({
      oid: BigInt(900),
      id: 'fwb_test',
      tenantOid: tenant.oid,
      environmentOid: environment.oid,
      enclaveOid: BigInt(300),
      providerOid: null,
      internetGatewayOid: null,
      firewall: {
        internetGatewayOid: BigInt(100)
      }
    });
    mockDb.integrationFirewallAssignment.delete.mockResolvedValueOnce({ id: 'fwb_test' });

    await integrationFirewallAssignmentService.deleteFirewallAssignmentInternal({
      tenant,
      environment,
      firewallAssignment: {
        oid: BigInt(900),
        id: 'fwb_test',
        tenantOid: tenant.oid,
        environmentOid: environment.oid
      } as any
    });

    expect(mockDb.integrationFirewallAssignment.delete).toHaveBeenCalledWith({
      where: { oid: BigInt(900) },
      include: expect.any(Object)
    });
    expect(mockFirewallAssignmentDeletedQueue.add).toHaveBeenCalledWith({
      firewallInternetGatewayOid: '100',
      tenantOid: '10',
      environmentOid: '20',
      enclaveOid: '300',
      providerOid: null,
      assignmentInternetGatewayOid: null
    });
  });
});
