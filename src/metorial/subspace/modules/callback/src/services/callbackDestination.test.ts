import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  callbackDestinationCreate: vi.fn(),
  callbackDestinationUpdate: vi.fn(),
  callbackDestinationFindFirst: vi.fn(),
  callbackDestinationFindFirstOrThrow: vi.fn(),
  callbackDestinationLinkFindMany: vi.fn(),
  syncCallback: vi.fn(),
  getTenantForSignal: vi.fn(),
  rotateSigningSecret: vi.fn()
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
      findFirst: mocks.callbackDestinationFindFirst,
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
  callbackRegistrationService: { syncCallback: mocks.syncCallback }
}));

vi.mock('../signal', () => ({
  getTenantForSignal: mocks.getTenantForSignal,
  getInternalSignal: () => ({
    eventDestination: { rotateSigningSecret: mocks.rotateSigningSecret }
  }),
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
    mocks.getTenantForSignal.mockResolvedValue({ id: 'signal_tenant_1' });
    mocks.rotateSigningSecret.mockResolvedValue({
      eventDestinationId: 'sgnl_dest_1',
      signingSecret: 'metorial_whsec_rotated',
      rotatedAt: new Date('2026-08-21T12:00:00.000Z')
    });
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

  it('rotates a materialized Signal destination and returns plaintext once', async () => {
    let destination = {
      oid: 700n,
      id: 'cbd_1',
      status: 'active',
      signalEventDestinationId: 'sgnl_dest_1'
    };
    mocks.callbackDestinationFindFirst.mockResolvedValue(destination);

    let result = await callbackDestinationService.rotateSigningSecretInternal({
      tenant: { oid: 10n, projectOid: 20n },
      environment: { oid: 11n, instanceOid: 21n },
      callbackDestination: destination
    } as any);

    expect(mocks.rotateSigningSecret).toHaveBeenCalledWith({
      tenantId: 'signal_tenant_1',
      eventDestinationId: 'sgnl_dest_1'
    });
    expect(result).toEqual({
      callbackDestinationId: 'cbd_1',
      signingSecret: 'metorial_whsec_rotated',
      rotatedAt: new Date('2026-08-21T12:00:00.000Z')
    });
  });

  it('materializes linked callbacks before rotating an ordinary signing secret', async () => {
    let destination = {
      oid: 700n,
      id: 'cbd_1',
      status: 'active',
      signalEventDestinationId: null
    };
    mocks.callbackDestinationFindFirst.mockResolvedValue(destination);
    mocks.callbackDestinationLinkFindMany.mockResolvedValue([
      { callback: { id: 'callback_1' } }
    ]);
    mocks.callbackDestinationFindFirstOrThrow.mockResolvedValue({
      ...destination,
      signalEventDestinationId: 'sgnl_dest_1'
    });

    await callbackDestinationService.rotateSigningSecretInternal({
      tenant: { oid: 10n, projectOid: 20n },
      environment: { oid: 11n, instanceOid: 21n },
      callbackDestination: destination
    } as any);

    expect(mocks.syncCallback).toHaveBeenCalledWith({ callbackId: 'callback_1' });
    expect(mocks.rotateSigningSecret).toHaveBeenCalledWith({
      tenantId: 'signal_tenant_1',
      eventDestinationId: 'sgnl_dest_1'
    });
  });

  it('fails closed when no linked callback materializes the destination', async () => {
    let destination = {
      oid: 700n,
      id: 'cbd_1',
      status: 'active',
      signalEventDestinationId: null
    };
    mocks.callbackDestinationFindFirst.mockResolvedValue(destination);
    mocks.callbackDestinationFindFirstOrThrow.mockResolvedValue(destination);

    await expect(
      callbackDestinationService.rotateSigningSecretInternal({
        tenant: { oid: 10n, projectOid: 20n },
        environment: { oid: 11n, instanceOid: 21n },
        callbackDestination: destination
      } as any)
    ).rejects.toThrow('has not been materialized');
    expect(mocks.rotateSigningSecret).not.toHaveBeenCalled();
  });
});
