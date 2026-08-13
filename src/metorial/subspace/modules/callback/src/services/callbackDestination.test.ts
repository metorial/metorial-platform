import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  callbackDestinationCreate: vi.fn(),
  callbackDestinationUpdate: vi.fn(),
  callbackDestinationFindFirstOrThrow: vi.fn(),
  callbackDestinationLinkFindMany: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/pagination', () => ({
  Paginator: {
    create: vi.fn(),
    present: vi.fn(),
    validate: vi.fn()
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: {
    callbackDestination: {
      create: mocks.callbackDestinationCreate,
      update: mocks.callbackDestinationUpdate,
      findFirst: vi.fn(),
      findFirstOrThrow: mocks.callbackDestinationFindFirstOrThrow,
      findMany: vi.fn()
    },
    callbackDestinationLink: {
      findMany: mocks.callbackDestinationLinkFindMany
    }
  },
  CallbackDestinationStatus: { active: 'active', archived: 'archived', deleted: 'deleted' },
  getId: (model: string) => ({ oid: 700n, id: `${model}_1` })
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  normalizeDateFilter: vi.fn()
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: async () => ({ oid: 1 }),
  resolveMetorialFacing: vi.fn(),
  toProviderEventBase: vi.fn()
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('./callbackRegistration', () => ({
  callbackRegistrationService: { syncCallback: vi.fn() }
}));

vi.mock('../signal', () => ({
  getTenantForSignal: vi.fn(),
  signal: { eventDestination: { get: vi.fn() } }
}));

import { callbackDestinationService } from './callbackDestination';

let createParams = (tenant: { oid: bigint; projectOid: bigint | null }) =>
  ({
    tenant,
    environment: { oid: 11n, instanceOid: 21n },
    input: {
      name: 'Ops webhook',
      url: 'https://example.com/hooks/ops'
    }
  }) as any;

describe('Callback destination creation double-writes the mirrored project column', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.callbackDestinationCreate.mockResolvedValue({ oid: 700n, id: 'cbd_1' });
    mocks.callbackDestinationUpdate.mockResolvedValue({ oid: 700n, id: 'cbd_1' });
    mocks.callbackDestinationFindFirstOrThrow.mockResolvedValue({ oid: 700n, id: 'cbd_1' });
    mocks.callbackDestinationLinkFindMany.mockResolvedValue([]);
  });

  it('writes projectOid next to the legacy tenantOid', async () => {
    await callbackDestinationService.createCallbackDestinationInternal(
      createParams({ oid: 10n, projectOid: 20n })
    );

    expect(mocks.callbackDestinationCreate).toHaveBeenCalledTimes(1);
    expect(mocks.callbackDestinationCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: 20n
    });
  });

  it('mirrors null when the tenant is not linked to a project yet', async () => {
    await callbackDestinationService.createCallbackDestinationInternal(
      createParams({ oid: 10n, projectOid: null })
    );

    let data = mocks.callbackDestinationCreate.mock.calls[0]![0].data;
    expect(data.tenantOid).toBe(10n);
    expect(data.projectOid).toBeNull();
  });

  it('does not touch the scoping columns when updating an existing destination', async () => {
    await callbackDestinationService.updateCallbackDestinationInternal({
      tenant: { oid: 10n, projectOid: 20n },
      environment: { oid: 11n, instanceOid: 21n },
      callbackDestination: {
        oid: 700n,
        id: 'cbd_1',
        name: 'Ops webhook',
        description: null,
        metadata: null,
        url: 'https://example.com/hooks/ops',
        method: 'POST'
      },
      input: { name: 'Renamed webhook' }
    } as any);

    let data = mocks.callbackDestinationUpdate.mock.calls[0]![0].data;
    expect(data).not.toHaveProperty('tenantOid');
    expect(data).not.toHaveProperty('projectOid');
  });
});
