import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  sessionCreate: vi.fn(),
  sessionTemplateFindFirst: vi.fn(),
  createSessionProvidersForInput: vi.fn(),
  sessionCreatedAdd: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_name, factory) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@metorial-subspace/db', () => ({
  addAfterTransactionHook: vi.fn(async (hook: () => Promise<unknown>) => {
    await hook();
  }),
  getId: vi.fn((prefix: string) => ({ oid: 1n, id: `${prefix}_1` })),
  withTransaction: vi.fn(async (run: (db: unknown) => Promise<unknown>) =>
    run({
      session: { create: mocks.sessionCreate },
      sessionTemplate: { findFirst: mocks.sessionTemplateFindFirst }
    })
  )
}));

vi.mock('@metorial-subspace/module-tenant', () => ({
  getMetorialSolution: vi.fn(async () => ({ oid: 7 }))
}));

vi.mock('../../queues/lifecycle/session', () => ({
  sessionCreatedQueue: { add: mocks.sessionCreatedAdd }
}));

vi.mock('../sessionProvider', () => ({
  sessionProviderInclude: {}
}));

vi.mock('../sessionProviderInput', () => ({
  sessionProviderInputService: {
    createSessionProvidersForInput: mocks.createSessionProvidersForInput
  }
}));

import { createSessionRecord } from './createSession';

let linkedTenant = { oid: 10n, projectOid: 20n };
let linkedEnvironment = { oid: 30n, instanceOid: 40n };

let run = (d: {
  tenant: { oid: bigint; projectOid: bigint | null };
  environment: { oid: bigint; instanceOid: bigint | null };
}) =>
  createSessionRecord({
    tenant: d.tenant as any,
    environment: d.environment as any,
    isEphemeral: false,
    input: {
      providers: [{ deploymentId: 'pd_1' }]
    }
  });

let createdData = () => mocks.sessionCreate.mock.calls[0]![0].data;

describe('createSessionRecord double writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sessionCreate.mockResolvedValue({ oid: 1n, id: 'session_1', providers: [] });
    mocks.createSessionProvidersForInput.mockResolvedValue([]);
  });

  it('mirrors the tenant and environment references onto the session', async () => {
    await run({ tenant: linkedTenant, environment: linkedEnvironment });

    expect(createdData()).toMatchObject({
      tenantOid: 10n,
      projectOid: 20n,
      environmentOid: 30n,
      instanceOid: 40n
    });
  });

  it('mirrors the references onto the nested session event', async () => {
    await run({ tenant: linkedTenant, environment: linkedEnvironment });

    expect(createdData().sessionEvents.create).toMatchObject({
      type: 'session_created',
      tenantOid: 10n,
      projectOid: 20n,
      environmentOid: 30n,
      instanceOid: 40n
    });
  });

  it('writes null for an unlinked tenant and environment', async () => {
    await run({
      tenant: { oid: 10n, projectOid: null },
      environment: { oid: 30n, instanceOid: null }
    });

    let data = createdData();

    expect(data.projectOid).toBeNull();
    expect(data.instanceOid).toBeNull();
    expect(data.sessionEvents.create.projectOid).toBeNull();
    expect(data.sessionEvents.create.instanceOid).toBeNull();
  });

  it('stores an explicit internal adapter binding without consulting the template', async () => {
    await createSessionRecord({
      tenant: linkedTenant as any,
      environment: linkedEnvironment as any,
      isEphemeral: true,
      isInternal: true,
      adapterGlobalOid: 55n,
      input: { providers: [{ deploymentId: 'pd_1' }] }
    });

    expect(createdData()).toMatchObject({
      isEphemeral: true,
      isInternal: true,
      adapterGlobalOid: 55n
    });
    expect(mocks.sessionTemplateFindFirst).not.toHaveBeenCalled();
  });

  it('does not add the mirrored references to any read filter', async () => {
    mocks.sessionTemplateFindFirst.mockResolvedValue(null);

    await createSessionRecord({
      tenant: linkedTenant as any,
      environment: linkedEnvironment as any,
      isEphemeral: false,
      input: {
        providers: [{ sessionTemplateId: 'st_1' }]
      }
    });

    expect(mocks.sessionTemplateFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'st_1',
          tenantOid: 10n,
          solutionOid: 7,
          environmentOid: 30n,
          status: 'active'
        }
      })
    );
  });
});
