import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  callbackCreate: vi.fn(),
  callbackFindFirst: vi.fn(),
  callbackDestinationFindMany: vi.fn(),
  providerDeploymentFindFirst: vi.fn(),
  providerDeploymentFindFirstOrThrow: vi.fn(),
  providerTriggerFindMany: vi.fn(),
  getCurrentVersion: vi.fn(),
  syncCallback: vi.fn()
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
    callback: {
      create: mocks.callbackCreate,
      findFirst: mocks.callbackFindFirst,
      update: vi.fn()
    },
    callbackDestination: {
      findMany: mocks.callbackDestinationFindMany
    },
    callbackInstance: {
      updateMany: vi.fn()
    },
    providerDeployment: {
      findFirst: mocks.providerDeploymentFindFirst,
      findFirstOrThrow: mocks.providerDeploymentFindFirstOrThrow
    },
    providerTrigger: {
      findMany: mocks.providerTriggerFindMany
    },
    $transaction: vi.fn()
  },
  CallbackDestinationStatus: { active: 'active', archived: 'archived', deleted: 'deleted' },
  getId: (model: string) => ({ oid: 900n, id: `${model}_1` }),
  snowflake: { nextId: () => 901n },
  withTransaction: vi.fn()
}));

vi.mock('@metorial-subspace/list-utils', () => ({
  normalizeDateFilter: vi.fn(),
  normalizeStatusForGet: () => ({ noParent: {} }),
  normalizeStatusForList: () => ({ noParent: {} }),
  resolveProviderDeployments: vi.fn()
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: async () => ({ oid: 1 }),
  resolveMetorialFacing: vi.fn(),
  toProviderEventBase: vi.fn()
}));

vi.mock('@metorial-subspace/module-provider-internal', () => ({
  providerDeploymentInternalService: { getCurrentVersion: mocks.getCurrentVersion }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: vi.fn() }
}));

vi.mock('./callbackRegistration', () => ({
  callbackRegistrationService: { syncCallback: mocks.syncCallback }
}));

import { callbackService } from './callback';

let deployment = {
  oid: 30n,
  provider: {
    type: {
      attributes: {
        backend: 'slates',
        triggers: { status: 'enabled' }
      }
    }
  }
};

let createParams = (d: {
  tenant: { oid: bigint; projectOid: bigint | null };
  environment: { oid: bigint; instanceOid: bigint | null };
}) =>
  ({
    tenant: d.tenant,
    environment: d.environment,
    providerDeployment: { id: 'pdp_1' },
    input: {
      name: 'Order updates',
      triggers: [{ triggerId: 'spec_1' }],
      destinationIds: ['cbd_1']
    }
  }) as any;

let linkedScope = {
  tenant: { oid: 10n, projectOid: 20n },
  environment: { oid: 11n, instanceOid: 21n }
};

describe('Callback creation double-writes the mirrored scoping columns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providerDeploymentFindFirst.mockResolvedValue(deployment);
    mocks.providerDeploymentFindFirstOrThrow.mockResolvedValue(deployment);
    mocks.getCurrentVersion.mockResolvedValue({ specificationOid: 40n });
    mocks.providerTriggerFindMany.mockResolvedValue([
      {
        oid: 50n,
        key: 'order.updated',
        specId: 'spec_1',
        callableId: 'call_1',
        specUniqueIdentifier: null
      }
    ]);
    mocks.callbackDestinationFindMany.mockResolvedValue([{ oid: 60n, id: 'cbd_1' }]);
    mocks.callbackCreate.mockResolvedValue({ oid: 900n, id: 'callback_1' });
    mocks.callbackFindFirst.mockResolvedValue({ oid: 900n, id: 'callback_1' });
  });

  it('writes projectOid and instanceOid next to the legacy oids', async () => {
    await callbackService.createCallbackInternal(createParams(linkedScope));

    expect(mocks.callbackCreate).toHaveBeenCalledTimes(1);
    expect(mocks.callbackCreate.mock.calls[0]![0].data).toMatchObject({
      tenantOid: 10n,
      projectOid: 20n,
      environmentOid: 11n,
      instanceOid: 21n
    });
  });

  it('mirrors null when the tenant and environment are not linked yet', async () => {
    await callbackService.createCallbackInternal(
      createParams({
        tenant: { oid: 10n, projectOid: null },
        environment: { oid: 11n, instanceOid: null }
      })
    );

    let data = mocks.callbackCreate.mock.calls[0]![0].data;
    expect(data.tenantOid).toBe(10n);
    expect(data.projectOid).toBeNull();
    expect(data.environmentOid).toBe(11n);
    expect(data.instanceOid).toBeNull();
  });

  it('keeps the read path filtering on the legacy oids only', async () => {
    await callbackService.createCallbackInternal(createParams(linkedScope));

    let where = mocks.callbackFindFirst.mock.calls[0]![0].where;
    expect(where).toMatchObject({ tenantOid: 10n, environmentOid: 11n });
    expect(where).not.toHaveProperty('projectOid');
    expect(where).not.toHaveProperty('instanceOid');
  });
});
